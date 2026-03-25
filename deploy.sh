#!/bin/bash
# Auto-deploy: commit all changes and push to GitHub Pages
# Called by Claude Code hook after edits to website files

WEBSITE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$WEBSITE_DIR" || exit 1

# Check if there are any changes to commit
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard -- ':!notes.md')" ]; then
    exit 0
fi

# Stage all website files (excluding notes.md which is local-only)
git add -- ':!notes.md' .

# Only commit if there's something staged
if ! git diff --cached --quiet; then
    git commit -m "Update website $(date '+%Y-%m-%d %H:%M')"
    git push origin main
fi
