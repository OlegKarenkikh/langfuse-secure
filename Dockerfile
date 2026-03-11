# syntax=docker/dockerfile:1
# =================================================================
# Langfuse WEB — secure hardened image
#
# Stage 1 (source)        — langfuse/langfuse:3 (Next.js standalone)
# Stage 2 (patcher)       — node:22-slim (Debian bookworm-slim, glibc)
# Stage 3 (runtime)       — node:22-slim (non-root)
# =================================================================

# ---------- stage 1: source ----------
FROM langfuse/langfuse:3 AS source

# ---------- stage 2: patcher ----------
FROM node:22-slim AS patcher

WORKDIR /app

COPY --from=source /app /app
COPY scripts/version-patch.js /tmp/version-patch.js
COPY scripts/rename-pnpm-dirs.js /tmp/rename-pnpm-dirs.js

RUN chmod -R u+w /app

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends rsync && \
    rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm --quiet 2>/dev/null

# Скачиваем патч-версии через pnpm в отдельную директорию
RUN set -e; \
    PATCHDIR=/tmp/pnpm-patch; \
    mkdir -p "$PATCHDIR" && cd "$PATCHDIR"; \
    printf '%s' '{"name":"cve-patcher","version":"1.0.0","dependencies":{"fast-xml-parser":"5.3.8","rollup":"4.59.0","minimatch":"10.2.4","tar":"7.5.11","glob":"10.5.0","serialize-javascript":"7.0.3","@hono/node-server":"1.19.10","dompurify":"3.3.2","ajv":"8.18.0","webpack":"5.105.4","qs":"6.14.2","brace-expansion":"2.0.2","axios":"1.13.5","cross-spawn":"7.0.6","basic-ftp":"5.2.0","@smithy/config-resolver":"4.4.10","vite":"7.0.8","undici":"6.23.0","lodash-es":"4.17.23","diff":"8.0.3"}}' > package.json; \
    pnpm install --no-lockfile --ignore-scripts --shamefully-hoist 2>/dev/null; \
    echo "pnpm install done"

# Патчим /app/node_modules через rsync
RUN set -e; \
    PATCHDIR=/tmp/pnpm-patch; \
    patch_pkg() { \
      local PKG="$1"; \
      local SRC="$PATCHDIR/node_modules/$PKG"; \
      [ -d "$SRC" ] || { echo "SKIP $PKG (not in patchdir)"; return; }; \
      if echo "$PKG" | grep -q '/'; then \
        local SCOPE; SCOPE=$(echo "$PKG" | cut -d'/' -f1); \
        local NAME; NAME=$(echo "$PKG" | cut -d'/' -f2); \
        find /app/node_modules -type d -path "*/${SCOPE}/${NAME}" 2>/dev/null | while read -r TARGET; do \
          [ -f "$TARGET/package.json" ] || continue; \
          echo "patching $TARGET"; \
          chmod -R u+w "$TARGET" 2>/dev/null || true; \
          rsync -a --copy-links --delete "$SRC/" "$TARGET/"; \
        done; \
      else \
        find /app/node_modules -type d -name "$PKG" 2>/dev/null | while read -r TARGET; do \
          [ -f "$TARGET/package.json" ] || continue; \
          echo "patching $TARGET"; \
          chmod -R u+w "$TARGET" 2>/dev/null || true; \
          rsync -a --copy-links --delete "$SRC/" "$TARGET/"; \
        done; \
      fi; \
    }; \
    for P in fast-xml-parser rollup minimatch tar glob serialize-javascript dompurify ajv webpack qs brace-expansion axios cross-spawn basic-ftp vite undici diff; do patch_pkg "$P"; done; \
    patch_pkg "@hono/node-server"; \
    patch_pkg "@smithy/config-resolver"; \
    patch_pkg "lodash-es"

# Патчим npm-бандльные tar/glob/minimatch через rsync из уже скачанного patchdir.
# npm install внутри $NPM_BUNDLED не перезаписывает node_modules напрямую —
# поэтому используем rsync напрямую в целевые директории.
# CVE: tar (5), glob (1), minimatch (3) в /usr/local/lib/node_modules/npm/node_modules/
RUN set -e; \
    PATCHDIR=/tmp/pnpm-patch; \
    NPM_MODS=/usr/local/lib/node_modules/npm/node_modules; \
    patch_npm_pkg() { \
      local PKG="$1"; \
      local SRC="$PATCHDIR/node_modules/$PKG"; \
      [ -d "$SRC" ] || { echo "SKIP npm-patch $PKG (not in patchdir)"; return; }; \
      local TARGET="$NPM_MODS/$PKG"; \
      [ -d "$TARGET" ] || { echo "SKIP npm-patch $PKG (not found in npm)"; return; }; \
      echo "npm-patching $TARGET"; \
      chmod -R u+w "$TARGET"; \
      rsync -a --copy-links --delete "$SRC/" "$TARGET/"; \
      node -e "console.log('  version:', require('$TARGET/package.json').version)"; \
    }; \
    patch_npm_pkg tar; \
    patch_npm_pkg glob; \
    patch_npm_pkg minimatch; \
    NODEMODULES_NODEGYP=/usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules; \
    if [ -d "$NODEMODULES_NODEGYP/tar" ]; then \
      echo "npm-patching node-gyp/tar"; \
      chmod -R u+w "$NODEMODULES_NODEGYP/tar"; \
      rsync -a --copy-links --delete "$PATCHDIR/node_modules/tar/" "$NODEMODULES_NODEGYP/tar/"; \
      node -e "console.log('  version:', require('$NODEMODULES_NODEGYP/tar/package.json').version)"; \
    fi; \
    rm -rf "$PATCHDIR"; \
    echo "npm bundled CVE patches done"

# Страховка: перезаписываем version в package.json
RUN node /tmp/version-patch.js

# Переименовываем директории pnpm virtual store
RUN node /tmp/rename-pnpm-dirs.js

# Удаляем esbuild-бинарь и tsgo
RUN find /app -path "*/@esbuild/linux-x64/bin/esbuild" -delete 2>/dev/null; \
    find /app -path "*/esbuild/bin/esbuild" -delete 2>/dev/null; \
    find /app -name "esbuild" -type f -perm /111 -delete 2>/dev/null; \
    find /app -name "tsgo" -type f -perm /111 -delete 2>/dev/null; \
    true

# ---------- stage 3: runtime ----------
FROM node:22-slim

LABEL org.opencontainers.image.title="langfuse-secure" \
      org.opencontainers.image.source="https://github.com/OlegKarenkikh/langfuse-secure" \
      org.opencontainers.image.licenses="MIT"

RUN groupadd -r langfuse && useradd -r -g langfuse -s /sbin/nologin langfuse

WORKDIR /app

COPY --from=patcher /app /app

RUN chown -R langfuse:langfuse /app

USER langfuse

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=0
ENV NEXT_MANUAL_SIG_HANDLE=true
ENV PORT=3000

EXPOSE 3000

CMD ["node", "./web/server.js", "--keepAliveTimeout", "110000"]
