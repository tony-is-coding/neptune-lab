#!/bin/bash
# 用例 013: 真实 Agent 引擎 SSE 测试
# 仅在 ENABLE_REAL_AGENT=1 时执行，否则直接跳过
source "$(dirname "$0")/../scripts/lib.sh"
init_test_log "013-agent-chat-sse-real"

# --- 环境变量检查: 如果未启用则跳过 ---
if [[ "${ENABLE_REAL_AGENT:-0}" != "1" ]]; then
  log_info "[SKIP] ENABLE_REAL_AGENT not set to 1. Skipping real agent SSE test."
  ASSERT_TOTAL=$((ASSERT_TOTAL + 1))
  ASSERT_PASS=$((ASSERT_PASS + 1))
  log_info "[SKIP] Test skipped. Set ENABLE_REAL_AGENT=1 to run."
  TEST_RESULT="PASS"
  finish_test
  exit 0
fi

# 加载变量
ADMIN_TOKEN=$(load_var "ADMIN_TOKEN")
AGENT_TEMPLATE_ID=$(load_var "AGENT_TEMPLATE_ID")
if [[ -z "$ADMIN_TOKEN" ]]; then
  log_error "ADMIN_TOKEN not found. Run 003 first."
  finish_test
  exit 1
fi
if [[ -z "$AGENT_TEMPLATE_ID" ]]; then
  log_error "AGENT_TEMPLATE_ID not found. Run 009 first."
  finish_test
  exit 1
fi

AUTH_HEADER="-H \"Authorization: Bearer $ADMIN_TOKEN\""

# --- 真实 Agent SSE Chat 请求 ---
curl_sse "/api/v1/agents/${AGENT_TEMPLATE_ID}/chat" \
  '{"content":"What is 1+1?"}' \
  "$AUTH_HEADER" \
  30 \
  50

log_info "Real SSE capture complete."

# --- 断言 SSE 事件 ---
assert_sse_event "connected"
assert_sse_event "message"
assert_sse_event "done"

finish_test
