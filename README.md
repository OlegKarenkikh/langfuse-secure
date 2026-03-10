# langfuse-secure

Secure hardened [Langfuse v3](https://langfuse.com) Docker images — **web** and **worker**.

## Approach

- **Base**: `cgr.dev/chainguard/node:latest` (Wolfi, 0 CVE, no shell, non-root uid=65532)
- **Patcher**: `alpine:3.21` with `rsync --copy-links --delete` — resolves pnpm symlinks, replaces vulnerable packages
- **Strategy**: copy prebuilt artifacts from official `langfuse/langfuse:3` and `langfuse/langfuse-worker:3` — no full TypeScript rebuild
- **Daily rebuild** via GitHub Actions schedule — picks up latest Chainguard node patches
- **Trivy gate**: blocks push on any unfixed CRITICAL/HIGH CVE (web and worker scanned independently)
- **SARIF** uploaded to GitHub Security tab per component (`category: web` / `category: worker`)

## Images

| Image | Docker Hub | Port |
|-------|-----------|------|
| Web (Next.js) | `olegkarenkikh/langfuse-secure` | 3000 |
| Worker | `olegkarenkikh/langfuse-worker-secure` | 3030 |

## Tags

| Tag | Description |
|-----|-------------|
| `latest` | latest build from `main` |
| `3` | Langfuse v3 major |
| `YYYY-MM-DD` | date-stamped build |
| `<short-sha>` | commit SHA |

## Quick start

```bash
make build         # build both images
make build-web     # web only
make build-worker  # worker only
make scan          # build + Trivy scan both
make clean         # remove local images
```

## Notes on entrypoint

The official Langfuse web image uses `dumb-init` + `entrypoint.sh` (shell script for Prisma migrations).
Chainguard node has no shell — **Prisma migrations must run as a separate init-container** before the web pod starts.
The worker image runs `node ./worker/dist/index.js` directly and has no such dependency.

## Secrets required

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
