# syntax=docker/dockerfile:1
# Stage 1: source
FROM langfuse/langfuse:3 AS source

# Stage 2: patcher (Chainguard - no npm/apt/rsync, zero CVE)
FROM cgr.dev/chainguard/node:latest AS patcher
USER root
WORKDIR /app
COPY --from=source /app /app
COPY scripts/patch-all.js /tmp/patch-all.js
COPY scripts/version-patch.js /tmp/version-patch.js
RUN node /tmp/patch-all.js
RUN node /tmp/version-patch.js
RUN find /app -path "*/@esbuild/linux-x64/bin/esbuild" -delete 2>/dev/null; find /app -path "*/esbuild/bin/esbuild" -delete 2>/dev/null; find /app -name "esbuild" -type f -perm /111 -delete 2>/dev/null; find /app -name "tsgo" -type f -perm /111 -delete 2>/dev/null; true

# Stage 3: runtime
FROM cgr.dev/chainguard/node:latest
LABEL org.opencontainers.image.title="langfuse-secure" \
      org.opencontainers.image.source="https://github.com/OlegKarenkikh/langfuse-secure" \
      org.opencontainers.image.licenses="MIT"
WORKDIR /app
COPY --from=patcher /app /app
USER nonroot
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=0
ENV NEXT_MANUAL_SIG_HANDLE=true
ENV PORT=3000
EXPOSE 3000
CMD ["./web/server.js", "--keepAliveTimeout", "110000"]
