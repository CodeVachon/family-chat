#!/usr/bin/env bash
# Create an isolated git worktree for a single Linear issue and prime it for dev.
#
# Usage:  setup-worktree.sh <ISSUE_KEY> <BRANCH_NAME>
#   ISSUE_KEY    Linear identifier, e.g. COD-23  (used as the worktree dir name)
#   BRANCH_NAME  Branch to create, e.g. the issue's Linear `gitBranchName`
#                (corglen/cod-23-...). Slashes are fine — only the issue key
#                is used for the directory.
#
# Result: a sibling worktree at  ../family-chat-worktrees/<ISSUE_KEY>  branched
# off the latest origin/main, with the gitignored root .env symlinked in and
# dependencies installed. Sibling (not nested) so Turbo/ESLint/git never scan it.
set -euo pipefail

ISSUE_KEY="${1:?usage: setup-worktree.sh <ISSUE_KEY> <BRANCH_NAME>}"
BRANCH_NAME="${2:?usage: setup-worktree.sh <ISSUE_KEY> <BRANCH_NAME>}"

ROOT="$(git rev-parse --show-toplevel)"
WT_PARENT="$(cd "$ROOT/.." && pwd)/family-chat-worktrees"
WT="$WT_PARENT/$ISSUE_KEY"

if [ -e "$WT" ]; then
  echo "Worktree already exists: $WT" >&2
  echo "Reuse it (cd \"$WT\") or remove it: git worktree remove \"$WT\"" >&2
  exit 1
fi

echo "› Fetching origin/main…"
git -C "$ROOT" fetch origin main --quiet

echo "› Creating worktree $WT on branch $BRANCH_NAME (from origin/main)…"
mkdir -p "$WT_PARENT"
git -C "$ROOT" worktree add "$WT" -b "$BRANCH_NAME" origin/main

# The root .env is gitignored, so a fresh worktree has none. Symlink the canonical
# one (DATABASE_PORT=5433 + secrets) so apps/web + packages/db dotenv loads resolve.
echo "› Linking root .env…"
ln -s "$ROOT/.env" "$WT/.env"

echo "› Installing dependencies (bun install)…"
( cd "$WT" && bun install )

cat <<EOF

✓ Worktree ready.
  cd "$WT"

Notes:
  • Postgres (docker, host port 5433) is SHARED with the main checkout — there is
    one local DB. Avoid destructive migrations here while other work is running.
  • Remove when the PR is merged:  git worktree remove "$WT"
EOF
