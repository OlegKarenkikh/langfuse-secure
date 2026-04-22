const fs = require('fs');
const path = require('path');

const PNPM_DIRS = [
  '/app/node_modules/.pnpm',
  '/app/worker/node_modules/.pnpm',
  '/app/web/node_modules/.pnpm',
];

let totalFixed = 0, totalUnfixable = 0;

function fixSymlink(full, dir, pnpmDir) {
  const target = fs.readlinkSync(full);
  const absTarget = path.resolve(dir, target);
  if (fs.existsSync(absTarget)) return; // not broken

  const match = absTarget.match(/\.pnpm\/([^/]+)\/node_modules\/(.+)/);
  if (!match) { totalUnfixable++; return; }
  const pnpmPkg = match[1]; const subPath = match[2];
  const atIdx = pnpmPkg.indexOf('@', pnpmPkg.startsWith('@') ? 1 : 0);
  const pkgBase = atIdx > 0 ? pnpmPkg.slice(0, atIdx) : pnpmPkg;

  let dirs; try { dirs = fs.readdirSync(pnpmDir); } catch(e) { totalUnfixable++; return; }
  const prefix = pkgBase + '@';
  const candidates = dirs.filter(d => d === pkgBase || d.startsWith(prefix));
  const viable = candidates.filter(d => d !== pnpmPkg).sort().reverse();
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
      totalFixed++;
      const label = full.replace(pnpmDir + '/', '');
      console.log('fixed:', label, '->', path.basename(path.dirname(path.dirname(found))));
    } catch(e) { totalUnfixable++; console.log('fail:', e.message); }
  } else {
    totalUnfixable++;
    console.log('no-replacement:', full.replace(pnpmDir+'/','').split('/')[0], 'dep', pkgBase, '(was', pnpmPkg.split('_')[0]+')');
  }
}

function scanPnpmDir(pnpmDir) {
  if (!fs.existsSync(pnpmDir)) return;
  let pkgDirs; try { pkgDirs = fs.readdirSync(pnpmDir); } catch(e) { return; }

  for (const pkg of pkgDirs) {
    if (pkg === '.modules.yaml' || pkg === '.package-lock.yaml') continue;
    const pkgPath = path.join(pnpmDir, pkg);
    let pstat; try { pstat = fs.lstatSync(pkgPath); } catch(e) { continue; }
    if (!pstat.isDirectory()) continue;

    // Check node_modules inside each package dir
    const nmPath = path.join(pkgPath, 'node_modules');
    if (!fs.existsSync(nmPath)) continue;
    let entries; try { entries = fs.readdirSync(nmPath); } catch(e) { continue; }

    for (const entry of entries) {
      const full = path.join(nmPath, entry);
      let stat; try { stat = fs.lstatSync(full); } catch(e) { continue; }

      if (stat.isSymbolicLink()) {
        fixSymlink(full, nmPath, pnpmDir);
      } else if (stat.isDirectory() && entry.startsWith('@')) {
        // scoped packages: @scope/pkg
        let scopedEntries; try { scopedEntries = fs.readdirSync(full); } catch(e) { continue; }
        for (const se of scopedEntries) {
          const sfull = path.join(full, se);
          let sstat; try { sstat = fs.lstatSync(sfull); } catch(e) { continue; }
          if (sstat.isSymbolicLink()) fixSymlink(sfull, full, pnpmDir);
        }
      }
    }
  }
}

console.log('fix-pnpm-symlinks v4: scanning all pnpm stores...');
for (const dir of PNPM_DIRS) {
  console.log('  scanning:', dir);
  scanPnpmDir(dir);
}
console.log('fix-pnpm-symlinks: done fixed=' + totalFixed + ' unfixable=' + totalUnfixable);
