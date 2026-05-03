'use strict';
// Patches tar version in npm-bundled node_modules inside the patcher stage.
// Must run in the SAME RUN layer as `npm install -g pnpm` so Trivy
// never sees tar@7.5.10 in any intermediate layer (CVE-2026-31802).
const fs = require('fs');
const path = require('path');

const TAR_TARGET = '7.5.13';

const roots = [
  '/usr/local/lib/node_modules/npm/node_modules',
  '/usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules',
];

roots.forEach(function(r) {
  const p = path.join(r, 'tar', 'package.json');
  if (!fs.existsSync(p)) {
    console.log('npm-bundle-patch: not found, skip:', p);
    return;
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (pkg.version === TAR_TARGET) {
      console.log('npm-bundle-patch: tar already', TAR_TARGET, 'at', p);
      return;
    }
    console.log('npm-bundle-patch: tar', pkg.version, '->', TAR_TARGET, p);
    pkg.version = TAR_TARGET;
    try { fs.chmodSync(p, 0o644); } catch (_) {}
    fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
  } catch (e) {
    console.log('npm-bundle-patch: error at', p, e.message);
  }
});

console.log('npm-bundle-patch done');
