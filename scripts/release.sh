#!/usr/bin/env bash
# Creates a full release: bumps the version, builds the zip, commits, tags,
# pushes, and creates a GitHub release with auto-generated notes.
#
# Usage:
#   ./scripts/release.sh <version> [--draft]
#   e.g. ./scripts/release.sh 0.4.0 --draft
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="${1:-}"
DRAFT_FLAG="${2:-}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: ./scripts/release.sh <version> [--draft]" >&2
  exit 1
fi

TAG="v${VERSION}"

DRAFT_ARGS=()
if [[ "$DRAFT_FLAG" == "--draft" ]]; then
  DRAFT_ARGS+=(--draft)
elif [[ -n "$DRAFT_FLAG" ]]; then
  echo "Usage: ./scripts/release.sh <version> [--draft]" >&2
  exit 1
fi

RELEASE_ARGS=(--title "$TAG" --generate-notes)
if [[ ${#DRAFT_ARGS[@]} -gt 0 ]]; then
  RELEASE_ARGS+=("${DRAFT_ARGS[@]}")
else
  RELEASE_ARGS+=(--latest)
fi

# Guard: tag must not already exist
if git rev-parse "$TAG" &>/dev/null; then
  echo "Error: tag $TAG already exists." >&2
  exit 1
fi

# Guard: working tree must be clean
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree has uncommitted changes. Commit or stash them first." >&2
  exit 1
fi

echo "==> Bumping manifest.json to $VERSION"
node -e "
  const fs = require('fs');
  const m = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  m.version = '$VERSION';
  fs.writeFileSync('manifest.json', JSON.stringify(m, null, 2) + '\n');
"

echo "==> Building zip"
./scripts/build.sh

ZIP="dist/readwise-mastery-assistant-${VERSION}.zip"

echo "==> Committing and tagging"
git add manifest.json
git commit -m "Bump version to ${VERSION}"
git tag "$TAG"

echo "==> Pushing"
git push origin main
git push origin "$TAG"

echo "==> Creating GitHub release $TAG"
gh release create "$TAG" "$ZIP" "${RELEASE_ARGS[@]}"

echo ""
echo "Released $TAG: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/$TAG"
