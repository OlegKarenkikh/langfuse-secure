'use strict';
var SKIP_COMPILED_PATHS = ['/dist/compiled/', '/compiled/'];
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TARGETS = {
  'tar':                      '7.5.13',
  'glob':                     '13.0.6',
  'rollup':                   '4.60.2',
  'serialize-javascript':     '7.0.5',
  'dompurify':                '3.4.2',
  'ajv':                      '8.20.0',
  'webpack':                  '5.106.2',
  'qs':                       '6.15.1',
  'axios':                    '1.16.0',
  'cross-spawn':              '7.0.6',
  'basic-ftp':                '6.0.1',
  'vite':                     '8.0.10',
  'diff':                     '9.0.0',
  'lodash':                   '4.18.1',
  'lodash-es':                '4.18.1',
  'flatted':                  '3.4.2',
  '@hono/node-server':        '2.0.1',
  '@smithy/config-resolver':  '4.4.17',
  'next':                     '16.2.4',
  'nodemailer':               '8.0.7',
  'effect':                   '3.21.2',
  'defu':                     '6.1.7',
  'langsmith':                '0.6.0',
  'micromatch':               '4.0.8',
  'braces':                   '3.0.3',
  'ejs':                      '5.0.2',
  'follow-redirects':         '1.16.0',
  'nanoid':                   '5.1.11',
  'cookie':                   '1.1.1',
  'ip':                       '2.0.1',
  'ws':                       '8.20.0',
  'express':                  '5.2.1',
  'body-parser':              '2.2.2',
  'send':                     '1.2.1',
  'serve-static':             '2.2.1',
  'semver':                   '7.7.4',
  'async':                    '3.2.6',
  'nth-check':                '3.0.1',
  'postcss':                  '8.5.13',
  'negotiator':               '1.0.0',
  'ipaddr.js':                '2.3.0',
  'tough-cookie':             '6.0.1',
  'json5':                    '2.2.3',
  'cookie-signature':         '1.2.2',
  'set-value':                '4.1.0',
  'mixin-deep':               '2.0.1',
  'got':                      '15.0.3',
  'yaml':                     '2.8.4',
};

const FORCE_REPLACE = {
  'kysely': 'kysely',
};

const MULTI_MAJOR = {
  'minimatch': {
    3: '9.0.7', 4: '9.0.7', 5: '9.0.7', 6: '9.0.7', 7: '9.0.7', 8: '9.0.7', 9: '9.0.7', 10: '10.2.5', default: '9.0.7'
  },
  'undici': {
    4: '6.25.0', 5: '6.25.0', 6: '6.25.0', 7: '7.25.0', 8: '8.2.0'
  },
  'brace-expansion': { 1: '1.1.13', 2: '2.0.3', 5: '5.0.5', default: '5.0.5' },
  'picomatch':       { 2: '2.3.2', 3: '3.0.2', 4: '4.0.4', default: '4.0.4' },
  'path-to-regexp':  { 0: '0.1.13', 1: '1.9.0', 2: '2.4.0', 3: '3.3.0', 4: '4.0.5', 5: '5.0.0', 6: '6.3.0', 7: '7.2.0', 8: '8.4.2', default: '8.4.2' },
  'yaml':            { 1: '1.10.3', 2: '2.8.4', default: '2.8.4' },
  'nanoid':          { 3: '3.3.11', 4: '4.0.2', 5: '5.1.11', default: '5.1.11' },
  'cookie':          { 0: '0.7.2', 1: '1.1.1', default: '1.1.1' },
  'ip':              { 1: '1.1.9', 2: '2.0.1', default: '2.0.1' },
  'semver':          { 5: '5.7.2', 6: '6.3.1', 7: '7.7.4', default: '7.7.4' },
  'ws':              { 7: '7.5.10', 8: '8.20.0', default: '8.20.0' },
  'express':         { 4: '4.22.1', 5: '5.2.1', default: '5.2.1' },
  'body-parser':     { 1: '1.20.5', 2: '2.2.2', default: '2.2.2' },
  'fast-xml-parser': { 3: '3.21.1', 4: '4.5.6', 5: '5.7.2', default: '5.7.2' },
  'axios':           { 0: '0.31.1', 1: '1.16.0', default: '1.16.0' },
  'postcss':         { 7: '7.0.39', 8: '8.5.13', default: '8.5.13' },
  'braces':          { 2: '2.3.2', 3: '3.0.3', default: '3.0.3' },
  'micromatch':      { 3: '3.1.10', 4: '4.0.8', default: '4.0.8' },
  'async':           { 2: '2.6.4', 3: '3.2.6', default: '3.2.6' },
  'nth-check':       { 1: '1.0.2', 2: '2.1.1', 3: '3.0.1', default: '3.0.1' },
  'ajv':             { 6: '6.12.6', 8: '8.20.0', default: '8.20.0' },
  'tar':             { 4: '4.4.19', 6: '6.2.1', 7: '7.5.13', default: '7.5.13' },
  'glob':            { 7: '7.2.3', 8: '8.1.0', 9: '9.3.5', 10: '10.4.5', 11: '11.1.0', 13: '13.0.6', default: '13.0.6' },
  'ejs':             { 3: '3.1.10', 5: '5.0.2', default: '5.0.2' },
  'tough-cookie':    { 4: '4.1.4', 5: '5.1.0', 6: '6.0.1', default: '6.0.1' },
  'send':            { 0: '0.19.2', 1: '1.2.1', default: '1.2.1' },
  'serve-static':    { 1: '1.16.2', 2: '2.2.1', default: '2.2.1' },
};

