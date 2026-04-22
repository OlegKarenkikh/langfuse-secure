
// fix-next-symlinks.js - Update broken symlinks in .next/node_modules after pnpm renames
const fs = require('fs');
const path = require('path');

const nextNodeModules = '/app/web/.next/node_modules';
if (!fs.existsSync(nextNodeModules)) {
  console.log('fix-next-symlinks: no .next/node_modules, skipping');
  process.exit(0);
}

const entries = fs.readdirSync(nextNodeModules);
let fixed = 0, broken = 0;

for (const entry of entries) {
  const linkPath = path.join(nextNodeModules, entry);
  let stat;
  try { stat = fs.lstatSync(linkPath); } catch(e) { continue; }
  if (!stat.isSymbolicLink()) continue;

  const target = fs.readlinkSync(linkPath);
  const absTarget = path.resolve(nextNodeModules, target);

  // Check if target exists
  if (fs.existsSync(absTarget)) continue; // OK

  broken++;
  // Try to find the package by name in pnpm store
  // target looks like: ../../../node_modules/.pnpm/nodemailer@7.0.11/node_modules/nodemailer
  const match = target.match(/\.pnpm\/([^@]+)@[^/]+\/node_modules\/(.+)/);
  if (!match) {
    console.log(`fix-next-symlinks: broken unrecognized: ${entry} -> ${target}`);
    continue;
  }
  const pkgName = match[1]; // e.g. "nodemailer"
  const subPath = match[2]; // e.g. "nodemailer"

  // Find any version of this package in pnpm store
  const pnpmDir = '/app/node_modules/.pnpm';
  let found = null;
  try {
    const dirs = fs.readdirSync(pnpmDir);
    // Find dirs matching pkgName@* (simple packages) or @scope+pkg@*
    const candidates = dirs.filter(d => {
      const base = d.split('_')[0]; // strip peer deps hash
      return base === `${pkgName}@` || base.startsWith(`${pkgName}@`);
    });
    if (candidates.length > 0) {
      // Sort by version desc, take latest
      candidates.sort().reverse();
      found = path.join(pnpmDir, candidates[0], 'node_modules', subPath);
    }
  } catch(e) {}

  if (found && fs.existsSync(found)) {
    // Update symlink
    const newTarget = path.relative(nextNodeModules, found);
    fs.unlinkSync(linkPath);
    fs.symlinkSync(newTarget, linkPath);
    console.log(`fix-next-symlinks: fixed ${entry} -> ${newTarget}`);
    fixed++;
  } else {
    console.log(`fix-next-symlinks: broken, no replacement found: ${entry} -> ${target}`);
  }
}

console.log(`fix-next-symlinks: done, fixed=${fixed} broken=${broken - fixed}`);
