#!/usr/bin/env bash
set -euo pipefail

echo "==> Updating Trivy DB..."
trivy image --download-db-only

echo ""
echo "==> Setup complete! Available commands:"
echo "    make build        — build web + worker images"
echo "    make build-web    — build only web image"
echo "    make build-worker — build only worker image"
echo "    make scan         — build + Trivy scan both"
echo "    make clean        — remove local images"
