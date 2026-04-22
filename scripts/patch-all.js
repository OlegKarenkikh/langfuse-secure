'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TARGETS = {
  'tar':                      '7.5.11',
  'glob':                     '10.5.0',
  'fast-xml-parser':          '5.5.7',
  'rollup':                   '4.59.0',
  'serialize-javascript':     '7.0.5',
  'dompurify':                '3.4.1',
  'ajv':                      '8.18.0',
  'webpack':                  '5.105.4',
  'qs':                       '6.14.2',
  'axios':                    '1.13.5',
  'cross-spawn':              '7.0.6',
  'basic-ftp':                '5.2.0',
  'vite':                     '7.0.8',
  'diff':                     '8.0.3',
  'lodash':                   '4.18.0',
  'lodash-es':                '4.18.0',
  'flatted':                  '3.4.2',
  '@hono/node-server':        '1.19.14',
  '@smithy/config-resolver':  '4.4.6',
  'next':                     '16.1.7',
  'nodemailer':               '8.0.5',
  'effect':                   '3.20.0',
  'defu':                     '6.1.5',
  'langsmith':                '0.5.21',
};

// Packages replaced unconditionally (fork/patched builds — version equality does not mean same content)
// Key: package name, Value: directory name under /tmp/patches/
const FORCE_REPLACE = {
  'kysely': 'kysely',
};

// Multi-major: explicit majors only, no 'default' for undici (8.x+ untouched)
const MULTI_MAJOR = {
  'minimatch': {
    3: '9.0.7', 4: '9.0.7', 5: '9.0.7',
    6: '9.0.7', 7: '9.0.7', 8: '9.0.7',
    9: '9.0.7', 10: '10.2.4',
    default: '9.0.7',
  },
  // undici: no 'default' — 8.x and above are already safe, must not be downgraded
  'undici': {
    4: '6.24.0', 5: '6.24.0', 6: '6.24.0', 7: '7.1.0',
  },
  'brace-expansion': { 1: '1.1.13', 2: '2.0.3', 5: '5.0.5', default: '5.0.5' },
  'picomatch':       { 2: '2.3.2', 4: '4.0.4', default: '4.0.4' },
  // path-to-regexp: NO default — each major has its own safe version.
  // IMPORTANT: 6.x must stay at 6.x (Next.js 16 requires ^6, v8 breaks the API).
  // 7.x is fully vulnerable → bump to 8.0.0 minimum (8.4.0 for ReDoS fix).
  // Do NOT add a 'default' key here — unknown majors must be left untouched.
  'path-to-regexp':  { 0: '0.1.13', 1: '1.9.0', 3: '3.3.0', 6: '6.3.0', 7: '8.4.0', 8: '8.4.0' },
  'yaml':            { 1: '1.10.3', 2: '2.8.3', default: '2.8.3' },
};

// Detect node_modules root: Web uses /app/node_modules (Next.js standalone),
// Worker uses /app/worker/node_modules (yarn monorepo workspace)
const APP_NM_CANDIDATES = [
  '/app/node_modules',
  '/app/worker/node_modules',
  '/app/web/node_modules',
];
const APP_NM_ROOTS = APP_NM_CANDIDATES.filter(p => fs.existsSync(p));

// Primary root for pnpm store (only relevant for Web)
const PRIMARY_NM = APP_NM_ROOTS[0] || '/app/node_modules';
const PNPM_DIR = path.join(PRIMARY_NM, '.pnpm');
const PATCHES_DIR = '/tmp/patches';

function resolveTarget(name, ver) {
  if (MULTI_MAJOR[name]) {
    var map = MULTI_MAJOR[name];
    var t = (map[semverMajor(ver)] !== undefined) ? map[semverMajor(ver)] : map['default'];
    return t || null;
  }
  return TARGETS[name] || null;
}

function sourceKey(name, ver) {
  if (!MULTI_MAJOR[name]) return name;
  return name + '@target-' + (resolveTarget(name, ver) || 'unknown');
}

// walk: follow symlinks one level so pnpm virtual-store symlinks are visible.
function walk(dir, results, _depth) {
  results = results || [];
  _depth = _depth || 0;
  var entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return results; }
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    var full = path.join(dir, e.name);
    if (e.isSymbolicLink()) {
      if (_depth > 0) continue;
      var real;
      try { real = fs.realpathSync(full); } catch (_) { continue; }
      var stat;
      try { stat = fs.statSync(real); } catch (_) { continue; }
      if (stat.isDirectory()) walk(real, results, _depth + 1);
      continue;
    }
    if (e.isDirectory()) walk(full, results, _depth);
    else if (e.isFile() && e.name === 'package.json') results.push(full);
  }
  return results;
}