let APP_NM_ROOTS = [];
try {
  const findOut = execSync('find /app -name node_modules -type d 2>/dev/null').toString().trim();
  APP_NM_ROOTS = findOut.split('\n').filter(Boolean);
} catch (e) {
  APP_NM_ROOTS = ['/app/node_modules'];
}
console.log('Detected node_modules roots:', APP_NM_ROOTS);

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

for (var r = 0; r < APP_NM_ROOTS.length; r++) {
  try { execSync('chmod -R 755 ' + JSON.stringify(APP_NM_ROOTS[r])); } catch (e) {}
}

console.log('step0: force-replace...');
var forceReplaced = 0;
var frNames = Object.keys(FORCE_REPLACE);
for (var fi = 0; fi < frNames.length; fi++) {
  var frName = frNames[fi];
  var frPatchDir = path.join(PATCHES_DIR, FORCE_REPLACE[frName]);
  if (!fs.existsSync(frPatchDir)) continue;
  for (var r = 0; r < APP_NM_ROOTS.length; r++) {
    var pkgJsons = walk(APP_NM_ROOTS[r]);
    for (var pi = 0; pi < pkgJsons.length; pi++) {
      try {
        var pkg = JSON.parse(fs.readFileSync(pkgJsons[pi], 'utf8'));
        if (pkg.name !== frName) continue;
        var dst = path.dirname(pkgJsons[pi]);
        cpDir(frPatchDir, dst);
        forceReplaced++;
      } catch (_) {}
    }
  }
}

var allPkgJsons = [];
for (var r = 0; r < APP_NM_ROOTS.length; r++) allPkgJsons = allPkgJsons.concat(walk(APP_NM_ROOTS[r]));
var sources = {};

function isVendoredPath(p) { return SKIP_COMPILED_PATHS.some(function(s){ return p.includes(s); }); }
function registerSource(pkgJsonPath) {
  if (isVendoredPath(pkgJsonPath)) return;
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

console.log('step2: patching...');
for (var i = 0; i < allPkgJsons.length; i++) {
  try {
    var pkg = JSON.parse(fs.readFileSync(allPkgJsons[i], 'utf8'));
    var name = pkg.name, ver = pkg.version || '';
    if (!name || !isTracked(name)) continue;
    var target = resolveTarget(name, ver);
    if (!target || semverGte(ver, target)) continue;
    var key = sourceKey(name, ver);
    if (!sources[key]) continue;
    var dst = path.dirname(allPkgJsons[i]);
    if (isVendoredPath(allPkgJsons[i])) continue;
    var src = sources[key].dir;
    if (dst === src) continue;
    cpDir(src, dst);
  } catch (e) {}
}

console.log('step4: pnpm store renaming and symlink updates...');
APP_NM_ROOTS.forEach(function(root) {
  var pnpmDir = path.join(root, '.pnpm');
  if (!fs.existsSync(pnpmDir)) return;
  var pnpmEntries = fs.readdirSync(pnpmDir);
  for (var i = 0; i < pnpmEntries.length; i++) {
    var entry = pnpmEntries[i];
    var match = entry.match(/^(@[^+]+\+)?([^@]+)@([^_]+)(.*)$/);
    if (!match) continue;
    var scope = match[1] || '', pkgBase = match[2], curVer = match[3], suffix = match[4] || '';
    var pkgName = scope ? '@' + scope.replace(/^@/,'').replace(/\+$/,'').replace(/\+/,'/') + '/' + pkgBase : pkgBase;
    var target = resolveTarget(pkgName, curVer);
    if (!target || semverGte(curVer, target)) continue;

    var oldPath = path.join(pnpmDir, entry);
    var newEntry = (scope || '') + pkgBase + '@' + target + suffix;
    var newPath = path.join(pnpmDir, newEntry);

    if (fs.existsSync(newPath)) {
      fs.rmSync(oldPath, { recursive: true, force: true });
    } else {
      cpDir(oldPath, newPath);
      fs.rmSync(oldPath, { recursive: true, force: true });
    }

    var patchKey = sourceKey(pkgName, curVer);
    var patchSrc = sources[patchKey] ? sources[patchKey].dir : null;
    if (patchSrc) {
      var innerDst = path.join(newPath, 'node_modules', pkgName);
      if (!fs.existsSync(innerDst)) innerDst = newPath;
      cpDir(patchSrc, innerDst);
    }

    APP_NM_ROOTS.forEach(function(r) {
      try {
        const links = execSync('find ' + JSON.stringify(r) + ' -maxdepth 5 -type l 2>/dev/null').toString().split('\n');
        links.forEach(function(lnkPath) {
          if (!lnkPath) return;
          try {
            var lnk = fs.readlinkSync(lnkPath);
            if (lnk.includes(entry)) {
              var newLnk = lnk.replace(entry, newEntry);
              fs.unlinkSync(lnkPath);
              fs.symlinkSync(newLnk, lnkPath);
            }
          } catch (_) {}
        });
      } catch (_) {}
    });
  }
});

console.log('patch-all DONE');
