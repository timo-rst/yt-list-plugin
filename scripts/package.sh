#!/usr/bin/env bash
set -euo pipefail

# Package script for creating a clean extension zip for Chrome Web Store / GitHub Releases
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
ZIP_NAME="yt-list-plugin.zip"

echo "📦 Packaging extension..."
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

cd "$ROOT_DIR"
zip -r "$DIST_DIR/$ZIP_NAME" \
  manifest.json \
  content/ \
  popup/ \
  icons/ \
  -x "*.DS_Store" "*__MACOSX*"

echo "✓ Extension packaged successfully: dist/$ZIP_NAME"
ls -lh "$DIST_DIR/$ZIP_NAME"
