#!/bin/bash
# bin/status.sh: branch, changed files and commits not pushed, for the workspace and every library repo
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
. "$ROOT/bin/repos.sh"

for LIB in . "${REPOS[@]}"; do
  if [ -d "$ROOT/$LIB/.git" ]; then
    BRANCH="$(git -C "$ROOT/$LIB" rev-parse --abbrev-ref HEAD)"
    CHANGED="$(git -C "$ROOT/$LIB" status --porcelain | wc -l)"
    AHEAD="$(git -C "$ROOT/$LIB" rev-list --count '@{u}..HEAD' 2>/dev/null || echo '?')"
    printf '%-20s %-12s changed %-4s ahead %s\n' "$LIB" "$BRANCH" "$CHANGED" "$AHEAD"
  else
    printf '%-20s not cloned\n' "$LIB"
  fi
done
