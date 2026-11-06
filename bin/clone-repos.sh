#!/bin/bash
# bin/clone-repos.sh: clone every library repo of the workspace that is not here yet (idempotent)
# Usage: bin/clone-repos.sh [branch]   (default: develop)
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${1:-develop}"
. "$ROOT/bin/repos.sh"

cd "$ROOT"
for LIB in "${REPOS[@]}"; do
  if [ -d "$LIB/.git" ]; then
    echo "$LIB already cloned."
  else
    echo "Cloning $LIB (branch: $BRANCH)..."
    git clone --branch "$BRANCH" "https://github.com/punyts/$LIB.git" "$LIB"
  fi
done