function semverGte(a, b) {
  var pa = String(a).replace(/[^0-9.]/g,'').split('.').map(Number);
  var pb = String(b).replace(/[^0-9.]/g,'').split('.').map(Number);
  for (var i = 0; i < 3; i++) { var d = (pa[i]||0) - (pb[i]||0); if (d) return d > 0; }
  return true;
}
function semverMajor(v) { return parseInt(String(v).split('.')[0], 10) || 0; }

function cpDir(src, dst) {
  try { execSync('chmod 755 ' + JSON.stringify(path.dirname(dst))); } catch (_) {}
  fs.mkdirSync(dst, { recursive: true });
  try { fs.chmodSync(dst, 0o755); } catch (_) {}
  var entries;
  try { entries = fs.readdirSync(src, { withFileTypes: true }); } catch (_) { return; }
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (e.isSymbolicLink()) continue;
    var s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { cpDir(s, d); }
    else { try { fs.unlinkSync(d); } catch(_){} fs.copyFileSync(s, d); try { fs.chmodSync(d, 0o644); } catch(_){} }
  }
}

function isTracked(name) { return !!TARGETS[name] || !!MULTI_MAJOR[name]; }

console.log('APP_NM roots detected:', APP_NM_ROOTS);
for (var r = 0; r < APP_NM_ROOTS.length; r++) {
  try { execSync('chmod -R 755 ' + JSON.stringify(APP_NM_ROOTS[r]), { stdio: 'inherit' }); } catch (e) { console.log('chmod warn:', e.message); }
}

// ── Step 0: FORCE_REPLACE — unconditional fork replacements ──────────────────
console.log('step0: force-replace (fork packages)...');
var forceReplaced = 0;
var frNames = Object.keys(FORCE_REPLACE);
for (var fi = 0; fi < frNames.length; fi++) {
  var frName = frNames[fi];
  var frPatchDir = path.join(PATCHES_DIR, FORCE_REPLACE[frName]);
  if (!fs.existsSync(frPatchDir)) {
    console.log('  WARN: patch dir not found for', frName, '->', frPatchDir);
    continue;
  }
  for (var r = 0; r < APP_NM_ROOTS.length; r++) {
    var pkgJsons = walk(APP_NM_ROOTS[r]);
    for (var pi = 0; pi < pkgJsons.length; pi++) {
      try {
        var pkg = JSON.parse(fs.readFileSync(pkgJsons[pi], 'utf8'));
        if (pkg.name !== frName) continue;
        var dst = path.dirname(pkgJsons[pi]);
        if (dst === frPatchDir) continue;
        console.log('  force-replacing', dst, '(v' + pkg.version + ') <- fork', frPatchDir);
        cpDir(frPatchDir, dst);
        forceReplaced++;
      } catch (_) {}
    }
  }
  if (fs.existsSync(PNPM_DIR)) {
    var pnpmEntries = fs.readdirSync(PNPM_DIR);
    for (var pi = 0; pi < pnpmEntries.length; pi++) {
      var entry = pnpmEntries[pi];
      if (!entry.startsWith(frName + '@')) continue;
      var entryPath = path.join(PNPM_DIR, entry);
      var innerPkg = path.join(entryPath, 'node_modules', frName);
      if (fs.existsSync(innerPkg)) {
        console.log('  force-replacing pnpm store inner:', innerPkg);
        cpDir(frPatchDir, innerPkg);
        forceReplaced++;
      } else {
        var innerPkgJson = path.join(entryPath, 'package.json');
        if (fs.existsSync(innerPkgJson)) {
          try {
            var ep = JSON.parse(fs.readFileSync(innerPkgJson, 'utf8'));
            if (ep.name === frName) {
              console.log('  force-replacing pnpm store flat:', entryPath);
              cpDir(frPatchDir, entryPath);
              forceReplaced++;
            }
          } catch (_) {}
        }
      }
    }
  }
}
console.log('step0 done, force-replaced:', forceReplaced);

var allPkgJsons = [];
for (var r = 0; r < APP_NM_ROOTS.length; r++) allPkgJsons = allPkgJsons.concat(walk(APP_NM_ROOTS[r]));
var sources = {};

function registerSource(pkgJsonPath) {
  try {
    var pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    var name = pkg.name, ver = pkg.version || '';
    if (!name || !isTracked(name)) return;
    var target = resolveTarget(name, ver);
    if (!target || !semverGte(ver, target)) return;
    var key = sourceKey(name, ver);
    var dir = path.dirname(pkgJsonPath);
    if (!sources[key] || semverGte(ver, sources[key].ver))
      sources[key] = { dir: dir, ver: ver };
  } catch (_) {}
}

