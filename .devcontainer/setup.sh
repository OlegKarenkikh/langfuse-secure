#!/usr/bin/env bash
set -euo pipefail

echo "==> Updating Trivy DB..."
trivy image --download-db-only

echo ""
echo "==> Setup complete! Available commands:"
echo "    make build   — build Docker image"
echo "    make scan    — build + Trivy scan"
echo "    make shell   — interactive shell inside container"
echo "    make clean   — remove local image"
