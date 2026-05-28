#!/usr/bin/env bash
# smoke-real-api.sh — examples 真 API smoke（手动触发，需要 API key）
#
# 不进守门。仅本地手动跑用于验证 substrate 与真 LLM API 端到端兼容。
#
# ════════════════════════════════════════════════════════════════════════
# 设计原则
# ════════════════════════════════════════════════════════════════════════
# 该脚本不识别任何 vendor 名（无 OPENCODE_API_KEY / DEEPSEEK_API_KEY 之类的
# vendor 专属变量）。Vendor 知识 = 配置（env），不是代码。
#
# 所有 anthropic-compatible provider 都通过 3 类正交 env 配置：
#   AUTH_MODE   = apikey | bearer  (default apikey)
#   认证值       = API_KEY=... 或 AUTH_TOKEN=...
#   端点+模型    = BASE_URL=... + MODEL=...
#
# 也接受 Anthropic SDK 标准 env（ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN /
# ANTHROPIC_BASE_URL），方便 0 改动接入 cc-switch / claude code 等已有工具链。
#
# ════════════════════════════════════════════════════════════════════════
# 配置场景示例
# ════════════════════════════════════════════════════════════════════════
#
#   # Anthropic 官方 (x-api-key)
#   API_KEY=<api-key> MODEL=claude-sonnet-4-20250514 \
#     bash scripts/smoke-real-api.sh
#
#   # DeepSeek 官方 anthropic endpoint (x-api-key)
#   API_KEY=<api-key> \
#     BASE_URL=https://api.deepseek.com/anthropic \
#     MODEL=deepseek-v4-flash \
#     bash scripts/smoke-real-api.sh
#
#   # 任意 Bearer 认证网关 (含 Vercel AI Gateway / OpenRouter 等)
#   AUTH_MODE=bearer AUTH_TOKEN=... \
#     BASE_URL=https://gateway.example/v1 \
#     MODEL=anthropic/claude-sonnet-4-5 \
#     bash scripts/smoke-real-api.sh
#
#   # 本地协议转换代理 (cc-switch 等)
#   API_KEY=... BASE_URL=http://127.0.0.1:15721 MODEL=... \
#     bash scripts/smoke-real-api.sh
#
#   # 或复用 cc-switch / claude code 已注入的 ANTHROPIC_* env (0 改动)
#   AUTH_MODE=bearer MODEL=deepseek-v4-flash bash scripts/smoke-real-api.sh
#
# ════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

AUTH_MODE_RESOLVED="${AUTH_MODE:-apikey}"
AUTH_MODE_LOWER="$(printf '%s' "$AUTH_MODE_RESOLVED" | tr '[:upper:]' '[:lower:]')"

# 校验认证：根据 AUTH_MODE 检查对应的认证值是否存在
case "$AUTH_MODE_LOWER" in
	bearer)
		if [[ -z "${AUTH_TOKEN:-}" && -z "${ANTHROPIC_AUTH_TOKEN:-}" ]]; then
			echo "❌ AUTH_MODE=bearer requires AUTH_TOKEN (or ANTHROPIC_AUTH_TOKEN)"
			exit 1
		fi
		;;
	apikey|*)
		if [[ -z "${API_KEY:-}" && -z "${ANTHROPIC_API_KEY:-}" ]]; then
			echo "❌ AUTH_MODE=apikey requires API_KEY (or ANTHROPIC_API_KEY)"
			echo ""
			echo "Configure 3 orthogonal env to point substrate at any anthropic-compatible provider:"
			echo "  AUTH_MODE=apikey|bearer        (default: apikey)"
			echo "  API_KEY=...   or  AUTH_TOKEN=..."
			echo "  BASE_URL=...                    (optional; defaults to Anthropic official)"
			echo "  MODEL=...                       (required)"
			echo ""
			echo "See header comment for ready-to-copy scenarios."
			exit 1
		fi
		;;
esac

# MODEL 必填（substrate 不硬编码默认 model）
if [[ -z "${MODEL:-}" ]]; then
	echo "❌ MODEL env var is required. Substrate does not hardcode any default model name."
	exit 1
fi

echo "==> real API smoke config"
echo "    AUTH_MODE = ${AUTH_MODE_RESOLVED}"
echo "    BASE_URL  = ${BASE_URL:-${ANTHROPIC_BASE_URL:-(default Anthropic)}}"
echo "    MODEL     = ${MODEL}"
echo ""

# ----------------------------------------------------------------
# Step 1/3: sdk-pure.ts
# ----------------------------------------------------------------
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
SERVER_PORT="${SERVER_PORT:-$((20000 + RANDOM % 30000))}"
SERVER_LOG="$(mktemp -t smoke-server.XXXXXX)"
SERVER_RUNS_DIR="$(mktemp -d -t smoke-server-runs.XXXXXX)"

(cd "$SERVER_RUNS_DIR" && PORT="$SERVER_PORT" bun run "$ROOT_DIR/examples/sdk-with-server.ts" > "$SERVER_LOG" 2>&1) &
SERVER_PID=$!
echo "[server] pid=$SERVER_PID port=$SERVER_PORT logs=$SERVER_LOG"

# 等 server 起来
for i in 1 2 3 4 5 6 7 8 9 10; do
	if grep -q "listening" "$SERVER_LOG" 2>/dev/null; then
		break
	fi
	sleep 0.3
done

if ! grep -q "listening" "$SERVER_LOG" 2>/dev/null; then
	echo "❌ FAIL: server never reported listening within 3s"
	cat "$SERVER_LOG"
	exit 1
fi
echo "[server] listening confirmed on port $SERVER_PORT"

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
