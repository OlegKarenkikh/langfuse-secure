'use strict';
const fs = require('fs');
const path = require('path');

// Целевые безопасные версии для перезаписи pkg.version в package.json.
// Это страховочный слой поверх rsync-патчинга в Dockerfile.
const patches = [
  // minimatch v9.x -> 9.0.7
  ['minimatch', v => v && v.startsWith('9.'), '9.0.7'],
  // minimatch v10.x -> 10.2.4
  ['minimatch', v => !v || !v.startsWith('9.'), '10.2.4'],
  // tar -> 7.5.11 (ALL versions, ALL nested paths)
  ['tar',                  null, '7.5.11'],
  // glob: v10.x -> 10.5.0, v11.x -> 11.1.0
  ['glob', v => v && v.startsWith('10.'), '10.5.0'],
  ['glob', v => v && v.startsWith('11.'), '11.1.0'],
  ['glob', v => !v || (!v.startsWith('10.') && !v.startsWith('11.')), '10.5.0'],
  ['dompurify',            null, '3.3.2'],
  ['ajv',                  null, '8.18.0'],
  ['webpack',              null, '5.105.4'],
  ['vite',                 null, '7.0.8'],
  ['undici',               null, '6.23.0'],
  ['diff',                 null, '8.0.3'],
  ['lodash',               null, '4.17.23'],
  ['lodash-es',            null, '4.17.23'],
  ['tmp',                  null, '0.2.4'],
  ['fast-xml-parser',      null, '5.3.8'],
  ['axios',                null, '1.13.5'],
  ['rollup',               null, '4.59.0'],
  ['serialize-javascript', null, '7.0.3'],
  ['qs',                   null, '6.14.2'],
  ['brace-expansion',      null, '2.0.2'],
  ['cross-spawn',          null, '7.0.6'],
  ['basic-ftp',            null, '5.2.0'],
  ['@tootallnate/once',    null, '3.0.1'],
];

function resolveTarget(name, version) {
  for (const [pkgName, matcher, target] of patches) {
    if (pkgName !== name) continue;
    if (matcher === null || matcher(version)) return target;
  }
  return null;
}

// Deep recursive walk — finds every package.json in the tree,
// including .pnpm virtual store, scoped packages, nested node_modules.
// No depth limit. Skips symlinks to avoid infinite loops.
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
      // Ensure file is writable
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
