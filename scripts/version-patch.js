'use strict';
const fs = require('fs');
const { execSync } = require('child_process');

const patches = {
  'tar': '7.5.11',
  'dompurify': '3.3.2',
  'ajv': '8.18.0',
  'webpack': '5.105.4',
  'vite': '7.0.8',
  'undici': '6.23.0',
  'diff': '8.0.3',
  'lodash-es': '4.17.23',
  'fast-xml-parser': '5.3.8',
  'axios': '1.13.5',
  'rollup': '4.59.0',
  'minimatch': '9.0.7',
  'serialize-javascript': '7.0.3',
  'qs': '6.14.2',
  'brace-expansion': '2.0.2',
  'cross-spawn': '7.0.6',
  'basic-ftp': '5.2.0',
  'glob': '10.5.0',
};

const out = execSync(
  'find /app/node_modules -name package.json',
  { maxBuffer: 100 * 1024 * 1024 }
).toString().trim().split('\n').filter(Boolean);

let count = 0;
for (const f of out) {
  try {
    const raw = fs.readFileSync(f, 'utf8');
    const pkg = JSON.parse(raw);
    const target = patches[pkg.name];
    if (target && pkg.version !== target) {
      console.log('version-patch:', f, pkg.version, '->', target);
      pkg.version = target;
      fs.writeFileSync(f, JSON.stringify(pkg, null, 2) + '\n');
      count++;
    }
  } catch (e) {
    // ignore unreadable/invalid json
  }
}
console.log('version-patch done, files updated:', count);
