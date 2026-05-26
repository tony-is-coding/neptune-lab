#!/usr/bin/env bash
# smoke-real-api.sh — examples 的真 API smoke（手动触发，需要 API key）
#
# 不进守门。仅本地手动跑用于验证 substrate 与真 LLM API 端到端兼容。
#
# 默认配置：DeepSeek anthropic-compatible endpoint + deepseek-v4-flash
# （DeepSeek 完整支持 Anthropic 协议的 system/messages/tools/tool_use/tool_result/stream）
#
# 切换到 Anthropic 官方：
#   ANTHROPIC_API_KEY=sk-ant-... MODEL=claude-sonnet-4-20250514 \
#     bash scripts/smoke-real-api.sh
#
# DeepSeek（默认）：
#   DEEPSEEK_API_KEY=sk-... bash scripts/smoke-real-api.sh
#   # 或显式：
#   DEEPSEEK_API_KEY=sk-... MODEL=deepseek-v4-flash \
#     BASE_URL=https://api.deepseek.com/anthropic \
#     bash scripts/smoke-real-api.sh
#
# 自定义 anthropic-compatible 第三方：
#   API_KEY=... BASE_URL=https://your-proxy.example.com/anthropic MODEL=... \
#     bash scripts/smoke-real-api.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# 决定走哪个真 API（优先级：API_KEY > ANTHROPIC_API_KEY > DEEPSEEK_API_KEY）
if [[ -z "${API_KEY:-}" && -z "${ANTHROPIC_API_KEY:-}" && -z "${DEEPSEEK_API_KEY:-}" ]]; then
	echo "❌ Set one of: API_KEY / ANTHROPIC_API_KEY / DEEPSEEK_API_KEY"
	echo ""
	echo "Quick start (DeepSeek, cheapest):"
	echo "  export DEEPSEEK_API_KEY=sk-..."
	echo "  bash scripts/smoke-real-api.sh"
	exit 1
fi

# 默认 endpoint：DeepSeek 优先（如果只有 DEEPSEEK_API_KEY，自动切到 DeepSeek endpoint + flash 模型）
if [[ -z "${BASE_URL:-}" && -n "${DEEPSEEK_API_KEY:-}" && -z "${ANTHROPIC_API_KEY:-}" && -z "${API_KEY:-}" ]]; then
	export BASE_URL="https://api.deepseek.com/anthropic"
	export MODEL="${MODEL:-deepseek-v4-flash}"
	echo "==> Using DeepSeek anthropic-compatible endpoint"
	echo "    BASE_URL=$BASE_URL"
	echo "    MODEL=$MODEL"
elif [[ -n "${ANTHROPIC_API_KEY:-}" || -n "${API_KEY:-}" ]]; then
	# Anthropic 官方或自定义
	export MODEL="${MODEL:-claude-sonnet-4-20250514}"
	echo "==> Using endpoint: ${BASE_URL:-default Anthropic}"
	echo "    MODEL=$MODEL"
fi

echo ""
echo "==> [1/3] sdk-pure.ts (in-process, no store)"
bun run examples/sdk-pure.ts

echo ""
echo "==> [2/3] sdk-with-fs-store.ts (state externalized to ./runs/)"
SMOKE_TMP_DIR="$(mktemp -d -t smoke-real-api.XXXXXX)"
trap 'rm -rf "$SMOKE_TMP_DIR"' EXIT
(cd "$SMOKE_TMP_DIR" && bun run "$ROOT_DIR/examples/sdk-with-fs-store.ts")

echo ""
echo "==> [3/3] sdk-with-server.ts (HTTP server with SSE, exit-after-listen mode)"
EXIT_AFTER_LISTEN=true PORT=0 bun run examples/sdk-with-server.ts

echo ""
echo "==> ✅ All real-API smoke tests passed"
