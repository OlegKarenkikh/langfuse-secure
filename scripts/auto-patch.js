#!/usr/bin/env node
/**
 * auto-patch.js
 *
 * Reads one or more Trivy JSON reports (passed as CLI args),
 * extracts npm vulnerabilities that have a fixed version reported by Trivy,
 * and updates scripts/version-patch.js + scripts/patch-all.js TARGETS map
 * with the new entries.
 *
 * Usage:
 *   node scripts/auto-patch.js trivy-web.json trivy-worker.json
 *
 * Exit codes:
 *   0 — no new patches needed (files unchanged)
 *   1 — error
 *   2 — new patches were written (caller should commit & PR)
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// ----------------------------------------------------------------
// 1. Parse Trivy JSON reports
// ----------------------------------------------------------------
const reportFiles = process.argv.slice(2);
if (reportFiles.length === 0) {
  console.error('Usage: node auto-patch.js <trivy1.json> [trivy2.json ...]');
  process.exit(1);
}

/**
 * Semver comparison helpers
 */
function semverParts(v) {
  return String(v || '0').replace(/[^0-9.]/g, '').split('.').map(Number);
}
function semverGte(a, b) {
  const pa = semverParts(a);
  const pb = semverParts(b);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0;
  }
  return true;
}
function semverMajor(v) { return semverParts(v)[0] || 0; }

// ----------------------------------------------------------------
// 2. Collect vulnerabilities from all reports
// ----------------------------------------------------------------
// Map: pkgName -> { fixedVersion, cveList[], sameMajorOnly }
const newPatches = {};

for (const file of reportFiles) {
  if (!fs.existsSync(file)) {
    console.warn(`[auto-patch] WARNING: file not found: ${file}`);
    continue;
  }
  let report;
  try {
    report = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.warn(`[auto-patch] WARNING: cannot parse ${file}: ${e.message}`);
    continue;
  }

  const results = report.Results || [];
  for (const result of results) {
    if (result.Type !== 'npm') continue;
    const vulns = result.Vulnerabilities || [];
    for (const v of vulns) {
      const pkgName    = v.PkgName;
      const installedV = v.InstalledVersion || '';
      const fixedV     = v.FixedVersion     || '';
      const cveId      = v.VulnerabilityID  || 'unknown';

      if (!pkgName || !fixedV) continue; // no fix available — skip

      // If multiple fixed versions listed (e.g. "6.24.0, 7.1.0"), pick
      // the one whose major matches installedVersion (same-major-only rule)
      // otherwise pick the lowest fixed version.
      const fixedCandidates = fixedV
        .split(/[,|\s]+/)
        .map(s => s.trim())
        .filter(Boolean);

      let chosen = fixedCandidates[0];
      const installedMajor = semverMajor(installedV);
      const sameMajorFix = fixedCandidates.find(
        c => semverMajor(c) === installedMajor
      );
      const sameMajorOnly = !!sameMajorFix && fixedCandidates.length > 1;
      if (sameMajorFix) chosen = sameMajorFix;

      if (!newPatches[pkgName]) {
        newPatches[pkgName] = {
          fixedVersion: chosen,
          cveList: [cveId],
          sameMajorOnly,
        };
      } else {
        // Keep highest fixed version
        if (!semverGte(newPatches[pkgName].fixedVersion, chosen)) {
          newPatches[pkgName].fixedVersion = chosen;
        }
        if (!newPatches[pkgName].cveList.includes(cveId)) {
          newPatches[pkgName].cveList.push(cveId);
        }
      }
    }
  }
}

console.log('[auto-patch] Vulnerabilities with fixes found in reports:');
const entries = Object.entries(newPatches);
if (entries.length === 0) {
  console.log('[auto-patch] None. Nothing to patch.');
  process.exit(0);
}
for (const [pkg, info] of entries) {
  console.log(`  ${pkg}@${info.fixedVersion}  (${info.cveList.join(', ')})`);
}

// ----------------------------------------------------------------
// 3. Update scripts/version-patch.js
// ----------------------------------------------------------------
const VP_PATH = path.join(__dirname, 'version-patch.js');
let vpSrc = fs.readFileSync(VP_PATH, 'utf8');

