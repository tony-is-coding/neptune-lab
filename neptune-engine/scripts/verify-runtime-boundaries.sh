#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

status=0

check_empty() {
  local label="$1"
  local pattern="$2"
  shift 2

  local matches
  matches=$(rg -n "$pattern" "$@" || true)
  if [[ -n "$matches" ]]; then
    echo "Boundary check failed: $label" >&2
    echo "$matches" >&2
    status=1
  fi
}

check_empty \
  "engine kernel must not import product, builtin-tools, or product src/* paths" \
  "^\\s*(import|export).*(@neptune/engine-product|@neptune/builtin-tools|from ['\"]src/)|\\b(require|import)\\(['\"](@neptune/engine-product|@neptune/builtin-tools|src/)" \
  src \
  package.json \
  tsconfig.json \
  tsconfig.base.json

check_empty \
  "engine clean sibling packages must not import host/product source paths" \
  "(@neptune/engine-product|from ['\"]src/|\\b(require|import)\\(['\"]src/|from ['\"]\\.\\./\\.\\./\\.\\./\\.\\./src/|from ['\"]\\.\\./\\.\\./\\.\\./src/|from ['\"]\\.\\./\\.\\./src/)" \
  packages/agent-tools/src \
  packages/mcp-client/src

if [[ $status -ne 0 ]]; then
  exit "$status"
fi

echo "Runtime boundary checks passed."
