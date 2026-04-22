
const fs = require('fs');
const path = require('path');

// Scan ALL possible pnpm stores in the image
const PNPM_DIRS = [
  '/app/node_modules/.pnpm',
  '/app/worker/node_modules/.pnpm',
  '/app/web/node_modules/.pnpm',
];

let totalFixed = 0, totalUnfixable = 0;

function fixDir(pnpmDir) {
  let fixed = 0, unfixable = 0;

  function scanDir(dir, depth) {
    if (depth > 6) return;
    let entries;
    try { entries = fs.readdirSync(dir); } catch(e) { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      let stat;
      try { stat = fs.lstatSync(full); } catch(e) { continue; }
      if (stat.isSymbolicLink()) {
        const target = fs.readlinkSync(full);
        const absTarget = path.resolve(dir, target);
        if (!fs.existsSync(absTarget)) {
          const match = absTarget.match(/\.pnpm\/([^/]+)\/node_modules\/(.+)/);
          if (!match) { unfixable++; continue; }
          const pnpmPkg = match[1];
          const subPath = match[2];
          const atIdx = pnpmPkg.indexOf('@', pnpmPkg.startsWith('@') ? 1 : 0);
          const pkgBase = atIdx > 0 ? pnpmPkg.slice(0, atIdx) : pnpmPkg;
          let dirs;
          try { dirs = fs.readdirSync(pnpmDir); } catch(e) { continue; }
          const prefix = pkgBase + '@';
          const candidates = dirs.filter(d => d === pkgBase || d.startsWith(prefix));
          if (candidates.length === 0) { unfixable++; continue; }
          const viable = candidates.filter(d => d !== pnpmPkg);
          viable.sort().reverse();
          let found = null;
          for (const cand of viable) {
            const candidate = path.join(pnpmDir, cand, 'node_modules', subPath);
            if (fs.existsSync(candidate)) { found = candidate; break; }
          }
          if (found) {
            const newTarget = path.relative(dir, found);
            try {
              fs.unlinkSync(full);
              fs.symlinkSync(newTarget, full);
              fixed++;
              const shortFull = full.replace(pnpmDir + '/', '').split('/node_modules/').slice(-1)[0];
              const shortNew = found.replace(pnpmDir + '/', '').split('/')[0];
              console.log('fixed [' + pnpmDir.split('/').slice(-3).join('/') + ']: ' + shortFull + ' (' + pkgBase + ' -> ' + shortNew.split('_')[0] + ')');
            } catch(e) { unfixable++; console.log('fail: ' + e.message); }
          } else {
            unfixable++;
            console.log('no-replacement [' + pnpmDir.split('/').slice(-3).join('/') + ']: ' + pkgBase + ' (was ' + pnpmPkg.split('_')[0] + ')');
          }
        }
      } else if (stat.isDirectory() && entry === 'node_modules') {
        scanDir(full, depth + 1);
      }
    }
  }

  if (!fs.existsSync(pnpmDir)) return;
  scanDir(pnpmDir, 0);
  totalFixed += fixed;
  totalUnfixable += unfixable;
}

console.log('fix-pnpm-symlinks: scanning all pnpm stores...');
for (const dir of PNPM_DIRS) fixDir(dir);
console.log('fix-pnpm-symlinks: done fixed=' + totalFixed + ' unfixable=' + totalUnfixable);
