# syntax=docker/dockerfile:1
# Stage 1: source
FROM langfuse/langfuse:3 AS source

# Stage 2: fetcher — downloads fixed npm packages + kysely fork
FROM node:22-slim AS fetcher
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /tmp/patches
COPY scripts/fetch-patches.sh /tmp/fetch-patches.sh
RUN chmod +x /tmp/fetch-patches.sh && bash /tmp/fetch-patches.sh

# Stage 3: patcher (Chainguard — zero OS CVE)
FROM cgr.dev/chainguard/node:latest AS patcher
USER root
WORKDIR /app
COPY scripts/patch-all.js /tmp/patch-all.js
COPY scripts/version-patch.js /tmp/version-patch.js
COPY scripts/diag.js /tmp/diag.js
RUN --mount=type=bind,from=source,source=/app,target=/mnt/source \
    --mount=type=bind,from=fetcher,source=/tmp/patches,target=/tmp/patches \
    cp -a /mnt/source/. /app && \
    node /tmp/patch-all.js && \
    node /tmp/version-patch.js && \
    \
    # ── Brute-force fix: overwrite every real path-to-regexp 0.x dir in .pnpm store ──
    # The JS patcher may miss these due to symlink resolution complexity in pnpm.
    # Strategy: find all real directories named "path-to-regexp" whose package.json
    # has version starting with "0.1." and overwrite them with the patched 0.1.13 source.
    # This runs AFTER patch-all.js so it is the final word on these files.
    node -e "
      var fs=require('fs'), path=require('path'), src='/tmp/patches/path-to-regexp-0.1.13';
      if (!fs.existsSync(src)) { console.log('SKIP: patch src not found', src); process.exit(0); }
      function cpDir(s,d) {
        fs.mkdirSync(d,{recursive:true});
        var es=fs.readdirSync(s,{withFileTypes:true});
        es.forEach(function(e){
          if (e.isSymbolicLink()) return;
          var ss=path.join(s,e.name), dd=path.join(d,e.name);
          if (e.isDirectory()) cpDir(ss,dd);
          else { try{fs.unlinkSync(dd);}catch(_){} fs.copyFileSync(ss,dd); }
        });
      }
      function walk(dir) {
        var res=[];
        var es; try{es=fs.readdirSync(dir,{withFileTypes:true});}catch(_){return res;}
        es.forEach(function(e){
          var full=path.join(dir,e.name);
          if (e.isSymbolicLink()) return;
          if (e.isDirectory()) res=res.concat(walk(full));
          else if (e.isFile() && e.name==='package.json') res.push(full);
        });
        return res;
      }
      var all=walk('/app/node_modules/.pnpm');
      var fixed=0;
      all.forEach(function(pj){
        var d=path.dirname(pj);
        if (path.basename(d)!=='path-to-regexp') return;
        var pkg; try{pkg=JSON.parse(fs.readFileSync(pj,'utf8'));}catch(_){return;}
        if (pkg.name!=='path-to-regexp') return;
        var ver=String(pkg.version||'');
        if (!ver.match(/^0\.1\.(\d+)$/)) return;
        var minor=parseInt(ver.split('.')[2],10);
        if (minor>=13) return;
        console.log('brute-fix path-to-regexp@'+ver+' at '+d);
        cpDir(src, d);
        fixed++;
      });
      console.log('brute-fix done, fixed:', fixed);
    " && \
    \
    node /tmp/diag.js && \
    find /app -path "*/@esbuild/linux-x64/bin/esbuild" -delete 2>/dev/null; \
    find /app -path "*/esbuild/bin/esbuild" -delete 2>/dev/null; \
    find /app -name "esbuild" -type f -perm /111 -delete 2>/dev/null; \
    find /app -name "tsgo" -type f -perm /111 -delete 2>/dev/null; \
    find /app -path "*/monorepo-symlink-test*" -maxdepth 10 -type d -exec rm -rf {} + 2>/dev/null; \
    true

# Stage 4: runtime
FROM cgr.dev/chainguard/node:latest
LABEL org.opencontainers.image.title="langfuse-secure" \
      org.opencontainers.image.source="https://github.com/OlegKarenkikh/langfuse-secure" \
      org.opencontainers.image.licenses="MIT"
WORKDIR /app
COPY --from=patcher /app /app
# Chainguard distroless images have no /etc/passwd — use numeric UID (nonroot=65532)
USER 65532
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=0
ENV NEXT_MANUAL_SIG_HANDLE=true
ENV PORT=3000
EXPOSE 3000
CMD ["./web/server.js", "--keepAliveTimeout", "110000"]
