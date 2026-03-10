# syntax=docker/dockerfile:1
# =================================================================
# Langfuse WEB — secure hardened image
#
# Stage 1 (source)  — официальный langfuse/langfuse:3
# Stage 2 (patcher) — cgr.dev/chainguard/node:latest-dev
#                      • устанавливаем pnpm (локально, rootless)
#                      • апгрейдим уязвимые транзитивные зависимости
#                        через прямую замену в pnpm store
#                      • удаляем esbuild-бинарник (golang stdlib CVEs)
# Stage 3 (runtime) — cgr.dev/chainguard/node:latest
#                      • 0 CVE OS-слой, non-root, нет shell
# =================================================================

# ---------- stage 1: source ----------
FROM langfuse/langfuse:3 AS source

# ---------- stage 2: patcher ----------
FROM cgr.dev/chainguard/node:latest-dev AS patcher

WORKDIR /app
COPY --from=source /app /app

# Устанавливаем pnpm локально (без -g) — Chainguard rootless не даёт писать в /usr/local
RUN npm install --prefix /tmp/pnpm-bin pnpm --no-update-notifier 2>/dev/null

# Скачиваем fix-версии во временный каталог,
# затем перезаписываем каждое вхождение уязвимого пакета в /app/node_modules/.pnpm
RUN set -e && \
    PNPM=/tmp/pnpm-bin/node_modules/.bin/pnpm && \
    PATCH_DIR=/tmp/pnpm-patch && \
    mkdir -p "$PATCH_DIR" && \
    cd "$PATCH_DIR" && \
    echo '{"name":"cve-patcher","version":"1.0.0","dependencies":{"fast-xml-parser":"5.3.6","rollup":"4.59.0","minimatch":"9.0.7","tar":"7.5.10","serialize-javascript":"7.0.3","@hono/node-server":"1.19.10","dompurify":"3.2.5","ajv":"8.17.1","webpack":"5.99.0","qs":"6.14.2","brace-expansion":"2.0.2","axios":"1.13.5","cross-spawn":"7.0.5"}}' > package.json && \
    "$PNPM" install --no-lockfile --ignore-scripts 2>/dev/null && \
    for PKG_ESCAPED in \
        "fast-xml-parser@" \
        "rollup@" \
        "minimatch@" \
        "tar@" \
        "serialize-javascript@" \
        "@hono+node-server@" \
        "dompurify@" \
        "ajv@" \
        "webpack@" \
        "qs@" \
        "brace-expansion@" \
        "axios@" \
        "cross-spawn@"; \
    do \
        PKG_NAME=$(echo "$PKG_ESCAPED" | sed 's/@$//; s/+/\//g'); \
        SRC="$PATCH_DIR/node_modules/$PKG_NAME"; \
        [ -d "$SRC" ] || continue; \
        find /app/node_modules/.pnpm -maxdepth 1 -name "${PKG_ESCAPED}*" -type d | \
        while read -r PNPM_DIR; do \
            TARGET="$PNPM_DIR/node_modules/$PKG_NAME"; \
            if [ -d "$TARGET" ]; then \
                cp -rf "$SRC/" "$TARGET/" && echo "patched: $TARGET"; \
            fi; \
        done; \
    done && \
    rm -rf "$PATCH_DIR" /tmp/pnpm-bin

# Удаляем esbuild-бинарник (golang stdlib: CVE-2025-68121 и др.)
# esbuild нужен только на build-stage, в production runtime не используется
RUN find /app -path "*/@esbuild/linux-x64/bin/esbuild" -delete && \
    find /app -path "*/esbuild/bin/esbuild" -delete && \
    find /app -name "esbuild" -type f -perm /111 -delete

# ---------- stage 3: runtime ----------
FROM cgr.dev/chainguard/node:latest

WORKDIR /app

COPY --from=patcher /app /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=0
ENV NEXT_MANUAL_SIG_HANDLE=true
ENV PORT=3000

EXPOSE 3000

CMD ["node", "./web/server.js", "--keepAliveTimeout", "110000"]
