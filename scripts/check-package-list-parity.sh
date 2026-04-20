#!/usr/bin/env bash
# Verifies scripts/lib/signage-packages.txt and pi-image/stage-signage/00-packages-nr stay in sync.
# Run from the repo root. Fails with exit 1 if the lists differ.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

LIB_LIST=$(grep -v '^\s*#' "${REPO_ROOT}/scripts/lib/signage-packages.txt" | grep -v '^\s*$' | sort -u)
STAGE_LIST=$(grep -v '^\s*#' "${REPO_ROOT}/pi-image/stage-signage/00-packages-nr" | tr ' ' '\n' | grep -v '^\s*$' | sort -u)

if [ "$LIB_LIST" != "$STAGE_LIST" ]; then
  echo "DRIFT: signage-packages.txt and 00-packages-nr differ"
  diff <(echo "$LIB_LIST") <(echo "$STAGE_LIST")
  exit 1
fi
echo "OK: package lists in sync."