let vpChanged = false;
for (const [pkg, info] of entries) {
  const { fixedVersion, cveList } = info;

  // Check if entry already exists and is already >= fixedVersion
  // Match lines like: ['pkg-name', ..., 'x.y.z'],
  const escPkg = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingRe = new RegExp(
    `\\['${escPkg}',[^]]+?'([0-9][^']+)'\\s*\\]`, 'g'
  );
  let alreadyCovered = false;
  let m;
  while ((m = existingRe.exec(vpSrc)) !== null) {
    if (semverGte(m[1], fixedVersion)) {
      alreadyCovered = true;
      break;
    }
  }
  if (alreadyCovered) {
    console.log(`[auto-patch] version-patch.js already covers ${pkg}>=${fixedVersion}`);
    continue;
  }

  // Build new patch line
  const comment = `  // ${cveList.join(', ')} — auto-patched by auto-patch.js`;
  const patchLine = `  ['${pkg}', null, '${fixedVersion}'],`;
  const block = `${comment}\n${patchLine}\n`;

  // Insert before closing `];` of the patches array
  if (vpSrc.includes('\n];\n')) {
    vpSrc = vpSrc.replace('\n];\n', `\n${block}];\n`);
    vpChanged = true;
    console.log(`[auto-patch] version-patch.js: added ${pkg} -> ${fixedVersion}`);
  } else {
    console.warn(`[auto-patch] WARNING: could not locate patches array end in version-patch.js`);
  }
}

if (vpChanged) {
  fs.writeFileSync(VP_PATH, vpSrc);
  console.log('[auto-patch] version-patch.js updated.');
}

// ----------------------------------------------------------------
// 4. Update scripts/patch-all.js TARGETS map
// ----------------------------------------------------------------
const PA_PATH = path.join(__dirname, 'patch-all.js');
let paSrc = fs.readFileSync(PA_PATH, 'utf8');

let paChanged = false;
for (const [pkg, info] of entries) {
  const { fixedVersion, cveList } = info;

  // Look for existing entry in TARGETS: 'pkg': 'x.y.z',
  const escPkg = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const targetsRe = new RegExp(
    `'${escPkg}'\\s*:\\s*'([0-9][^']+)'`, 'g'
  );
  let m;
  let alreadyCovered = false;
  while ((m = targetsRe.exec(paSrc)) !== null) {
    if (semverGte(m[1], fixedVersion)) {
      alreadyCovered = true;
      break;
    }
  }
  if (alreadyCovered) {
    console.log(`[auto-patch] patch-all.js TARGETS already covers ${pkg}>=${fixedVersion}`);
    continue;
  }

  // Replace existing version if present
  const replaceRe = new RegExp(
    `('${escPkg}'\\s*:\\s*)'([0-9][^']+)'`
  );
  if (replaceRe.test(paSrc)) {
    paSrc = paSrc.replace(replaceRe, `$1'${fixedVersion}'`);
    paChanged = true;
    console.log(`[auto-patch] patch-all.js: updated ${pkg} -> ${fixedVersion}`);
  } else {
    // Add new entry before closing }; of TARGETS
    const insertMarker = '  // <auto-patch-insert>';
    const newEntry = `  '${pkg}': '${fixedVersion}', // ${cveList.join(', ')}\n`;
    if (paSrc.includes(insertMarker)) {
      paSrc = paSrc.replace(insertMarker, `${newEntry}${insertMarker}`);
    } else {
      // fallback: insert before first closing };
      paSrc = paSrc.replace(
        /(const TARGETS = \{[^}]*)(\};)/,
        `$1  '${pkg}': '${fixedVersion}', // ${cveList.join(', ')}\n$2`
      );
    }
    paChanged = true;
    console.log(`[auto-patch] patch-all.js: added ${pkg} -> ${fixedVersion}`);
  }
}

if (paChanged) {
  fs.writeFileSync(PA_PATH, paSrc);
  console.log('[auto-patch] patch-all.js updated.');
}

// ----------------------------------------------------------------
// 5. Exit code
// ----------------------------------------------------------------
if (vpChanged || paChanged) {
  console.log('[auto-patch] Patches written. Trigger rebuild.');
  process.exit(2);
} else {
  console.log('[auto-patch] All vulnerabilities already covered. No changes.');
  process.exit(0);
}
