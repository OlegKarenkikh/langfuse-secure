'use strict';
var fs = require('fs');
var path = require('path');

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

console.log('=== DIAG: path-to-regexp versions after patching ===');
var all = walk('/app');
var found = [];
for (var i = 0; i < all.length; i++) {
  try {
    var pkg = JSON.parse(fs.readFileSync(all[i], 'utf8'));
    if (pkg.name === 'path-to-regexp') {
      found.push({ ver: pkg.version, p: all[i] });
    }
  } catch (_) {}
}
found.sort(function(a, b) { return a.ver > b.ver ? 1 : -1; });
for (var j = 0; j < found.length; j++) {
  console.log('  ' + found[j].ver + '  ' + found[j].p);
}
console.log('=== DIAG END (' + found.length + ' copies) ===');
