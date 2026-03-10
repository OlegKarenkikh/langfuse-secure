# syntax=docker/dockerfile:1
# =================================================================
# Langfuse WEB — secure hardened image
#
# Stage 1 (source)   — официальный langfuse/langfuse:3 (Next.js standalone)
# Stage 2 (patcher)  — cgr.dev/chainguard/node:latest-dev
#                       • прямая замена уязвимых npm-пакетов через pnpm
#                       • удаление esbuild (dev-инструмент, CVE golang stdlib)
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

# Патчим уязвимые пакеты:
# Стратегия: скачиваем исправленные версии и делаем cp -rL (разворачиваем symlinks)
# Это обходит проблему Permission denied при создании symlinks поверх существующих
RUN set -e; \
    PNPM=/tmp/pnpm-bin/node_modules/.bin/pnpm; \
    PATCHDIR=/tmp/pnpm-patch; \
    mkdir -p "$PATCHDIR"; \
    cd "$PATCHDIR"; \
    echo '{"name":"cve-patcher","version":"1.0.0","dependencies":{
      "fast-xml-parser":"5.3.6",
      "rollup":"4.59.0",
      "minimatch":"9.0.7",
      "tar":"7.5.10",
      "serialize-javascript":"7.0.3",
      "@hono/node-server":"1.19.10",
      "dompurify":"3.2.5",
      "ajv":"8.17.1",
      "webpack":"5.99.0",
      "qs":"6.14.2",
      "brace-expansion":"2.0.2",
      "axios":"1.13.5",
      "cross-spawn":"7.0.5"
    }}' > package.json; \
    $PNPM install --no-lockfile --ignore-scripts 2>/dev/null; \
    for PKGESCAPED in fast-xml-parser rollup minimatch tar serialize-javascript '@hono/node-server' dompurify ajv webpack qs brace-expansion axios cross-spawn; do \
      PKGNAME=$(echo "$PKGESCAPED" | sed 's/@hono/node-server/hono+node-server/g'); \
      SRC="$PATCHDIR/node_modules/$PKGESCAPED"; \
      [ -d "$SRC" ] || continue; \
      find /app/node_modules/.pnpm -maxdepth 2 -name "$PKGESCAPED" -type d 2>/dev/null | while read -r TARGET; do \
        if [ -d "$TARGET" ]; then \
          rm -rf "$TARGET"; \
          cp -rL "$SRC" "$TARGET"; \
          echo "patched $TARGET"; \
        fi; \
      done; \
      if [ -d "/app/node_modules/$PKGESCAPED" ]; then \
        rm -rf "/app/node_modules/$PKGESCAPED"; \
        cp -rL "$SRC" "/app/node_modules/$PKGESCAPED"; \
        echo "patched /app/node_modules/$PKGESCAPED"; \
      fi; \
    done; \
    rm -rf "$PATCHDIR" /tmp/pnpm-bin

# Удаляем esbuild-бинари (golang, dev-инструмент, 6 CVE golang stdlib)
# CVE-2025-68121, CVE-2025-47907, CVE-2025-58183, CVE-2025-61726, CVE-2025-61728, CVE-2025-61729
RUN find /app -path "*/@esbuild/linux-x64/bin/esbuild" -delete 2>/dev/null; \
    find /app -path "*/esbuild/bin/esbuild" -delete 2>/dev/null; \
    find /app -name "esbuild" -type f -perm /111 -delete 2>/dev/null; \
    true

# ---------- stage 3: runtime (по аналогии с clickhouse-secure — минимальный distroless) ----------
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
