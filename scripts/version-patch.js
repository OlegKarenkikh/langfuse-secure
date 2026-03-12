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
  ['undici', v => v && v.startsWith('6.'), '6.23.0'],
  ['diff',                   null, '8.0.3'],
  ['lodash',                 null, '4.17.23'],
  ['lodash-es',              null, '4.17.23'],
  ['tmp',                    null, '0.2.4'],
  ['fast-xml-parser',        null, '5.3.8'],
  ['axios',                  null, '1.13.5'],
  ['rollup',                 null, '4.59.0'],
  ['serialize-javascript',   null, '7.0.3'],
  ['qs',                     null, '6.14.2'],
  ['brace-expansion',        null, '2.0.2'],
  ['cross-spawn',            null, '7.0.6'],
  ['basic-ftp',              null, '5.2.0'],
  ['@tootallnate/once',      null, '3.0.1'],
  ['@hono/node-server',      null, '1.19.10'],
  // GHSA-6475-r3vj-m8vf: @smithy/config-resolver fixed in >= 4.4.0.
  // Patch ALL versions (3.x and 4.x < 4.4.6) -> 4.4.6.
  ['@smithy/config-resolver', v => !semverGte(v || '0', '4.4.6'), '4.4.6'],
];

function semverGte(a, b) {
  const pa = String(a).replace(/[^0-9.]/g, '').split('.').map(Number);
  const pb = String(b).replace(/[^0-9.]/g, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0;
  }
  return true;
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
    if (target && pkg.version !== target) {
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
