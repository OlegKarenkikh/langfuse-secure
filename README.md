# langfuse-secure

Secure hardened [Langfuse v3](https://langfuse.com) Docker image.

## Approach

- **Base**: `cgr.dev/chainguard/node:latest` (Wolfi, 0 CVE, non-root, no shell)
- **Multi-stage build**: artifacts copied from official `langfuse/langfuse:3`
- **Daily rebuild** via GitHub Actions schedule — picks up latest Chainguard patches
- **Trivy gate**: blocks push on any unfixed CRITICAL/HIGH CVE
- **SARIF** results uploaded to GitHub Security tab

## Tags on Docker Hub

| Tag | Description |
|-----|-------------|
| `latest` | latest build from `main` |
| `3` | Langfuse v3 major |
| `YYYY-MM-DD` | date-stamped build |
| `<short-sha>` | commit SHA |

## Quick start

```bash
make build   # build image locally
make scan    # build + Trivy scan
make shell   # shell inside container
make clean   # remove local image
```

## Secrets required

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
