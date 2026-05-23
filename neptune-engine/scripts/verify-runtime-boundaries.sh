#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

status=0

# Pick the best available recursive grep tool. Prefer ripgrep when present;
# fall back to BSD/GNU grep so the check still runs on stock macOS without rg.
# Without this fallback the script would silently report "passed" because the
# `|| true` guard swallows `rg: command not found`.
if command -v rg >/dev/null 2>&1; then
  search() {
    local pattern="$1"
    shift
    rg -n --no-messages "$pattern" "$@" || true
  }
else
  search() {
    local pattern="$1"
    shift
    grep -rEn --binary-files=without-match "$pattern" "$@" 2>/dev/null || true
  }
fi

check_max_count() {
  local label="$1"
  local pattern="$2"
  local max_count="$3"
  shift 3

  local matches
  matches=$(search "$pattern" "$@")
  local count=0
  if [[ -n "$matches" ]]; then
    count=$(printf '%s\n' "$matches" | wc -l | tr -d ' ')
  fi
  if (( count > max_count )); then
    echo "Boundary budget exceeded: $label" >&2
    echo "Found $count matches, budget is $max_count." >&2
    echo "$matches" >&2
    status=1
  fi
}

check_empty() {
  local label="$1"
  local pattern="$2"
  shift 2

  local matches
  matches=$(search "$pattern" "$@")
  if [[ -n "$matches" ]]; then
    echo "Boundary check failed: $label" >&2
    echo "$matches" >&2
    status=1
  fi
}

check_empty \
  "engine kernel must not import product, builtin-tools, or product src/* paths" \
  "^[[:space:]]*(import|export).*(@neptune/engine-product|@neptune/builtin-tools|from ['\"]src/)|\\b(require|import)\\(['\"](@neptune/engine-product|@neptune/builtin-tools|src/)" \
  src \
  package.json \
  tsconfig.json \
  tsconfig.base.json

check_empty \
  "engine clean sibling packages must not import host/product source paths" \
  "(@neptune/engine-product|from ['\"]src/|\\b(require|import)\\(['\"]src/|from ['\"]\\.\\./\\.\\./\\.\\./\\.\\./src/|from ['\"]\\.\\./\\.\\./\\.\\./src/|from ['\"]\\.\\./\\.\\./src/)" \
  packages/agent-tools/src \
  packages/mcp-client/src

# Transitional debt budget for Task #27. builtin-tools is the remaining large
# decoupling surface; keep this budget monotonically decreasing until it reaches
# zero, then replace this check with check_empty.
check_max_count \
  "builtin-tools host/product reverse dependencies must not increase" \
  "(@neptune/engine-product|from ['\"]src/|\\b(require|import)\\(['\"]src/|from ['\"]\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./src/)" \
  714 \
  packages/builtin-tools/src \
  packages/builtin-tools/package.json

check_empty \
  "builtin Bash prompt must not contain product git delivery policy" \
  "(# Committing changes with git|# Creating pull requests|gh pr create|/commit-push-pr|shouldIncludeGitInstructions|getAttributionTexts|getUndercoverInstructions)" \
  packages/builtin-tools/src/tools/BashTool/prompt.ts

check_max_count \
  "builtin-tools React/Ink/product UI imports must not increase" \
  "(@anthropic/ink|from ['\"]react['\"]|import React|import \\* as React|src/ui/components|src/types/message|src/utils/theme)" \
  110 \
  packages/builtin-tools/src

if [[ $status -ne 0 ]]; then
  exit "$status"
fi

echo "Runtime boundary checks passed."
