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
#
# OpenCode Go anthropic endpoint（含 Bearer 认证）：
#   OPENCODE_API_KEY=oc-... bash scripts/smoke-real-api.sh
#   # 默认 model=minimax-m2.7（当下最强 anthropic-compat），可改 MODEL=qwen3.5-plus 等
#
# 自定义 anthropic-compatible 第三方（Bearer 认证）：
#   AUTH_TOKEN=... BASE_URL=https://your-gateway/v1 MODEL=... bash scripts/smoke-real-api.sh
#
# 自定义 anthropic-compatible 第三方（x-api-key 认证）：
#   API_KEY=... BASE_URL=https://your-proxy.example.com/anthropic MODEL=... \
#     bash scripts/smoke-real-api.sh
#
# 输出：
#   - 三个 example 各跑一次 + 实际 LLM 输出
#   - 第三个 example（server）会真 POST + GET SSE 验证完整 HTTP/SSE 转发链路

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# 决定走哪个真 API（优先级：AUTH_TOKEN > API_KEY > vendor 专属 key）
if [[ -z "${API_KEY:-}" && -z "${AUTH_TOKEN:-}" \
   && -z "${ANTHROPIC_API_KEY:-}" && -z "${ANTHROPIC_AUTH_TOKEN:-}" \
   && -z "${DEEPSEEK_API_KEY:-}" && -z "${OPENCODE_API_KEY:-}" ]]; then
	echo "❌ Set one of: AUTH_TOKEN / API_KEY / ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / DEEPSEEK_API_KEY / OPENCODE_API_KEY"
	echo ""
	echo "Quick start:"
	echo "  # OpenCode Go (你已订阅的)："
	echo "  export OPENCODE_API_KEY=oc-..."
	echo "  bash scripts/smoke-real-api.sh"
	echo ""
	echo "  # DeepSeek 直 API (最便宜)："
	echo "  export DEEPSEEK_API_KEY=sk-..."
	echo "  bash scripts/smoke-real-api.sh"
	exit 1
fi

# 默认 endpoint：自动识别 vendor key
if [[ -z "${BASE_URL:-}" && -n "${OPENCODE_API_KEY:-}" \
   && -z "${ANTHROPIC_API_KEY:-}" && -z "${API_KEY:-}" \
   && -z "${ANTHROPIC_AUTH_TOKEN:-}" && -z "${AUTH_TOKEN:-}" \
   && -z "${DEEPSEEK_API_KEY:-}" ]]; then
	# OpenCode Go 路径（Bearer 认证）
	export BASE_URL="https://opencode.ai/zen/go/v1"
	export MODEL="${MODEL:-minimax-m2.7}"
	echo "==> Using OpenCode Go anthropic-compatible endpoint"
	echo "    BASE_URL=$BASE_URL"
	echo "    MODEL=$MODEL  (Anthropic-compat models on OpenCode Go: minimax-m2.7 / minimax-m2.5 / qwen3.6-plus / qwen3.5-plus)"
elif [[ -z "${BASE_URL:-}" && -n "${DEEPSEEK_API_KEY:-}" \
     && -z "${ANTHROPIC_API_KEY:-}" && -z "${API_KEY:-}" \
     && -z "${ANTHROPIC_AUTH_TOKEN:-}" && -z "${AUTH_TOKEN:-}" ]]; then
	# DeepSeek 直 API 路径（x-api-key 认证）
	export BASE_URL="https://api.deepseek.com/anthropic"
	export MODEL="${MODEL:-deepseek-v4-flash}"
	echo "==> Using DeepSeek anthropic-compatible endpoint"
	echo "    BASE_URL=$BASE_URL"
	echo "    MODEL=$MODEL"
elif [[ -n "${ANTHROPIC_API_KEY:-}" || -n "${API_KEY:-}" \
     || -n "${ANTHROPIC_AUTH_TOKEN:-}" || -n "${AUTH_TOKEN:-}" ]]; then
	# Anthropic 官方或自定义网关
	export MODEL="${MODEL:-claude-sonnet-4-20250514}"
	echo "==> Using endpoint: ${BASE_URL:-default Anthropic}"
	echo "    MODEL=$MODEL"
fi

# ----------------------------------------------------------------
# Step 1/3: sdk-pure.ts
# ----------------------------------------------------------------
echo ""
echo "============================================================"
echo "==> [1/3] sdk-pure.ts (in-process, no store)"
echo "============================================================"
bun run examples/sdk-pure.ts

# ----------------------------------------------------------------
# Step 2/3: sdk-with-fs-store.ts
# ----------------------------------------------------------------
echo ""
echo "============================================================"
echo "==> [2/3] sdk-with-fs-store.ts (state externalized to ./runs/)"
echo "============================================================"
SMOKE_TMP_DIR="$(mktemp -d -t smoke-real-api.XXXXXX)"
trap 'rm -rf "$SMOKE_TMP_DIR" 2>/dev/null || true; [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID" 2>/dev/null || true' EXIT

