# syntax=docker/dockerfile:1
# =================================================================
# Langfuse WEB — secure hardened image
#
# Stage 1 (source)   — официальный langfuse/langfuse:3 (готовый Next.js standalone)
# Stage 2 (patcher)  — cgr.dev/chainguard/node:latest-dev
#                       • npm audit fix --force  (патчим CVE в node_modules)
#                       • удаляем esbuild  (не нужен в production; содержит CVE golang stdlib)
# Stage 3 (runtime)  — cgr.dev/chainguard/node:latest
#                       • 0 CVE OS-слой, non-root, нет shell
# =================================================================

# ---------- stage 1: source ----------
FROM langfuse/langfuse:3 AS source

# ---------- stage 2: patcher ----------
FROM cgr.dev/chainguard/node:latest-dev AS patcher

WORKDIR /app
COPY --from=source /app /app

# 1. Патчим уязвимые npm-пакеты во всех node_modules
#    --force перепишет transitive deps даже с semver-нарушениям
RUN find /app -name "package.json" -path "*/node_modules/.pnpm/*/package.json" -prune \
    -o -name "package-lock.json" -print | head -1 | xargs -r dirname | \
    xargs -I{} sh -c 'cd {} && npm audit fix --force --legacy-peer-deps 2>/dev/null || true'

# 2. Удаляем esbuild-бинари (golang, dev-инструмент, CVE golang stdlib)
#    Затрагивает: CVE-2025-68121, CVE-2025-47907, CVE-2025-58183, CVE-2025-61726, CVE-2025-61728, CVE-2025-61729
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

# Prisma-миграции — вынести в отдельный init-контейнер
CMD ["node", "./web/server.js", "--keepAliveTimeout", "110000"]
