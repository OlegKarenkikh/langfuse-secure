
const https = require('https');
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const COMMIT = "c2990dca591cba766e3b7ef5d9e8a84796e47ab7";
const TARGET = "debian-openssl-3.0.x";
const ENGINE_NAME = "libquery_engine-" + TARGET + ".so.node";
const URL = "https://binaries.prisma.sh/all_commits/" + COMMIT + "/" + TARGET + "/libquery_engine.so.node.gz";

// Find .prisma/client directories
const { execSync } = require('child_process');
let dirs;
try {
  dirs = execSync('find /app -path "*/.prisma/client" -type d 2>/dev/null').toString().trim().split('\n').filter(Boolean);
} catch(e) { dirs = []; }

if (!dirs.length) {
  console.log('No .prisma/client dirs found - nothing to do');
  process.exit(0);
}

console.log('Downloading Prisma engine for', TARGET, 'to', dirs.length, 'locations...');

function download(url, dest, cb) {
  const gz = fs.createWriteStream(dest + '.gz');
  https.get(url, res => {
    if (res.statusCode !== 200) { cb(new Error('HTTP ' + res.statusCode)); return; }
    res.pipe(gz);
    gz.on('finish', () => {
      gz.close(() => {
        const inp = fs.createReadStream(dest + '.gz');
        const out = fs.createWriteStream(dest);
        const gunzip = zlib.createGunzip();
        inp.pipe(gunzip).pipe(out);
        out.on('finish', () => {
          fs.unlinkSync(dest + '.gz');
          fs.chmodSync(dest, 0o755);
          cb(null);
        });
        out.on('error', cb);
      });
    });
    gz.on('error', cb);
  }).on('error', cb);
}

const firstDest = path.join(dirs[0], ENGINE_NAME);
download(URL, firstDest, (err) => {
  if (err) { console.error('Download failed:', err.message); process.exit(1); }
  console.log('Downloaded:', firstDest, fs.statSync(firstDest).size, 'bytes');
  // Copy to remaining dirs
  for (let i = 1; i < dirs.length; i++) {
    const d = path.join(dirs[i], ENGINE_NAME);
    fs.copyFileSync(firstDest, d);
    fs.chmodSync(d, 0o755);
    console.log('Copied to:', d);
  }
  process.exit(0);
});
