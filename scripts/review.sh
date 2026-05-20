#!/bin/bash
cd /mnt/c/Users/Admin/Desktop/finsight

# Tạo thư mục reviews nếu chưa có
mkdir -p docs/reviews

# Tạo tên file theo timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

cr --agent --type uncommitted > reviews/cr-review-$TIMESTAMP.json

echo "Done! reviews/cr-review-$TIMESTAMP.json ready for Codex."