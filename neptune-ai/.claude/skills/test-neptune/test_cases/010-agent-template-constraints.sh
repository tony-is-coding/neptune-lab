#!/bin/bash
# 用例 010: Agent 模板字段校验
# 验证缺少必填字段时返回错误，完整字段时创建成功
source "$(dirname "$0")/../scripts/lib.sh"
init_test_log "010-agent-template-constraints"

# 加载 token
ADMIN_TOKEN=$(load_var "ADMIN_TOKEN")
if [[ -z "$ADMIN_TOKEN" ]]; then
  log_error "ADMIN_TOKEN not found. Run 003 first."
  finish_test
  exit 1
fi

AUTH_HEADER="-H \"Authorization: Bearer $ADMIN_TOKEN\""

# --- 缺少 systemPrompt: 应返回 400 或 500，不是 201 ---
curl_post "/api/v1/agents" "{
  \"name\": \"No Prompt Agent\",
  \"description\": \"Missing systemPrompt\"
}" "$AUTH_HEADER"
log_info "Missing systemPrompt: status=$LAST_STATUS"
ASSERT_TOTAL=$((ASSERT_TOTAL + 1))
if [[ "$LAST_STATUS" != "201" ]]; then
  ASSERT_PASS=$((ASSERT_PASS + 1))
  log_info "[PASS] Missing systemPrompt rejected with status $LAST_STATUS (not 201)"
else
  ASSERT_FAIL=$((ASSERT_FAIL + 1))
  TEST_RESULT="FAIL"
  log_error "[FAIL] Missing systemPrompt should not return 201, got $LAST_STATUS"
fi

# --- 缺少 name: 应返回 400 ---
curl_post "/api/v1/agents" "{
  \"description\": \"Missing name\",
  \"systemPrompt\": \"You are a test assistant\"
}" "$AUTH_HEADER"
log_info "Missing name: status=$LAST_STATUS"
ASSERT_TOTAL=$((ASSERT_TOTAL + 1))
if [[ "$LAST_STATUS" == "400" ]]; then
  ASSERT_PASS=$((ASSERT_PASS + 1))
  log_info "[PASS] Missing name rejected with status 400"
else
  ASSERT_FAIL=$((ASSERT_FAIL + 1))
  TEST_RESULT="FAIL"
  log_error "[FAIL] Missing name: expected 400, got $LAST_STATUS"
fi

# --- 正常创建（完整字段）: 应返回 201 ---
curl_post "/api/v1/agents" "{
  \"name\": \"Valid Agent\",
  \"description\": \"All fields provided\",
  \"systemPrompt\": \"You are a test assistant\",
  \"modelConfig\": {
    \"provider\": \"openai\",
    \"model\": \"gpt-4\",
    \"temperature\": 0.7,
    \"maxTokens\": 4096
  },
  \"tools\": [\"Read\"],
  \"skills\": [],
  \"constraints\": {
    \"maxTokensPerTurn\": 4096,
    \"maxTurnsPerSession\": 10
  }
}" "$AUTH_HEADER"
assert_http_status 201
assert_json_exists ".id"

log_info "Valid agent created successfully."

finish_test
