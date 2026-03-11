# syntax=docker/dockerfile:1
# =================================================================
# Langfuse WEB — secure hardened image
#
# Stage 1 (source)        — langfuse/langfuse:3 (Next.js standalone)
# Stage 2 (patcher-node)  — cgr.dev/chainguard/node:latest-dev
#                            • pnpm install патч-версий пакетов
# Stage 3 (patcher-rsync) — alpine:3.21 (только для rsync --copy-links)
#                            • rsync разворачивает симлинки pnpm store
#                            • удаляет esbuild + tsgo бинари
# Stage 4 (runtime)       — cgr.dev/chainguard/node:latest (0 CVE, distroless)
# =================================================================

# ---------- stage 1: source ----------
FROM langfuse/langfuse:3 AS source

# ---------- stage 2: patcher-node (pnpm install патчей) ----------
FROM cgr.dev/chainguard/node:latest-dev AS patcher-node

USER root
WORKDIR /app

COPY --from=source /app /app

# Открываем запись на весь /app
RUN chmod -R u+w /app

# Устанавливаем pnpm и скачиваем патч-версии
RUN npm install --prefix /tmp/pnpm-bin pnpm --no-update-notifier --quiet 2>/dev/null
RUN set -e; \
    PNPM=/tmp/pnpm-bin/node_modules/.bin/pnpm; \
    PATCHDIR=/tmp/pnpm-patch; \
    mkdir -p "$PATCHDIR" && cd "$PATCHDIR"; \
    printf '%s' '{"name":"cve-patcher","version":"1.0.0","dependencies":{"fast-xml-parser":"5.3.8","rollup":"4.59.0","minimatch":"9.0.7","tar":"7.5.11","serialize-javascript":"7.0.3","@hono/node-server":"1.19.10","dompurify":"3.3.2","ajv":"8.18.0","webpack":"5.105.4","qs":"6.14.2","brace-expansion":"2.0.2","axios":"1.13.5","cross-spawn":"7.0.6","basic-ftp":"5.2.0","@smithy/config-resolver":"4.4.10"}}' > package.json; \
    $PNPM install --no-lockfile --ignore-scripts --shamefully-hoist 2>/dev/null; \
    echo "pnpm install done"

# ---------- stage 3: patcher-rsync (alpine — rsync + patch) ----------
FROM alpine:3.21 AS patcher-rsync

RUN apk add --no-cache rsync

WORKDIR /app
COPY --from=patcher-node /app /app
COPY --from=patcher-node /tmp/pnpm-patch /tmp/pnpm-patch

# Патчим все вхождения уязвимых пакетов через rsync --copy-links --delete
RUN set -e; \
    PATCHDIR=/tmp/pnpm-patch; \
    patch_pkg() { \
      local PKG="$1"; \
      local SRC="$PATCHDIR/node_modules/$PKG"; \
      [ -d "$SRC" ] || { echo "SKIP $PKG (not in patchdir)"; return; }; \
      local BASENAME; BASENAME=$(basename "$PKG"); \
      find /app/node_modules/.pnpm -mindepth 3 -maxdepth 4 -type d -name "$BASENAME" 2>/dev/null | while read -r TARGET; do \
        echo "patching $TARGET"; \
        chmod -R u+w "$TARGET" 2>/dev/null || true; \
        rsync -a --copy-links --delete "$SRC/" "$TARGET/"; \
      done; \
      local DIRECT="/app/node_modules/$PKG"; \
      if [ -d "$DIRECT" ]; then \
        echo "patching direct $DIRECT"; \
        chmod -R u+w "$DIRECT" 2>/dev/null || true; \
        rsync -a --copy-links --delete "$SRC/" "$DIRECT/"; \
      fi; \
    }; \
    for P in fast-xml-parser rollup minimatch tar serialize-javascript dompurify ajv webpack qs brace-expansion axios cross-spawn basic-ftp; do patch_pkg "$P"; done; \
    patch_pkg "@hono/node-server"; \
    patch_pkg "@smithy/config-resolver"; \
    rm -rf "$PATCHDIR"

# Удаляем esbuild-бинарь (golang CVE) и tsgo (CVE-2025-68121)
RUN find /app -path "*/@esbuild/linux-x64/bin/esbuild" -delete 2>/dev/null; \
    find /app -path "*/esbuild/bin/esbuild" -delete 2>/dev/null; \
    find /app -name "esbuild" -type f -perm /111 -delete 2>/dev/null; \
    find /app -name "tsgo" -type f -perm /111 -delete 2>/dev/null; \
    true

# ---------- stage 4: runtime ----------
FROM cgr.dev/chainguard/node:latest

LABEL org.opencontainers.image.title="langfuse-secure" \
      org.opencontainers.image.source="https://github.com/OlegKarenkikh/langfuse-secure" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

COPY --from=patcher-rsync /app /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=0
ENV NEXT_MANUAL_SIG_HANDLE=true
ENV PORT=3000

EXPOSE 3000

CMD ["node", "./web/server.js", "--keepAliveTimeout", "110000"]
