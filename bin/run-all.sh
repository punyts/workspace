#!/bin/bash
# bin/run-all.sh: run one npm script in every library that has it, in build order; stops at the first failure
# Usage: bin/run-all.sh <script> [library...]   (default: every library)
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$1"
shift
. "$ROOT/bin/repos.sh"
if [ "$#" -gt 0 ]; then REPOS=("$@"); fi

for LIB in "${REPOS[@]}"; do
  if [ ! -f "$ROOT/$LIB/package.json" ]; then
    echo "== $LIB: not cloned (run bin/clone-repos.sh)" >&2
    exit 1
  fi
  # Node on Windows cannot read Git Bash paths (/d/...), so it reads package.json from inside the library
  if (cd "$ROOT/$LIB" && node -e "process.exit(require('./package.json').scripts?.['$SCRIPT'] ? 0 : 1)"); then
    echo "== $LIB: npm run $SCRIPT"
    (cd "$ROOT/$LIB" && npm run "$SCRIPT")
  else
    echo "== $LIB: no $SCRIPT script"
  fi
done
