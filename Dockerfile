# syntax=docker/dockerfile:1
# =================================================================
# Langfuse WEB — secure hardened image
# Strategy: copy prebuilt artifacts from official langfuse/langfuse:3
#            into cgr.dev/chainguard/node:latest (0 CVE, no shell,
#            non-root uid=65532)
#
# Официальный образ уже содержит собранный Next.js standalone,
# prisma-схемы, clickhouse-миграции и entrypoint.sh.
# Мы НЕ пересобираем — только меняем базовый OS-слой.
# =================================================================
FROM langfuse/langfuse:3 AS source

FROM cgr.dev/chainguard/node:latest

WORKDIR /app

# Копируем весь /app из официального образа
COPY --from=source /app /app

# Chainguard node — non-root (uid=65532) по умолчанию
# entrypoint.sh требует sh: запускаем через node напрямую
# (dumb-init и shell отсутствуют в Chainguard — используем tini через node)

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=0
ENV NEXT_MANUAL_SIG_HANDLE=true
ENV PORT=3000

EXPOSE 3000

# Chainguard node не имеет dumb-init/sh — запускаем server.js напрямую
# Prisma-миграции и инициализация должны выполняться отдельным init-контейнером
CMD ["node", "./web/server.js", "--keepAliveTimeout", "110000"]