for (var i = 0; i < allPkgJsons.length; i++) registerSource(allPkgJsons[i]);

if (fs.existsSync(PATCHES_DIR)) {
  var extPkgs = walk(PATCHES_DIR);
  for (var i = 0; i < extPkgs.length; i++) registerSource(extPkgs[i]);
}

console.log('Sources found:');
var sk = Object.keys(sources);
for (var i = 0; i < sk.length; i++) console.log(' ', sk[i], sources[sk[i]].ver, '->', sources[sk[i]].dir);

var patched = 0;
for (var i = 0; i < allPkgJsons.length; i++) {
  try {
    var pkg = JSON.parse(fs.readFileSync(allPkgJsons[i], 'utf8'));
    var name = pkg.name, ver = pkg.version || '';
    if (!name || !isTracked(name)) continue;
    var target = resolveTarget(name, ver);
    if (!target) continue;
    if (semverGte(ver, target)) continue;
    var key = sourceKey(name, ver);
    if (!sources[key]) {
      console.log('no-source (version-patch will handle):', name, ver, '->', target);
      continue;
    }
    var dst = path.dirname(allPkgJsons[i]);
    var src = sources[key].dir;
    if (dst === src) continue;
    console.log('patching', dst, ver, '->', sources[key].ver);
    cpDir(src, dst);
    patched++;
  } catch (e) { console.log('patch error', e.message); }
}
console.log('step2 done, dirs patched:', patched);
console.log('step3: deferred to version-patch.js');

// step4: rename pnpm store entries AND overwrite file contents with patched source.
if (fs.existsSync(PNPM_DIR)) {
  var pnpmEntries = fs.readdirSync(PNPM_DIR);
  var renamed = 0;
  for (var i = 0; i < pnpmEntries.length; i++) {
    var entry = pnpmEntries[i];
    var match = entry.match(/^(@[^+]+\+)?([^@]+)@([^_]+)(.*)$/);
    if (!match) continue;
    var scope = match[1] || '', pkgBase = match[2], curVer = match[3], suffix = match[4] || '';
    var pkgName = scope
      ? '@' + scope.replace(/^@/,'').replace(/\+$/,'').replace(/\+/,'/') + '/' + pkgBase
      : pkgBase;

    var target = resolveTarget(pkgName, curVer);
    if (!target) continue;
    if (semverGte(curVer, target)) continue;
    if (pkgName === '@smithy/config-resolver' && semverGte(curVer, target)) continue;

    var oldPath = path.join(PNPM_DIR, entry);
    var newEntry = (scope || '') + pkgBase + '@' + target + suffix;
    var newPath = path.join(PNPM_DIR, newEntry);

    if (fs.existsSync(newPath)) {
      console.log('rename-pnpm: target exists, removing old', entry);
      fs.rmSync(oldPath, { recursive: true, force: true });
    } else {
      console.log('rename-pnpm:', entry, '->', newEntry);
      try { execSync('chmod 755 ' + JSON.stringify(PNPM_DIR)); } catch(_){}
      cpDir(oldPath, newPath);
      fs.rmSync(oldPath, { recursive: true, force: true });
    }
    renamed++;

    var patchKey = sourceKey(pkgName, curVer);
    var patchSrc = sources[patchKey] ? sources[patchKey].dir : null;
    if (patchSrc) {
      var innerDst = path.join(newPath, 'node_modules', pkgName);
      if (!fs.existsSync(innerDst)) innerDst = newPath;
      console.log('rename-pnpm: overwriting contents of', innerDst, 'with', patchSrc);
      cpDir(patchSrc, innerDst);
    } else {
      console.log('rename-pnpm: WARN no patch source for', pkgName, curVer, '-> target', target);
    }

    var symlinkPath = path.join(PRIMARY_NM, pkgName);
    try {
      var stat = fs.lstatSync(symlinkPath);
      if (stat.isSymbolicLink()) {
        var lnk = fs.readlinkSync(symlinkPath);
        if (lnk.includes(entry)) {
          fs.unlinkSync(symlinkPath);
          fs.symlinkSync(lnk.replace(entry, newEntry), symlinkPath);
          console.log('rename-pnpm: updated symlink', symlinkPath, '->', lnk.replace(entry, newEntry));
        }
      }
    } catch(_){}
  }
  console.log('step4 rename-pnpm done, renamed:', renamed);
} else {
  console.log('step4: no .pnpm dir (yarn/npm flat install), skipping rename-pnpm');
}

console.log('patch-all DONE');
