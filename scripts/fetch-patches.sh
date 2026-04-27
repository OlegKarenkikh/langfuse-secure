#!/usr/bin/env bash
set -euo pipefail
PATCH_DIR=/tmp/patches; mkdir -p "$PATCH_DIR"; cd "$PATCH_DIR"
fetch(){ echo ">>> $1"; npm pack "$1" 2>/dev/null || echo "WARN: $1"; }

# ── npm registry packages ────────────────────────────────
fetch "lodash@4.18.1"
fetch "lodash-es@4.18.1"
fetch "fast-xml-parser@5.7.2"
fetch "flatted@3.4.2"
fetch "serialize-javascript@7.0.5"
fetch "brace-expansion@1.1.13"
fetch "brace-expansion@2.0.3"
fetch "brace-expansion@5.0.5"
fetch "picomatch@2.3.2"
fetch "picomatch@4.0.4"
fetch "path-to-regexp@0.1.13"
fetch "path-to-regexp@1.9.0"
fetch "path-to-regexp@6.3.0"
fetch "path-to-regexp@8.4.2"
fetch "next@16.2.4"
fetch "effect@3.21.2"
fetch "yaml@1.10.3"
fetch "yaml@2.8.3"
fetch "defu@6.1.7"
fetch "nodemailer@8.0.6"
fetch "axios@1.15.2"
fetch "@hono/node-server@2.0.0"
fetch "dompurify@3.4.1"
fetch "langsmith@0.5.25"
fetch "micromatch@4.0.8"
fetch "braces@3.0.3"
fetch "nanoid@3.3.11"
fetch "nanoid@4.0.2"
fetch "nanoid@5.1.9"
fetch "cookie@0.7.2"
fetch "cookie@1.1.1"
fetch "ip@1.1.9"
fetch "ip@2.0.1"
fetch "semver@5.7.2"
fetch "semver@6.3.1"
fetch "semver@7.7.4"
fetch "ws@7.5.10"
fetch "ws@8.20.0"
fetch "express@4.22.1"
fetch "express@5.2.1"
fetch "body-parser@1.20.5"
fetch "body-parser@2.2.2"

# ── kysely: use prebuilt fork (protestware-free olegkarenkikh/kysely 0.28.8) ──
# Pre-built outside Docker: dist/ already compiled, no git clone / npm install needed.
echo ">>> kysely fork: prebuilt (olegkarenkikh/kysely, no protest-code)"
KYSELY_SRC="/kysely-dist"
if [ -d "$KYSELY_SRC/dist" ]; then
  mkdir -p "$PATCH_DIR/kysely"
  cp -r "$KYSELY_SRC/dist"         "$PATCH_DIR/kysely/dist"
  cp    "$KYSELY_SRC/package.json" "$PATCH_DIR/kysely/package.json"
  echo "kysely staged from prebuilt:"
  ls "$PATCH_DIR/kysely/dist/" | head -4
else
  echo "WARN: /kysely-dist not found - kysely patching skipped"
fi

# ── Unpack all remaining tarballs ───────────────────────
for tgz in *.tgz; do
  [ -f "$tgz" ] || continue
  d="${tgz%.tgz}"; mkdir -p "$d"
  tar xzf "$tgz" -C "$d" --strip-components=1
  rm -f "$tgz"
done
echo "=== Patches ready ===" && ls "$PATCH_DIR/"
