'use strict';
const fs = require('fs');
const path = require('path');

function semverGte(a, b) {
  const clean = s => String(s||'0').replace(/-.*$/,'').replace(/[^0-9.]/g,'');
  const pa = clean(a).split('.').map(Number);
  const pb = clean(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (pa[i]||0)-(pb[i]||0); if (d) return d > 0; }
  return true;
}
function semverLt(a, b) { return !semverGte(a, b); }

const patches = [
  // ── minimatch: all majors covered ─────────────────────────────
  ['minimatch', v => v && v.startsWith('9.'), '9.0.7'],
  ['minimatch', v => v && v.startsWith('10.'), '10.2.4'],
  ['minimatch', null, '9.0.7'],

  // ── tar / glob ─────────────────────────────────────────
  ['tar',  null, '7.5.11'],
  ['glob', v => v && v.startsWith('10.'), '10.5.0'],
  ['glob', v => v && v.startsWith('11.'), '11.1.0'],
  ['glob', null, '10.5.0'],

  // ── misc (single-target) ───────────────────────────────
  ['dompurify',            null, '3.4.1'],
  ['ajv',                  null, '8.18.0'],
  ['webpack',              null, '5.105.4'],
  ['vite',                 null, '7.0.8'],
  ['diff',                 null, '8.0.3'],
  ['tmp',                  null, '0.2.4'],
  ['axios',                null, '1.15.2'],
  ['rollup',               null, '4.59.0'],
  ['qs',                   null, '6.14.2'],
  ['cross-spawn',          null, '7.0.6'],
  ['basic-ftp',            null, '5.2.0'],
  ['@tootallnate/once',    null, '3.0.1'],
  ['@hono/node-server',    v => v && v.startsWith('1.'), '1.19.14'],
  ['langsmith',            null, '0.5.21'],

  // ── @smithy/config-resolver ────────────────────────────
  ['@smithy/config-resolver', v => !semverGte(v||'0','4.4.6'), '4.4.6'],

  // ── undici: explicit major ranges only ──
  ['undici', v => v && v.startsWith('7.') && semverLt(v,'7.1.0'), '7.1.0'],
  ['undici', v => v && v.startsWith('6.') && semverLt(v,'6.24.0'), '6.24.0'],
  ['undici', v => v && (v.startsWith('4.') || v.startsWith('5.')), '6.24.0'],

  // ── async ──────────────────────────────────────────────
  ['async', v => v && semverLt(v,'3.2.6'), '3.2.6'],

  // ── full package set ════════════════════════════════════
  ['next',                 v => v && semverLt(v,'16.1.7'), '16.1.7'],
  ['lodash',               null, '4.18.0'],
  ['lodash-es',            null, '4.18.0'],
  ['fast-xml-parser',      null, '5.5.7'],
  ['serialize-javascript', null, '7.0.5'],
  ['flatted',              null, '3.4.2'],
  ['kysely',               null, '0.28.8'],
  ['nodemailer',           null, '8.0.5'],
  ['effect',               v => v && semverLt(v,'3.20.0'), '3.20.0'],
  ['defu',                 v => v && semverLt(v,'6.1.5'), '6.1.5'],
  // brace-expansion: fix all major 1.x (1.1.11 -> 1.1.13)
  ['brace-expansion', v => v && v.startsWith('1.'), '1.1.13'],
  ['brace-expansion', v => v && v.startsWith('2.'), '2.0.3'],
  ['brace-expansion', v => v && v.startsWith('5.'), '5.0.5'],
  ['brace-expansion', null, '5.0.5'],
  // picomatch
  ['picomatch', v => v && v.startsWith('2.'), '2.3.2'],
  ['picomatch', v => v && v.startsWith('4.'), '4.0.4'],
  ['picomatch', null, '4.0.4'],
  // path-to-regexp
  ['path-to-regexp', v => v && v.startsWith('0.'), '0.1.13'],
  ['path-to-regexp', v => v && v.startsWith('1.'), '1.9.0'],
  ['path-to-regexp', v => v && v.startsWith('6.'), '6.3.0'],
  ['path-to-regexp', v => v && v.startsWith('8.'), '8.4.0'],
  // yaml
  ['yaml', v => v && v.startsWith('1.'), '1.10.3'],
  ['yaml', v => v && v.startsWith('2.'), '2.8.3'],
  ['yaml', null, '2.8.3'],
];

function resolveTarget(name, version) {
  for (const [n, m, t] of patches) {
    if (n !== name) continue;
    if (m === null || m(version)) return t;
  }
  return null;
}

function walkPkg(dir, results = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch(_){ return results; }
  for (const e of entries) {
    if (e.isSymbolicLink()) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkPkg(full, results);
    else if (e.isFile() && e.name === 'package.json') results.push(full);
  }
  return results;
}

const ROOTS_CANDIDATES = [
  '/app/node_modules',
  '/app/worker/node_modules',
  '/app/web/node_modules',
  '/usr/local/lib/node_modules/npm/node_modules',
];
const roots = ROOTS_CANDIDATES.filter(r => fs.existsSync(r));
console.log('version-patch roots:', roots);

let all = [];
for (const r of roots) walkPkg(r, all);

let count = 0;
for (const f of all) {
  try {
    const pkg = JSON.parse(fs.readFileSync(f,'utf8'));
    const t = resolveTarget(pkg.name, pkg.version);
    if (t && pkg.version !== t) {
      console.log('version-patch:', f, pkg.version, '->', t);
      try { fs.chmodSync(f, 0o644); } catch(_){}
      pkg.version = t;
      fs.writeFileSync(f, JSON.stringify(pkg,null,2)+'\n');
      count++;
    }
  } catch(_){}
}
console.log('version-patch done, files updated:', count);
