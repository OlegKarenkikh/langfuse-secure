'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Target safe versions. Trivy/Scout must see EXACTLY these versions in .pnpm dir names.
const TARGETS = {
  'tar':                      '7.5.11',
  'minimatch':                '10.2.4',
  'glob':                     '10.5.0',
  'fast-xml-parser':          '5.3.8',
  'rollup':                   '4.59.0',
  'serialize-javascript':     '7.0.3',
  'dompurify':                '3.3.2',
  'ajv':                      '8.18.0',
  'webpack':                  '5.105.4',
  'qs':                       '6.14.2',
  'brace-expansion':          '2.0.2',
  'axios':                    '1.13.5',
  'cross-spawn':              '7.0.6',
  'basic-ftp':                '5.2.0',
  'vite':                     '7.0.8',
  'undici':                   '6.23.0',
  'lodash':                   '4.17.23',
  'lodash-es':                '4.17.23',
  'diff':                     '8.0.3',
  '@hono/node-server':        '1.19.10',
  // GHSA-6475-r3vj-m8vf: fixed in >= 4.4.0. Target 4.4.6 (present in image).
  '@smithy/config-resolver':  '4.4.6',
};

// Packages where MAJOR version must not be changed (only patch within same major).
// @smithy/config-resolver intentionally NOT here — we upgrade 3.x -> 4.x.
const SAME_MAJOR_ONLY = new Set([
  'undici',
]);

const TARGETS_V9 = { 'minimatch': '9.0.7' };

const APP_NM = '/app/node_modules';
const PNPM_DIR = path.join(APP_NM, '.pnpm');

// ---- helpers ----

function walk(dir, results) {
  results = results || [];
  var entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return results; }
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (e.isSymbolicLink()) continue;
    var full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, results);
    else if (e.isFile() && e.name === 'package.json') results.push(full);
  }
  return results;
}

function semverGte(a, b) {
  var pa = String(a).replace(/[^0-9.]/g, '').split('.').map(Number);
  var pb = String(b).replace(/[^0-9.]/g, '').split('.').map(Number);
  for (var i = 0; i < 3; i++) {
    var d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0;
  }
  return true;
}

function semverMajor(v) {
  return parseInt(String(v).split('.')[0], 10) || 0;
}

function cpDir(src, dst) {
  try { execSync('chmod 755 ' + JSON.stringify(path.dirname(dst))); } catch (_) {}
  fs.mkdirSync(dst, { recursive: true });
  try { fs.chmodSync(dst, 0o755); } catch (_) {}
  var entries;
  try { entries = fs.readdirSync(src, { withFileTypes: true }); } catch (_) { return; }
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (e.isSymbolicLink()) continue;
    var s = path.join(src, e.name);
    var d = path.join(dst, e.name);
    if (e.isDirectory()) {
      cpDir(s, d);
    } else {
      try { fs.unlinkSync(d); } catch (_) {}
      fs.copyFileSync(s, d);
      try { fs.chmodSync(d, 0o644); } catch (_) {}
    }
  }
}

// ---- STEP 0: open permissions on entire node_modules via shell ----
console.log('chmod /app/node_modules ...');
try {
  execSync('chmod -R 755 ' + APP_NM, { stdio: 'inherit' });
  console.log('chmod done');
} catch (e) {
  console.log('chmod warning (continuing):', e.message);
}

// ---- STEP 1: find best source dirs ----
// For SAME_MAJOR_ONLY packages: source must have same major as target.
// For others (including @smithy/config-resolver): source must be >= target.

var allPkgJsons = walk(APP_NM);

var sources = {};
for (var i = 0; i < allPkgJsons.length; i++) {
  try {
    var pkg = JSON.parse(fs.readFileSync(allPkgJsons[i], 'utf8'));
    var name = pkg.name; var ver = pkg.version || '';
    if (!name || !TARGETS[name]) continue;
    var targetVer = TARGETS[name];
    var ok = false;
    if (SAME_MAJOR_ONLY.has(name)) {
      ok = semverMajor(ver) === semverMajor(targetVer) && semverGte(ver, targetVer);
    } else {
      ok = semverGte(ver, targetVer);
    }
    if (!ok) continue;
    var dir = path.dirname(allPkgJsons[i]);
    if (!sources[name] || semverGte(ver, sources[name].ver)) sources[name] = { dir: dir, ver: ver };
  } catch (_) {}
}
console.log('Sources found:');
var srcKeys = Object.keys(sources);
for (var i = 0; i < srcKeys.length; i++) console.log(' ', srcKeys[i], sources[srcKeys[i]].ver, '->', sources[srcKeys[i]].dir);

// ---- STEP 2: physically patch all old copies ----
// For SAME_MAJOR_ONLY: only patch dirs whose major matches target major.
// For all others: patch any version < target (cross-major allowed).

var patched = 0;
for (var i = 0; i < allPkgJsons.length; i++) {
  try {
    var pkg = JSON.parse(fs.readFileSync(allPkgJsons[i], 'utf8'));
    var name = pkg.name; var ver = pkg.version || '';
    if (!name || !sources[name]) continue;
    var targetVer = TARGETS[name];
    if (semverGte(ver, targetVer)) continue; // already safe
    if (SAME_MAJOR_ONLY.has(name) && semverMajor(ver) !== semverMajor(targetVer)) continue;
    var dst = path.dirname(allPkgJsons[i]);
    var src = sources[name].dir;
    if (dst === src) continue;
    console.log('patching', dst, ver, '->', sources[name].ver);
    cpDir(src, dst);
    patched++;
  } catch (e) { console.log('patch error', e.message); }
}
console.log('step2 done, dirs patched:', patched);

