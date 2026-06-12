#!/usr/bin/env bash
# Packages the extension into a zip ready for upload to the Chrome Web Store.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./manifest.json').version")
OUT_DIR="dist"
OUT_FILE="$OUT_DIR/readwise-mastery-assistant-${VERSION}.zip"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

zip -r "$OUT_FILE" manifest.json src public -x "**/.DS_Store"

echo "Built $OUT_FILE"
