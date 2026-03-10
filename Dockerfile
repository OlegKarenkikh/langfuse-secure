# syntax=docker/dockerfile:1
# =================================================================
# Stage 1: builder — cgr.dev/chainguard/node:latest-dev
#   - содержит npm/yarn, shell, компилятор
#   - пересобирается ежедневно из Wolfi
#   - базовый образ с 0 CVE
# =================================================================
FROM cgr.dev/chainguard/node:latest-dev AS builder

WORKDIR /app

# Копируем исходники официального Langfuse образа
# Используем официальный prebuilt-образ как источник artефактов
COPY --from=langfuse/langfuse:3 /app /app

# =================================================================
# Stage 2: runtime — cgr.dev/chainguard/node:latest
#   - нет shell, нет npm — минимальная поверхность атаки
#   - 0 CVE, встроенный SBOM + Sigstore-подпись
#   - non-root по умолчанию (uid=65532)
# =================================================================
FROM cgr.dev/chainguard/node:latest

WORKDIR /app

# Копируем собранное приложение из builder
COPY --from=builder /app /app

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "web/server.js"]
