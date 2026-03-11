'use strict';
const fs = require('fs');
const path = require('path');

const TARGET = {
  'tar':                  '7.5.11',
  'glob':                 '10.5.0',
  'minimatch':            '10.2.4',
  'dompurify':            '3.3.2',
  'ajv':                  '8.18.0',
  'webpack':              '5.105.4',
  'vite':                 '7.0.8',
  'undici':               '6.23.0',
  'diff':                 '8.0.3',
  'lodash-es':            '4.17.23',
  'fast-xml-parser':      '5.3.8',
  'axios':                '1.13.5',
  'rollup':               '4.59.0',
  'serialize-javascript': '7.0.3',
  'qs':                   '6.14.2',
  'brace-expansion':      '2.0.2',
  'cross-spawn':          '7.0.6',
  'basic-ftp':            '5.2.0',
};

const TARGET_V9 = { 'minimatch': '9.0.7' };

const PNPM_DIR = '/app/node_modules/.pnpm';

function resolveTarget(pkgName, currentVer) {
  if (pkgName === 'minimatch') {
    if (currentVer && currentVer.startsWith('9.')) return TARGET_V9['minimatch'];
    return TARGET['minimatch'];
  }
  return TARGET[pkgName] || null;
}

// Рекурсивно выставляем u+rwx на дерево
function chmodR(dir) {
  try { fs.chmodSync(dir, 0o755); } catch (_) {}
  var entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (e.isSymbolicLink()) continue;
    var full = path.join(dir, e.name);
    if (e.isDirectory()) chmodR(full);
    else { try { fs.chmodSync(full, 0o644); } catch (_) {} }
  }
}

function moveDirCrossDevice(src, dest) {
  // Снимаем защиту с обоих деревьев перед копированием
  chmodR(src);
  if (fs.existsSync(dest)) chmodR(dest);
  fs.cpSync(src, dest, { recursive: true, force: true, dereference: false });
  fs.rmSync(src, { recursive: true, force: true });
}

if (!fs.existsSync(PNPM_DIR)) {
  console.log('rename-pnpm-dirs: .pnpm dir not found, skip');
  process.exit(0);
}

const entries = fs.readdirSync(PNPM_DIR);
var renamed = 0;

for (var i = 0; i < entries.length; i++) {
  var entry = entries[i];
  var match = entry.match(/^(@[^+]+\+)?([^@]+)@(.+)$/);
  if (!match) continue;

  var scope  = match[1] || '';
  var name   = match[2];
  var curVer = match[3];

  var pkgName = scope
    ? '@' + scope.replace(/^@/, '').replace(/\+$/, '').replace(/\+/, '/') + '/' + name
    : name;

  var target = resolveTarget(pkgName, curVer);
  if (!target || curVer === target) continue;

  var oldPath = path.join(PNPM_DIR, entry);
  var newEntry = entry.replace('@' + curVer, '@' + target);
  var newPath  = path.join(PNPM_DIR, newEntry);

  if (fs.existsSync(newPath)) {
    console.log('rename-pnpm-dirs: target exists, removing old', entry);
    chmodR(oldPath);
    fs.rmSync(oldPath, { recursive: true, force: true });
  } else {
    console.log('rename-pnpm-dirs:', entry, '->', newEntry);
    moveDirCrossDevice(oldPath, newPath);
  }
  renamed++;

  var symlinkPath = pkgName.includes('/')
    ? path.join('/app/node_modules', pkgName)
    : path.join('/app/node_modules', name);

  try {
    if (fs.existsSync(symlinkPath)) {
      var stat = fs.lstatSync(symlinkPath);
      if (stat.isSymbolicLink()) {
        var linkTarget = fs.readlinkSync(symlinkPath);
        if (linkTarget.includes(entry)) {
          var newLinkTarget = linkTarget.replace(entry, newEntry);
          fs.unlinkSync(symlinkPath);
          fs.symlinkSync(newLinkTarget, symlinkPath);
          console.log('rename-pnpm-dirs: symlink updated', symlinkPath);
        }
      }
    }
  } catch (e) {
    console.log('rename-pnpm-dirs: symlink update skip', symlinkPath, e.message);
  }
}

console.log('rename-pnpm-dirs done, renamed:', renamed);
