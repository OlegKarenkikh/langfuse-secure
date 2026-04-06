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
fetch "path-to-regexp@1.9.0"
fetch "path-to-regexp@6.3.0"
fetch "path-to-regexp@8.4.0"
fetch "next@16.1.7"
fetch "effect@3.20.0"
fetch "yaml@1.10.3"
fetch "yaml@2.8.3"
fetch "defu@6.1.5"
fetch "nodemailer@8.0.4"

# ── kysely: olegkarenkikh/kysely fork (protestware-free, same version 0.28.8) ──
# The fork has version=0.28.8 identical to upstream, so standard version-based
# patching would skip it. patch-all.js uses FORCE_REPLACE for unconditional copy.
#
# Build strategy:
#   - Clone with --depth 1
#   - npm install (installs TypeScript + other devDeps needed for tsc)
#   - Run tsc directly (build:esm + build:cjs) to avoid prepublishOnly/test:exports
#   - Copy built dist/ + package.json + helpers/ into patches dir
#   - Entire block runs with set +e so a build failure is non-fatal (WARN only)
echo ">>> kysely fork: github:olegkarenkikh/kysely"
(
  set +e
  KYSELY_DIR="/tmp/kysely-fork-build"
  rm -rf "$KYSELY_DIR"

  git clone --depth 1 https://github.com/olegkarenkikh/kysely.git "$KYSELY_DIR"
  if [ $? -ne 0 ]; then echo "WARN: kysely git clone failed"; exit 0; fi

  cd "$KYSELY_DIR"
  npm install
  if [ $? -ne 0 ]; then echo "WARN: kysely npm install failed"; exit 0; fi

  # Build ESM + CJS without triggering prepublishOnly / test:exports
  npx tsc -p tsconfig.json
  npx tsc -p tsconfig-cjs.json
  # module-fixup renames .js -> .mjs in ESM output (optional, best-effort)
  node scripts/module-fixup.js 2>/dev/null || true

  if [ ! -d "dist" ]; then
    echo "WARN: kysely dist/ not generated"
    exit 0
  fi

  # Copy built package to patches dir
  mkdir -p "$PATCH_DIR/kysely"
  cp -r dist       "$PATCH_DIR/kysely/dist"
  cp    package.json "$PATCH_DIR/kysely/package.json"
  cp -r helpers    "$PATCH_DIR/kysely/helpers" 2>/dev/null || true
  cp    outdated-typescript.d.ts "$PATCH_DIR/kysely/" 2>/dev/null || true

  echo "kysely fork built and staged:"
  ls "$PATCH_DIR/kysely/dist/" | head -10

  cd /tmp
  rm -rf "$KYSELY_DIR"
)

# ── Unpack all remaining tarballs ───────────────────────
for tgz in *.tgz; do
  [ -f "$tgz" ] || continue
  d="${tgz%.tgz}"; mkdir -p "$d"
  tar xzf "$tgz" -C "$d" --strip-components=1
  rm -f "$tgz"
done
echo "=== Patches ready ===" && ls "$PATCH_DIR/"
