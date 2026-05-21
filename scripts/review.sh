#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Tạo thư mục reviews nếu chưa có
mkdir -p docs/reviews

# Tạo tên file theo timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

cr --agent --type uncommitted > "docs/reviews/cr-review-$TIMESTAMP.json"

echo "Done! docs/reviews/cr-review-$TIMESTAMP.json ready for Codex."
