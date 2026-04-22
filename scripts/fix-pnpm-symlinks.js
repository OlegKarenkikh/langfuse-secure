
const fs = require('fs');
const path = require('path');
const pnpmDir = '/app/node_modules/.pnpm';

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
        // Use absTarget for matching since target is relative
        const match = absTarget.match(/\.pnpm\/([^/]+)\/node_modules\/(.+)/);
        if (!match) { unfixable++; continue; }
        const pnpmPkg = match[1]; // e.g. langsmith@0.5.16_...
        const subPath = match[2]; // e.g. langsmith
        // Extract base package name (before first @, excluding scope)
        const atIdx = pnpmPkg.indexOf('@', pnpmPkg.startsWith('@') ? 1 : 0);
        const pkgBase = atIdx > 0 ? pnpmPkg.slice(0, atIdx) : pnpmPkg;
        let dirs;
        try { dirs = fs.readdirSync(pnpmDir); } catch(e) { continue; }
        const prefix = pkgBase + '@';
        const candidates = dirs.filter(d => d === pkgBase || d.startsWith(prefix));
        if (candidates.length === 0) { unfixable++; continue; }
        // Remove the broken dir from candidates
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
            const shortFull = full.replace('/app/node_modules/.pnpm/','').split('/node_modules/').slice(-1)[0];
            const shortNew = found.replace('/app/node_modules/.pnpm/','').split('/')[0];
            console.log('fixed: ' + shortFull + ' (' + pkgBase + ' -> ' + shortNew.split('@').slice(0,2).join('@') + ')');
          } catch(e) { unfixable++; console.log('fail: ' + e.message); }
        } else {
          unfixable++;
          console.log('no-replacement: ' + pkgBase + ' (was ' + pnpmPkg.split('_')[0] + ')');
        }
      }
    } else if (stat.isDirectory() && entry === 'node_modules') {
      scanDir(full, depth + 1);
    }
  }
}

console.log('fix-pnpm-symlinks: scanning...');
scanDir(pnpmDir, 0);
console.log('fix-pnpm-symlinks: done fixed=' + fixed + ' unfixable=' + unfixable);
