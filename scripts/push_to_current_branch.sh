#!/bin/bash
# Usage: ./scripts/push_to_current_branch.sh "commit message"
# If no commit message is supplied, a timestamped default will be used.

set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "git is not installed or not in PATH" >&2
  exit 1
fi

# Ensure we are inside a git repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This script must be run from inside a git repository" >&2
  exit 1
fi

# Determine current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ -z "${CURRENT_BRANCH}" ]]; then
  echo "Unable to determine the current branch" >&2
  exit 1
fi

echo "☑️  Working on branch: ${CURRENT_BRANCH}"

# Check if remote exists
if ! git ls-remote --exit-code origin >/dev/null 2>&1; then
  echo "Remote 'origin' not found. Please add a remote before pushing." >&2
  exit 1
fi

# Stage all changes (tracked + untracked)
echo "➕ Staging all changes..."
git add -A

# Warn if there is nothing to commit
if git diff --cached --quiet; then
  echo "Nothing to commit. Working tree is clean." >&2
  exit 0
fi

# Commit with provided message or default
default_message="chore: update workspace ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
COMMIT_MESSAGE=${1:-$default_message}

echo "📝 Committing with message: ${COMMIT_MESSAGE}"
git commit -m "${COMMIT_MESSAGE}"

echo "🚀 Pushing to origin/${CURRENT_BRANCH}..."
git push origin "${CURRENT_BRANCH}"

echo "✅ Push complete."
