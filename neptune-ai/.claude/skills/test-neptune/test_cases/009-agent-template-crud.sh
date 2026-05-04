#!/bin/bash
# 用例 009: Agent 模板完整 CRUD
# 验证 POST/GET/PUT/PATCH/DELETE /api/v1/agents 完整生命周期
source "$(dirname "$0")/../scripts/lib.sh"
init_test_log "009-agent-template-crud"

# 加载 token
ADMIN_TOKEN=$(load_var "ADMIN_TOKEN")
if [[ -z "$ADMIN_TOKEN" ]]; then
  log_error "ADMIN_TOKEN not found. Run 003 first."
  finish_test
  exit 1
fi

AUTH_HEADER="-H \"Authorization: Bearer $ADMIN_TOKEN\""
TIMESTAMP=$(date +%s)

# --- 创建第一个 Agent（用于后续 chat 测试，保存 AGENT_TEMPLATE_ID）---
curl_post "/api/v1/agents" "{
  \"name\": \"Chat Agent ${TIMESTAMP}\",
  \"description\": \"Agent for chat tests\",
  \"systemPrompt\": \"You are a helpful assistant.\",
  \"modelConfig\": {
    \"provider\": \"openai\",
    \"model\": \"gpt-4\",
    \"temperature\": 0.7,
    \"maxTokens\": 4096
  },
  \"tools\": [\"Read\", \"Grep\"],
  \"skills\": [],
  \"constraints\": {
    \"maxTokensPerTurn\": 4096,
    \"maxTurnsPerSession\": 10
  }
}" "$AUTH_HEADER"
assert_http_status 201
assert_json_exists ".id"

CHAT_AGENT_ID=$(echo "$LAST_BODY" | jq -r '.id')
log_info "Created chat agent: $CHAT_AGENT_ID"
save_var "AGENT_TEMPLATE_ID" "$CHAT_AGENT_ID"

# --- 创建第二个 Agent（用于 CRUD 测试后删除）---
curl_post "/api/v1/agents" "{
  \"name\": \"Test Agent\",
  \"description\": \"Test\",
  \"systemPrompt\": \"You are a test assistant\",
  \"modelConfig\": {
    \"provider\": \"openai\",
    \"model\": \"gpt-4\",
    \"temperature\": 0.7,
    \"maxTokens\": 4096
  },
  \"tools\": [\"Read\", \"Grep\"],
  \"skills\": [],
  \"constraints\": {
    \"maxTokensPerTurn\": 4096,
    \"maxTurnsPerSession\": 10
  }
}" "$AUTH_HEADER"
assert_http_status 201
assert_json_exists ".id"

AGENT_ID=$(echo "$LAST_BODY" | jq -r '.id')
log_info "Created CRUD agent: $AGENT_ID"

# --- READ: 获取单个 Agent ---
curl_get "/api/v1/agents/${AGENT_ID}" "$AUTH_HEADER"
assert_http_status 200
assert_json_field ".name" "Test Agent"
assert_json_field ".systemPrompt" "You are a test assistant"

# --- UPDATE: 更新 Agent description ---
curl_put "/api/v1/agents/${AGENT_ID}" "{
  \"description\": \"Updated description\"
}" "$AUTH_HEADER"
assert_http_status 200

# --- DEACTIVATE: 停用 Agent ---
curl_patch "/api/v1/agents/${AGENT_ID}/deactivate" "" "$AUTH_HEADER"
assert_http_status 200

# --- ACTIVATE: 启用 Agent ---
curl_patch "/api/v1/agents/${AGENT_ID}/activate" "" "$AUTH_HEADER"
assert_http_status 200

# --- LIST: 获取活跃 Agent 列表 ---
curl_get "/api/v1/agents?active=true" "$AUTH_HEADER"
assert_http_status 200

# --- DELETE: 删除 CRUD 测试 Agent ---
curl_delete "/api/v1/agents/${AGENT_ID}" "$AUTH_HEADER"
assert_http_status 200

log_info "CRUD agent deleted. AGENT_TEMPLATE_ID=$CHAT_AGENT_ID preserved for chat tests."

finish_test
