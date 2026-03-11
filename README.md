# langfuse-secure

Secure hardened [Langfuse v3](https://langfuse.com) Docker images — **web** and **worker** — published to a single Docker Hub repository.

## Approach

- **Base**: `cgr.dev/chainguard/node:latest` (Wolfi, 0 CVE, no shell, non-root uid=65532)
- **Patcher**: `alpine:3.21` with `rsync --copy-links --delete` — resolves pnpm symlinks, replaces vulnerable packages
- **Strategy**: copy prebuilt artifacts from official `langfuse/langfuse:3` and `langfuse/langfuse-worker:3` — no full TypeScript rebuild
- **Daily rebuild** via GitHub Actions schedule — picks up latest Chainguard node patches
- **Trivy gate**: blocks push on any unfixed CRITICAL/HIGH CVE (web and worker scanned independently)
- **SARIF** uploaded to GitHub Security tab per component (`category: web` / `category: worker`)

## Images

Both images live in a single Docker Hub repository: [`olegkarenkikh/langfuse-secure`](https://hub.docker.com/r/olegkarenkikh/langfuse-secure)

| Component | Pull command | Port |
|-----------|-------------|------|
| Web (Next.js) | `docker pull olegkarenkikh/langfuse-secure:latest` | 3000 |
| Worker | `docker pull olegkarenkikh/langfuse-secure:worker-latest` | 3030 |

## Tags

| Tag | Component | Description |
|-----|-----------|-------------|
| `latest` | web | latest build from `main` |
| `3` | web | Langfuse v3 major |
| `YYYY-MM-DD` | web | date-stamped build |
| `<short-sha>` | web | commit SHA |
| `worker-latest` | worker | latest build from `main` |
| `worker-3` | worker | Langfuse v3 major |
| `worker-YYYY-MM-DD` | worker | date-stamped build |
| `worker-<short-sha>` | worker | commit SHA |

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
