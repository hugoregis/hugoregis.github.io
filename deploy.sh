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
    # Fallback identity if git config is missing (e.g. sandboxed env with no user.* set).
    # Uses -c flags so the repo/global git config is NOT modified.
    COMMIT_ARGS=()
    if ! git config --get user.email > /dev/null 2>&1; then
        COMMIT_ARGS+=(-c "user.email=hbergier@regis.edu")
    fi
    if ! git config --get user.name > /dev/null 2>&1; then
        COMMIT_ARGS+=(-c "user.name=Hugolin Bergier")
    fi
    git "${COMMIT_ARGS[@]}" commit -m "Update website $(date '+%Y-%m-%d %H:%M')"
    # Use token from .env if available (not committed to repo)
    if [ -f "$WEBSITE_DIR/.env" ]; then
        source "$WEBSITE_DIR/.env"
        git push "https://${GH_USER}:${GH_TOKEN}@github.com/${GH_USER}/hugoregis.github.io.git" main
    else
        git push origin main
    fi
fi
