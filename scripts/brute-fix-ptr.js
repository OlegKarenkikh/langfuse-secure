'use strict';
// Brute-force fix: overwrite every real path-to-regexp 0.1.x directory
// in the .pnpm store with the patched 0.1.13 source from /tmp/patches.
// This runs AFTER patch-all.js and is the final guarantee that the
// vulnerable 0.1.x version (with module.exports = pathToRegexp function)
// is replaced by 0.1.13 (which also exports module.exports = pathToRegexp
// but with the ReDoS fix applied).
//
// Why a separate script instead of inline node -e:
// Docker treats every newline in a RUN heredoc as a potential instruction;
// multi-line node -e strings cause "unknown instruction" parse errors.

var fs = require('fs');
var path = require('path');

var SRC = '/tmp/patches/path-to-regexp-0.1.13';
if (!fs.existsSync(SRC)) {
  console.log('SKIP: patch source not found:', SRC);
  process.exit(0);
}

function cpDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  var entries = fs.readdirSync(src, { withFileTypes: true });
  entries.forEach(function (e) {
    if (e.isSymbolicLink()) return;
    var s = path.join(src, e.name);
    var d = path.join(dst, e.name);
    if (e.isDirectory()) {
      cpDir(s, d);
    } else {
      try { fs.unlinkSync(d); } catch (_) {}
      fs.copyFileSync(s, d);
    }
  });
}

function walk(dir) {
  var results = [];
  var entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return results; }
  entries.forEach(function (e) {
    if (e.isSymbolicLink()) return; // skip symlinks — only real dirs
    var full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results = results.concat(walk(full));
    } else if (e.isFile() && e.name === 'package.json') {
      results.push(full);
    }
  });
  return results;
}

var PNPM_DIR = '/app/node_modules/.pnpm';
if (!fs.existsSync(PNPM_DIR)) {
  console.log('SKIP: no .pnpm dir at', PNPM_DIR);
  process.exit(0);
}

console.log('brute-fix-ptr: scanning', PNPM_DIR);
var all = walk(PNPM_DIR);
var fixed = 0;

all.forEach(function (pkgJson) {
  var dir = path.dirname(pkgJson);
  if (path.basename(dir) !== 'path-to-regexp') return;

  var pkg;
  try { pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8')); } catch (_) { return; }
  if (pkg.name !== 'path-to-regexp') return;

  var ver = String(pkg.version || '');
  var m = ver.match(/^0\.1\.(\d+)$/);
  if (!m) return;
  if (parseInt(m[1], 10) >= 13) return;

  console.log('brute-fix-ptr: overwriting', dir, '(v' + ver + ') with 0.1.13');
  try {
    cpDir(SRC, dir);
    fixed++;
  } catch (e) {
    console.log('brute-fix-ptr: ERROR on', dir, e.message);
  }
});

console.log('brute-fix-ptr: done, fixed', fixed, 'dirs');
