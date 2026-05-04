#!/bin/bash
# 用例 015: Agent 对话历史测试
# 验证 GET /api/v1/agents/:id/history 返回正确结构
source "$(dirname "$0")/../scripts/lib.sh"
init_test_log "015-agent-chat-history"

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

# --- GET 对话历史 ---
curl_get "/api/v1/agents/${AGENT_TEMPLATE_ID}/history" "$AUTH_HEADER"
assert_http_status 200

# --- 断言返回结构有 meta 字段 ---
assert_json_exists ".meta"
log_info "History response contains .meta field."

# --- 检查 data 字段 ---
DATA_LENGTH=$(echo "$LAST_BODY" | jq -r '.data | length' 2>/dev/null || echo "0")
if [[ "$DATA_LENGTH" == "0" ]]; then
  log_info "History data is empty (no chat history yet). This is a valid state."
else
  log_info "History data contains $DATA_LENGTH entries."
fi

finish_test
