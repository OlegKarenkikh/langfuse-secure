#!/usr/bin/env bash
set -euo pipefail
PATCH_DIR=/tmp/patches; mkdir -p "$PATCH_DIR"; cd "$PATCH_DIR"
fetch(){ echo ">>> $1"; npm pack "$1" 2>/dev/null || echo "WARN: $1"; }

# ── npm registry packages ────────────────────────────────
fetch "lodash@4.18.0"
fetch "lodash-es@4.18.0"
fetch "fast-xml-parser@5.5.7"
fetch "flatted@3.4.2"
fetch "serialize-javascript@7.0.5"
fetch "brace-expansion@2.0.3"
fetch "brace-expansion@5.0.5"
fetch "picomatch@2.3.2"
fetch "picomatch@4.0.4"
fetch "path-to-regexp@0.1.13"
fetch "path-to-regexp@8.4.0"
fetch "next@16.1.7"
fetch "effect@3.20.0"
fetch "yaml@1.10.3"
fetch "yaml@2.8.3"
fetch "defu@6.1.5"
fetch "nodemailer@8.0.4"

# ── kysely: olegkarenkikh/kysely fork (protestware-free, same version 0.28.8) ─
# The fork has version=0.28.8 identical to upstream, so standard version-based
# patching would skip it. patch-all.js uses FORCE_REPLACE for unconditional copy.
# We need a built dist/ — clone, install (with devDeps for tsc), build, pack.
echo ">>> kysely fork: github:olegkarenkikh/kysely"
KYSELY_DIR="/tmp/kysely-fork-build"
rm -rf "$KYSELY_DIR"
git clone --depth 1 https://github.com/olegkarenkikh/kysely.git "$KYSELY_DIR" 2>&1
cd "$KYSELY_DIR"
# Install including devDependencies (TypeScript needed for build)
npm install 2>&1
npm run build 2>&1
# Pack and move to patches dir
npm pack 2>&1
TGZ=$(ls kysely-*.tgz 2>/dev/null | head -1)
if [ -n "$TGZ" ]; then
  mkdir -p "$PATCH_DIR/kysely"
  tar xzf "$TGZ" -C "$PATCH_DIR/kysely" --strip-components=1
  echo "kysely fork unpacked to $PATCH_DIR/kysely"
  ls "$PATCH_DIR/kysely/dist/" 2>/dev/null | head -5 || echo "WARN: dist/ missing"
else
  echo "WARN: kysely pack failed"
fi
cd "$PATCH_DIR"
rm -rf "$KYSELY_DIR"

# ── Unpack all remaining tarballs ───────────────────────
for tgz in *.tgz; do
  [ -f "$tgz" ] || continue
  d="${tgz%.tgz}"; mkdir -p "$d"
  tar xzf "$tgz" -C "$d" --strip-components=1
  rm -f "$tgz"
done
echo "=== Patches ready ===" && ls "$PATCH_DIR/"
