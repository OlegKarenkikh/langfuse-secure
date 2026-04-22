# syntax=docker/dockerfile:1
# Stage 1: source — official langfuse:3 image
FROM langfuse/langfuse:3 AS source

# Stage 2: fetcher — downloads fixed npm packages; uses prebuilt kysely fork
FROM node:22-slim AS fetcher
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /tmp/patches
# kysely prebuilt dist (compiled outside Docker from olegkarenkikh/kysely fork)
COPY kysely-dist /kysely-dist
COPY scripts/fetch-patches.sh /tmp/fetch-patches.sh
RUN chmod +x /tmp/fetch-patches.sh && bash /tmp/fetch-patches.sh

# Stage 3: build fresh golang-migrate binary with Go 1.26.2 (fixes all Go stdlib CVEs)
FROM golang:1.26.2-alpine AS migrate-builder
RUN go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@v4.19.1

# Stage 4: patcher (Chainguard — zero OS CVE)
FROM cgr.dev/chainguard/node:latest AS patcher
USER root
WORKDIR /app
COPY scripts/patch-all.js /tmp/patch-all.js
COPY scripts/download-prisma-engine.js /tmp/download-prisma-engine.js
COPY scripts/version-patch.js /tmp/version-patch.js
COPY scripts/brute-fix-ptr.js /tmp/brute-fix-ptr.js
COPY scripts/diag.js /tmp/diag.js
RUN --mount=type=bind,from=source,source=/app,target=/mnt/source \
    --mount=type=bind,from=fetcher,source=/tmp/patches,target=/tmp/patches \
    cp -a /mnt/source/. /app && \
    node /tmp/patch-all.js && \
    node /tmp/version-patch.js && \
    node /tmp/download-prisma-engine.js && \
    node /tmp/brute-fix-ptr.js && \
    node /tmp/diag.js && \
    find /app -path "*/@esbuild/linux-x64/bin/esbuild" -delete 2>/dev/null; \
    find /app -path "*/esbuild/bin/esbuild" -delete 2>/dev/null; \
    find /app -name "esbuild" -type f -perm /111 -delete 2>/dev/null; \
    find /app -name "tsgo" -type f -perm /111 -delete 2>/dev/null; \
    find /app -path "*/monorepo-symlink-test*" -maxdepth 10 -type d -exec rm -rf {} + 2>/dev/null; \
    true

# Stage 5: runtime — distroless Chainguard node
FROM cgr.dev/chainguard/node:latest
LABEL org.opencontainers.image.title="langfuse-secure" \
      org.opencontainers.image.source="https://github.com/OlegKarenkikh/langfuse-secure" \
      org.opencontainers.image.licenses="MIT"
WORKDIR /app
COPY --from=patcher /app /app
# Replace migrate binary with freshly compiled Go 1.26.2 binary
COPY --from=migrate-builder /go/bin/migrate /app/bin/migrate
USER 65532
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=0
ENV NEXT_MANUAL_SIG_HANDLE=true
ENV PORT=3000
EXPOSE 3000
CMD ["./web/server.js", "--keepAliveTimeout", "110000"]
