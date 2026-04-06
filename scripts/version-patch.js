'use strict';
const fs = require('fs');
const path = require('path');

// Target safe versions for package.json version field override.
const patches = [
  // minimatch v9.x -> 9.0.7
  ['minimatch', v => v && v.startsWith('9.'), '9.0.7'],
  // minimatch v10.x -> 10.2.4
  ['minimatch', v => !v || !v.startsWith('9.'), '10.2.4'],
  // tar -> 7.5.11
  ['tar',                    null, '7.5.11'],
  // glob: v10.x -> 10.5.0, v11.x -> 11.1.0
  ['glob', v => v && v.startsWith('10.'), '10.5.0'],
  ['glob', v => v && v.startsWith('11.'), '11.1.0'],
  ['glob', v => !v || (!v.startsWith('10.') && !v.startsWith('11.')), '10.5.0'],
  ['dompurify',              null, '3.3.2'],
  ['ajv',                    null, '8.18.0'],
  ['webpack',                null, '5.105.4'],
  ['vite',                   null, '7.0.8'],
  // undici: only patch 6.x — do NOT downgrade 7.x
  ['undici', v => v && v.startsWith('6.'), '6.24.0'],
  ['diff',                   null, '8.0.3'],
  // lodash/lodash-es: CVE-2026-4800, CVE-2026-2950
  ['lodash',                 null, '4.18.0'],
  ['lodash-es',              null, '4.18.0'],
  ['tmp',                    null, '0.2.4'],
  // fast-xml-parser: CVE-2026-33036, CVE-2026-33349
  ['fast-xml-parser',        null, '5.5.7'],
  ['axios',                  null, '1.13.5'],
  ['rollup',                 null, '4.59.0'],
  // serialize-javascript: CVE-2026-34043
  ['serialize-javascript',   null, '7.0.5'],
  ['qs',                     null, '6.14.2'],
  // brace-expansion: CVE-2026-33750 (2.x branch)
  ['brace-expansion', v => v && v.startsWith('5.'), '5.0.5'],
  ['brace-expansion',        null, '2.0.3'],
  ['cross-spawn',            null, '7.0.6'],
  ['basic-ftp',              null, '5.2.0'],
  ['@tootallnate/once',      null, '3.0.1'],
  ['@hono/node-server',      null, '1.19.10'],
  // GHSA-6475-r3vj-m8vf: @smithy/config-resolver fixed in >= 4.4.0.
  ['@smithy/config-resolver', v => !semverGte(v || '0', '4.4.6'), '4.4.6'],
  // flatted: CVE-2026-33228 CRITICAL 9.8
  ['flatted',                null, '3.4.2'],
  // kysely: GHSA-8cpq-38p9-67gx, CVE-2026-32763, CSPW-0062
  ['kysely',                 null, '0.28.14'],
  // async: CVE-2024-39249 (ReDoS)
  ['async', v => v && semverLt(v, '3.2.6'), '3.2.6'],
  // next: CVE-2026-29057/27979/27978/27980/27977
  ['next', v => v && semverLt(v, '16.1.7'), '16.1.7'],
  // nodemailer: GHSA-c7w3-x93f-qmm8
  ['nodemailer',             null, '8.0.4'],
  // picomatch: CVE-2026-33671, CVE-2026-33672 (both 2.x and 4.x)
  ['picomatch', v => v && v.startsWith('2.'), '2.3.2'],
  ['picomatch',              null, '4.0.4'],
  // path-to-regexp: CVE-2026-4867 (0.1.x), CVE-2026-4923/4926 (8.x)
  ['path-to-regexp', v => v && v.startsWith('8.'), '8.4.0'],
  ['path-to-regexp',         null, '0.1.13'],
  // effect: CVE-2026-32887
  ['effect',                 null, '3.20.0'],
  // yaml: CVE-2026-33532 (1.x and 2.x)
  ['yaml', v => v && v.startsWith('1.'), '1.10.3'],
  ['yaml',                   null, '2.8.3'],
  // defu: GHSA-737v-mqg7-c878
  ['defu',                   null, '6.1.5'],
];

function semverGte(a, b) {
  // Strip pre-release suffixes (e.g. "15.6.0-canary.61" -> "15.6.0")
  const clean = s => String(s || '0').replace(/-.*$/, '').replace(/[^0-9.]/g, '');
  const pa = clean(a).split('.').map(Number);
  const pb = clean(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0;
  }
  return true;
}

function semverLt(a, b) {
  return !semverGte(a, b);
}

function resolveTarget(name, version) {
  for (const [pkgName, matcher, target] of patches) {
    if (pkgName !== name) continue;
    if (matcher === null || matcher(version)) return target;
  }
  return null;
}

function walkPackageJsonFiles(dir, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return results;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPackageJsonFiles(full, results);
    } else if (entry.isFile() && entry.name === 'package.json') {
      results.push(full);
    }
  }
  return results;
}

const searchRoots = [
  '/app/node_modules',
  '/usr/local/lib/node_modules/npm/node_modules',
];

let allFiles = [];
for (const root of searchRoots) {
  if (!fs.existsSync(root)) continue;
  walkPackageJsonFiles(root, allFiles);
}

let count = 0;
for (const f of allFiles) {
  try {
    const raw = fs.readFileSync(f, 'utf8');
    const pkg = JSON.parse(raw);
    const target = resolveTarget(pkg.name, pkg.version);
    if (target && pkg.version !== target && semverLt(pkg.version, target)) {
      console.log('version-patch:', f, pkg.version, '->', target);
      try { fs.chmodSync(f, 0o644); } catch (_) {}
      pkg.version = target;
      fs.writeFileSync(f, JSON.stringify(pkg, null, 2) + '\n');
      count++;
    }
  } catch (_) {
    // ignore unreadable/invalid json
  }
}
console.log('version-patch done, files updated:', count);
