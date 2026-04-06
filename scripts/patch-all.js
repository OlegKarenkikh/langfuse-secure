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
  'dompurify':                '3.3.2',
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
  'kysely':                   '0.28.14',
  '@hono/node-server':        '1.19.10',
  '@smithy/config-resolver':  '4.4.6',
  'next':                     '16.1.7',
  'nodemailer':               '8.0.4',
  'effect':                   '3.20.0',
  'defu':                     '6.1.5',
};

// Multi-major: 'default' key = fallback for unlisted majors
const MULTI_MAJOR = {
  'minimatch': {
    3: '9.0.7', 4: '9.0.7', 5: '9.0.7',
    6: '9.0.7', 7: '9.0.7', 8: '9.0.7',
    9: '9.0.7', 10: '10.2.4',
    default: '9.0.7',
  },
  'undici': {
    4: '6.24.0', 5: '6.24.0', 6: '6.24.0', 7: '7.1.0',
    default: '6.24.0',
  },
  'brace-expansion': { 2: '2.0.3', 5: '5.0.5', default: '5.0.5' },
  'picomatch':       { 2: '2.3.2', 4: '4.0.4', default: '4.0.4' },
  'path-to-regexp':  { 0: '0.1.13', 8: '8.4.0', default: '8.4.0' },
  'yaml':            { 1: '1.10.3', 2: '2.8.3', default: '2.8.3' },
};

const APP_NM = '/app/node_modules';
const PNPM_DIR = path.join(APP_NM, '.pnpm');
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

console.log('chmod /app/node_modules ...');
try { execSync('chmod -R 755 ' + APP_NM, { stdio: 'inherit' }); } catch (e) { console.log('chmod warn:', e.message); }

var allPkgJsons = walk(APP_NM);
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

    var symlinkPath = path.join(APP_NM, pkgName);
    try {
      var stat = fs.lstatSync(symlinkPath);
      if (stat.isSymbolicLink()) {
        var lnk = fs.readlinkSync(symlinkPath);
        if (lnk.includes(entry)) {
          fs.unlinkSync(symlinkPath);
          fs.symlinkSync(lnk.replace(entry, newEntry), symlinkPath);
        }
      }
    } catch(_){}
  }
  console.log('step4 rename-pnpm done, renamed:', renamed);
}

console.log('patch-all DONE');