(cd "$SMOKE_TMP_DIR" && bun run "$ROOT_DIR/examples/sdk-with-fs-store.ts")

# 验证 run.json 真的写了
RUN_DIR="$(find "$SMOKE_TMP_DIR/runs" -mindepth 1 -maxdepth 1 -type d | head -1)"
if [[ -z "$RUN_DIR" || ! -f "$RUN_DIR/run.json" ]]; then
	echo "❌ FAIL: runs/<runId>/run.json not created"
	exit 1
fi
echo ""
echo "✅ run.json created at: $RUN_DIR/run.json"
echo "   size: $(wc -c < "$RUN_DIR/run.json") bytes"
EVENT_COUNT=$(wc -l < "$RUN_DIR/events.jsonl" 2>/dev/null || echo 0)
echo "   events count: $EVENT_COUNT"

# ----------------------------------------------------------------
# Step 3/3: sdk-with-server.ts — 真 HTTP/SSE e2e
# ----------------------------------------------------------------
echo ""
echo "============================================================"
echo "==> [3/3] sdk-with-server.ts (real HTTP server + SSE)"
echo "============================================================"
SERVER_PORT="${SERVER_PORT:-3789}"
SERVER_LOG="$(mktemp -t smoke-server.XXXXXX)"
SERVER_RUNS_DIR="$(mktemp -d -t smoke-server-runs.XXXXXX)"

(cd "$SERVER_RUNS_DIR" && PORT="$SERVER_PORT" bun run "$ROOT_DIR/examples/sdk-with-server.ts" > "$SERVER_LOG" 2>&1) &
SERVER_PID=$!
echo "[server] pid=$SERVER_PID port=$SERVER_PORT logs=$SERVER_LOG"

# 等 server 起来
for i in 1 2 3 4 5 6 7 8 9 10; do
	if curl -sS "http://localhost:$SERVER_PORT/" > /dev/null 2>&1 || \
	   grep -q "listening" "$SERVER_LOG" 2>/dev/null; then
		break
	fi
	sleep 0.3
done

if ! grep -q "listening" "$SERVER_LOG" 2>/dev/null; then
	echo "❌ FAIL: server never reported listening within 3s"
	cat "$SERVER_LOG"
	exit 1
fi
echo "[server] listening confirmed"

# POST /runs
echo ""
echo "==> POST /runs"
RUN_RESP="$(curl -sS -X POST "http://localhost:$SERVER_PORT/runs" \
	-H "Content-Type: application/json" \
	-d '{"prompt":"Say hi in one word."}')"
echo "    response: $RUN_RESP"

RUN_ID="$(echo "$RUN_RESP" | sed -E 's/.*"runId":"([^"]+)".*/\1/')"
if [[ -z "$RUN_ID" || "$RUN_ID" == "$RUN_RESP" ]]; then
	echo "❌ FAIL: could not extract runId from response"
	exit 1
fi
echo "    runId: $RUN_ID"

# GET /runs/:id/events (SSE)
echo ""
echo "==> GET /runs/$RUN_ID/events (SSE，最多等 30s)"
SSE_OUTPUT="$(mktemp -t smoke-sse.XXXXXX)"
curl -sS -N --max-time 30 "http://localhost:$SERVER_PORT/runs/$RUN_ID/events" \
	> "$SSE_OUTPUT" 2>&1 || true

# 检查 SSE 输出
SSE_LINES="$(wc -l < "$SSE_OUTPUT")"
echo "    received lines: $SSE_LINES"
if grep -q '"type":"assistant_message"' "$SSE_OUTPUT" || \
   grep -q '"type":"text_delta"' "$SSE_OUTPUT" || \
   grep -q 'event: done' "$SSE_OUTPUT"; then
	echo "    ✅ SSE stream contains expected events"
else
	echo "    ⚠️  SSE output (first 30 lines):"
	head -30 "$SSE_OUTPUT" | sed 's/^/      /'
	echo "❌ FAIL: SSE stream did not contain expected events"
	exit 1
fi

# 关闭 server
kill "$SERVER_PID" 2>/dev/null || true
wait "$SERVER_PID" 2>/dev/null || true
SERVER_PID=

rm -f "$SSE_OUTPUT" "$SERVER_LOG"
rm -rf "$SERVER_RUNS_DIR"

echo ""
echo "============================================================"
echo "==> ✅ All real-API smoke tests passed"
echo "============================================================"
echo ""
echo "Summary:"
echo "  [1/3] sdk-pure.ts        — in-process LLM call OK"
echo "  [2/3] sdk-with-fs-store  — state externalization OK ($EVENT_COUNT events persisted)"
echo "  [3/3] sdk-with-server    — HTTP + SSE end-to-end OK"
