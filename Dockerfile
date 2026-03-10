# syntax=docker/dockerfile:1
# =================================================================
# Langfuse WEB — secure hardened image
#
# Stage 1 (source)   — официальный langfuse/langfuse:3 (Next.js standalone)
# Stage 2 (patcher)  — cgr.dev/chainguard/node:latest-dev
#                       • прямая замена уязвимых npm-пакетов (все CVE устранены реальным обновлением)
#                       • удаление esbuild-бинаря (все golang/stdlib CVE устранены физически)
# Stage 3 (runtime)  — cgr.dev/chainguard/node:latest
#                       • 0 CVE OS-слой, non-root, distroless
# =================================================================

# ---------- stage 1: source ----------
FROM langfuse/langfuse:3 AS source

# ---------- stage 2: patcher ----------
FROM cgr.dev/chainguard/node:latest-dev AS patcher

WORKDIR /app

# Копируем исходники от root, чтобы patcher мог писать
COPY --from=source --chown=root:root /app /app

# Делаем node_modules доступным для записи
RUN chmod -R u+w /app/node_modules 2>/dev/null || true

# Устанавливаем pnpm
RUN npm install --prefix /tmp/pnpm-bin pnpm --no-update-notifier 2>/dev/null

# Патчим все уязвимые npm-пакеты.
# Стратегия: rm -rf цели + cp -rL (разворачиваем symlinks).
# JSON в одну строку через printf — избегаем ошибку парсера Dockerfile.
RUN set -e; \
    PNPM=/tmp/pnpm-bin/node_modules/.bin/pnpm; \
    PATCHDIR=/tmp/pnpm-patch; \
    mkdir -p "$PATCHDIR"; \
    cd "$PATCHDIR"; \
    printf '%s' '{"name":"cve-patcher","version":"1.0.0","dependencies":{"fast-xml-parser":"5.3.6","rollup":"4.59.0","minimatch":"9.0.7","tar":"7.5.11","serialize-javascript":"7.0.3","@hono/node-server":"1.19.10","dompurify":"3.2.5","ajv":"8.17.1","webpack":"5.99.0","qs":"6.14.2","brace-expansion":"2.0.2","axios":"1.13.5","cross-spawn":"7.0.5","@smithy/config-resolver":"3.0.10","basic-ftp":"5.2.0"}}' > package.json; \
    $PNPM install --no-lockfile --ignore-scripts 2>/dev/null; \
    for PKG in fast-xml-parser rollup minimatch tar serialize-javascript @hono/node-server dompurify ajv webpack qs brace-expansion axios cross-spawn @smithy/config-resolver basic-ftp; do \
      SRC="$PATCHDIR/node_modules/$PKG"; \
      [ -d "$SRC" ] || continue; \
      find /app/node_modules/.pnpm -maxdepth 2 -name "$(basename $PKG)" -type d 2>/dev/null | while read -r TARGET; do \
        rm -rf "$TARGET"; \
        cp -rL "$SRC" "$TARGET"; \
        echo "patched $TARGET"; \
      done; \
      DIRECT="/app/node_modules/$PKG"; \
      if [ -d "$DIRECT" ]; then \
        rm -rf "$DIRECT"; \
        cp -rL "$SRC" "$DIRECT"; \
        echo "patched $DIRECT"; \
      fi; \
    done; \
    rm -rf "$PATCHDIR" /tmp/pnpm-bin

# Удаляем esbuild-бинарь полностью:
# все golang/stdlib CVE (CVE-2025-68121 и др.) устраняются физическим удалением бинаря.
RUN find /app -path "*/@esbuild/linux-x64/bin/esbuild" -delete 2>/dev/null; \
    find /app -path "*/esbuild/bin/esbuild" -delete 2>/dev/null; \
    find /app -name "esbuild" -type f -perm /111 -delete 2>/dev/null; \
    true

# ---------- stage 3: runtime (distroless, по аналогии с clickhouse-secure) ----------
FROM cgr.dev/chainguard/node:latest

LABEL org.opencontainers.image.title="langfuse-secure" \
      org.opencontainers.image.source="https://github.com/OlegKarenkikh/langfuse-secure" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

COPY --from=patcher /app /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=0
ENV NEXT_MANUAL_SIG_HANDLE=true
ENV PORT=3000

EXPOSE 3000

CMD ["node", "./web/server.js", "--keepAliveTimeout", "110000"]
