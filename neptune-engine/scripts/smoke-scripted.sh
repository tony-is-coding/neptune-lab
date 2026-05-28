#!/usr/bin/env bash
# smoke-scripted.sh — examples 的 scripted smoke（CI 友好，0 API 消耗）
#
# 用 USE_SCRIPTED_PROVIDER=true 跑三个 SDK example，验证：
# 1. example 文件可执行 + provider 切换逻辑正确
# 2. 关键输出（[assistant] / [start] runId= / [server] listening）存在
# 3. FileRunStore 状态外化生效（runs/<runId>/run.json 存在）
#
# 进守门 v2 D.10。
#
# 真 API smoke 由 scripts/smoke-real-api.sh 单独触发，不进守门。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "==> Running examples scripted smoke (USE_SCRIPTED_PROVIDER=true)..."
bun test examples/__tests__/examples.smoke.test.ts

echo ""
echo "==> ✅ examples scripted smoke PASS"