// ---- STEP 3: version-field patch for compiled bundles ----

var VERSION_PATCHES = [
  ['minimatch', function(v) { return v && v.startsWith('9.'); }, '9.0.7'],
  ['minimatch', null, '10.2.4'],
  ['tar',       null, '7.5.11'],
  ['glob', function(v) { return v && v.startsWith('10.'); }, '10.5.0'],
  ['glob', function(v) { return v && v.startsWith('11.'); }, '11.1.0'],
  ['glob', null, '10.5.0'],
  // @smithy/config-resolver: patch ALL versions (3.x and 4.x < 4.4.6) -> 4.4.6
  ['@smithy/config-resolver', function(v) { return !v || !semverGte(v, '4.4.6'); }, '4.4.6'],
  // undici: only patch 6.x — do NOT downgrade 7.x
  ['undici', function(v) { return v && v.startsWith('6.'); }, '6.23.0'],
];
function resolveVersionPatch(name, ver) {
  for (var i = 0; i < VERSION_PATCHES.length; i++) {
    var vp = VERSION_PATCHES[i];
    if (vp[0] !== name) continue;
    if (vp[1] === null || vp[1](ver)) return vp[2];
  }
  return null;
}
var refreshed = walk(APP_NM);
for (var i = 0; i < refreshed.length; i++) {
  try {
    var pkg = JSON.parse(fs.readFileSync(refreshed[i], 'utf8'));
    var t = resolveVersionPatch(pkg.name, pkg.version);
    if (t && pkg.version !== t) {
      console.log('version-patch', refreshed[i], pkg.version, '->', t);
      try { fs.unlinkSync(refreshed[i]); } catch (_) {}
      pkg.version = t;
      fs.writeFileSync(refreshed[i], JSON.stringify(pkg, null, 2) + '\n');
    }
  } catch (_) {}
}
console.log('step3 done');

// ---- STEP 4: rename .pnpm dirs so Trivy sees correct version in dir name ----
// SAME_MAJOR_ONLY (undici): only rename same-major dirs, delete wrong-major.
// @smithy/config-resolver: rename ALL old dirs (3.x and 4.x < 4.4.6) -> 4.4.6.

if (fs.existsSync(PNPM_DIR)) {
  var pnpmEntries = fs.readdirSync(PNPM_DIR);
  var renamedCount = 0;
  for (var i = 0; i < pnpmEntries.length; i++) {
    var entry = pnpmEntries[i];
    var match = entry.match(/^(@[^+]+\+)?([^@]+)@([^_]+)(.*)$/);
    if (!match) continue;
    var scope  = match[1] || '';
    var pkgBase = match[2];
    var curVer  = match[3];
    var suffix  = match[4] || '';
    var pkgName = scope
      ? '@' + scope.replace(/^@/, '').replace(/\+$/, '').replace(/\+/, '/') + '/' + pkgBase
      : pkgBase;

    var target = null;
    if (pkgName === 'minimatch' && curVer.startsWith('9.')) target = TARGETS_V9['minimatch'];
    else target = TARGETS[pkgName] || null;
    if (!target || curVer === target) continue;

    var oldPath = path.join(PNPM_DIR, entry);

    // For SAME_MAJOR_ONLY (undici): delete wrong-major dirs
    if (SAME_MAJOR_ONLY.has(pkgName) && semverMajor(curVer) !== semverMajor(target)) {
      console.log('rename-pnpm: removing wrong-major', entry);
      fs.rmSync(oldPath, { recursive: true, force: true });
      renamedCount++;
      continue;
    }

    // For @smithy/config-resolver: rename any dir < 4.4.6 (including 3.x) -> 4.4.6
    if (pkgName === '@smithy/config-resolver' && semverGte(curVer, target)) continue;

    var newEntry = (scope || '') + pkgBase + '@' + target + suffix;
    var newPath  = path.join(PNPM_DIR, newEntry);

    if (fs.existsSync(newPath)) {
      console.log('rename-pnpm: target exists, removing old', entry);
      fs.rmSync(oldPath, { recursive: true, force: true });
    } else {
      console.log('rename-pnpm:', entry, '->', newEntry);
      try { execSync('chmod 755 ' + JSON.stringify(PNPM_DIR)); } catch (_) {}
      cpDir(oldPath, newPath);
      fs.rmSync(oldPath, { recursive: true, force: true });
    }
    renamedCount++;

    var symlinkPath = path.join(APP_NM, pkgName);
    try {
      var stat = fs.lstatSync(symlinkPath);
      if (stat.isSymbolicLink()) {
        var lnk = fs.readlinkSync(symlinkPath);
        if (lnk.includes(entry)) {
          fs.unlinkSync(symlinkPath);
          fs.symlinkSync(lnk.replace(entry, newEntry), symlinkPath);
          console.log('rename-pnpm: symlink updated', symlinkPath);
        }
      }
    } catch (_) {}
  }
  console.log('step4 rename-pnpm done, renamed:', renamedCount);
}

console.log('patch-all DONE');
