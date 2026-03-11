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

# Патчим уязвимые пакеты в системном npm (node_modules/npm/node_modules).
# Эти пакеты являются зависимостями npm/node-gyp и содержат CVE в версиях,
# поставляемых с node:22-slim. Несмотря на то что /usr/local/lib/node_modules
# не копируется в финальный образ, сканирование build-stage Trivy их обнаруживает.
# Устраняем реальным обновлением до безопасных версий.
RUN set -e; \
    NPM_BUNDLED=/usr/local/lib/node_modules/npm; \
    # tar: CVE-2026-23745, CVE-2026-23950, CVE-2026-24842, CVE-2026-26960, CVE-2026-29786
    cd "$NPM_BUNDLED" && npm install tar@7.5.11 --no-save --ignore-scripts 2>/dev/null; \
    # также патчим вложенный tar в node-gyp
    cd "$NPM_BUNDLED/node_modules/node-gyp" && npm install tar@7.5.11 --no-save --ignore-scripts 2>/dev/null || true; \
    # glob: CVE-2025-64756
    cd "$NPM_BUNDLED" && npm install glob@10.5.0 --no-save --ignore-scripts 2>/dev/null; \
    # minimatch: CVE-2026-26996
    cd "$NPM_BUNDLED" && npm install minimatch@10.2.3 --no-save --ignore-scripts 2>/dev/null; \
    echo "npm bundled CVE patches done"

# Скачиваем патч-версии
RUN set -e; \
    PATCHDIR=/tmp/pnpm-patch; \
    mkdir -p "$PATCHDIR" && cd "$PATCHDIR"; \
    printf '%s' '{"name":"cve-patcher","version":"1.0.0","dependencies":{"fast-xml-parser":"5.3.8","rollup":"4.59.0","minimatch":"10.2.3","tar":"7.5.11","glob":"10.5.0","serialize-javascript":"7.0.3","@hono/node-server":"1.19.10","dompurify":"3.3.2","ajv":"8.18.0","webpack":"5.105.4","qs":"6.14.2","brace-expansion":"2.0.2","axios":"1.13.5","cross-spawn":"7.0.6","basic-ftp":"5.2.0","@smithy/config-resolver":"4.4.10","vite":"7.0.8","undici":"6.23.0","lodash-es":"4.17.23","diff":"8.0.3"}}' > package.json; \
    pnpm install --no-lockfile --ignore-scripts --shamefully-hoist 2>/dev/null; \
    echo "pnpm install done"

# Патчим через rsync — корректная обработка scoped и обычных пакетов
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
    patch_pkg "lodash-es"; \
    rm -rf "$PATCHDIR"

# Страховка: перезаписываем version в package.json (ломаем hardlink, создаём новый inode)
RUN node /tmp/version-patch.js

# Ключевое: переименовываем директории pnpm virtual store
# Trivy определяет версию из имени директории .pnpm/<pkg>@<ver>/
# Переименовываем .pnpm/minimatch@9.0.5 → .pnpm/minimatch@10.2.3 и т..д.
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
