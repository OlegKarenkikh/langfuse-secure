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

# ── kysely: olegkarenkikh/kysely fork (no protestware) ───
echo ">>> kysely from github:olegkarenkikh/kysely"
npm pack "github:olegkarenkikh/kysely" 2>/dev/null || {
  echo "WARN: npm pack failed, trying git clone..."
  cd /tmp
  git clone --depth 1 https://github.com/olegkarenkikh/kysely.git kysely-fork 2>/dev/null || true
  if [ -d kysely-fork ]; then
    cd kysely-fork
    npm install --ignore-scripts 2>/dev/null || true
    npm run build 2>/dev/null || true
    npm pack 2>/dev/null || true
    mv *.tgz "$PATCH_DIR/" 2>/dev/null || true
  fi
  cd "$PATCH_DIR"
}

# ── Unpack all tarballs ──────────────────────────────────
for tgz in *.tgz; do
  [ -f "$tgz" ] || continue
  d="${tgz%.tgz}"; mkdir -p "$d"
  tar xzf "$tgz" -C "$d" --strip-components=1
  rm -f "$tgz"
done
echo "=== Patches ready ===" && ls "$PATCH_DIR/"
