#!/bin/bash
set -euo pipefail

GH="/tmp/gh_2.69.0_macOS_arm64/bin/gh"
REPO_NAME="bible-verse-hunt"

if ! "$GH" auth status &>/dev/null; then
  echo "Not logged into GitHub. Run this first:"
  echo "  $GH auth login"
  exit 1
fi

cd "$(dirname "$0")"

if [ ! -d .git ]; then
  git init -b main
  git add .
  git commit -m "Initial commit: Verse Hunt Bible game"
fi

if ! git remote get-url origin &>/dev/null; then
  "$GH" repo create "$REPO_NAME" --public --source=. --remote=origin --push
else
  git add -A
  git diff --cached --quiet || git commit -m "Update Verse Hunt"
  git push -u origin main
fi

OWNER=$("$GH" api user -q .login)
"$GH" api "repos/$OWNER/$REPO_NAME/pages" -X POST -f build_type=workflow -f source[branch]=main -f source[path]=/ 2>/dev/null || true

echo ""
echo "Deployed! GitHub Pages will be live in 1–2 minutes at:"
echo "  https://$OWNER.github.io/$REPO_NAME/"
echo ""
echo "Check status:"
echo "  $GH run list --repo $OWNER/$REPO_NAME"