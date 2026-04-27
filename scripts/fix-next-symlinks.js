
// fix-next-symlinks.js - Update broken symlinks in ALL node_modules after pnpm renames
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let nmRoots = [];
try {
  nmRoots = execSync('find /app -name node_modules -type d 2>/dev/null').toString().trim().split('\n').filter(Boolean);
} catch(e) { nmRoots = ['/app/node_modules']; }

const pnpmStore = '/app/node_modules/.pnpm';
if (!fs.existsSync(pnpmStore)) {
  console.log('fix-next-symlinks: no pnpm store, skipping');
  process.exit(0);
}

let fixed = 0;

for (const nmRoot of nmRoots) {
  if (nmRoot.includes('.pnpm/')) continue; // Don't fix links inside store itself

  const entries = fs.readdirSync(nmRoot);
  for (const entry of entries) {
    const linkPath = path.join(nmRoot, entry);
    let stat;
    try { stat = fs.lstatSync(linkPath); } catch(e) { continue; }
    if (!stat.isSymbolicLink()) continue;

    const target = fs.readlinkSync(linkPath);
    const absTarget = path.resolve(nmRoot, target);
    if (fs.existsSync(absTarget)) continue;

    // target looks like: ../../../node_modules/.pnpm/nodemailer@7.0.11/node_modules/nodemailer
    const match = target.match(/\.pnpm\/([^@]+)@[^/]+\/node_modules\/(.+)/);
    if (!match) continue;

    const pkgName = match[1];
    const subPath = match[2];

    let found = null;
    try {
      const dirs = fs.readdirSync(pnpmStore);
      const candidates = dirs.filter(d => d === pkgName || d.startsWith(pkgName + '@'));
      if (candidates.length > 0) {
        candidates.sort().reverse();
        found = path.join(pnpmStore, candidates[0], 'node_modules', subPath);
        if (!fs.existsSync(found)) found = path.join(pnpmStore, candidates[0], subPath);
      }
    } catch(e) {}

    if (found && fs.existsSync(found)) {
      const newTarget = path.relative(nmRoot, found);
      fs.unlinkSync(linkPath);
      fs.symlinkSync(newTarget, linkPath);
      console.log(`fix-next-symlinks: fixed ${linkPath} -> ${newTarget}`);
      fixed++;
    }
  }
}

console.log(`fix-next-symlinks: done, fixed=${fixed}`);
