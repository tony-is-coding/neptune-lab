#!/bin/bash
# 用例 011: RBAC 权限边界测试
# 验证普通用户（user 角色）的权限边界：写操作被拒绝，读操作允许
source "$(dirname "$0")/../scripts/lib.sh"
init_test_log "011-rbac-permissions"

# 加载 user token
USER_TOKEN=$(load_var "USER_TOKEN")
if [[ -z "$USER_TOKEN" ]]; then
  log_error "USER_TOKEN not found. Run 004 first."
  finish_test
  exit 1
fi

USER_AUTH="-H \"Authorization: Bearer $USER_TOKEN\""
TIMESTAMP=$(date +%s)

# --- POST /tenants: 普通用户应被拒绝 (403) ---
curl_post "/api/v1/tenants" "{
  \"name\": \"Forbidden Tenant ${TIMESTAMP}\"
}" "$USER_AUTH"
log_info "User POST /tenants: status=$LAST_STATUS"
ASSERT_TOTAL=$((ASSERT_TOTAL + 1))
if [[ "$LAST_STATUS" == "403" || "$LAST_STATUS" == "401" ]]; then
  ASSERT_PASS=$((ASSERT_PASS + 1))
  log_info "[PASS] User rejected from POST /tenants with status $LAST_STATUS"
else
  ASSERT_FAIL=$((ASSERT_FAIL + 1))
  TEST_RESULT="FAIL"
  log_error "[FAIL] Expected 403/401 for POST /tenants, got $LAST_STATUS"
fi

# --- POST /users: 普通用户应被拒绝 ---
curl_post "/api/v1/users" "{
  \"name\": \"Forbidden User\",
  \"email\": \"forbidden-${TIMESTAMP}@test.io\",
  \"password\": \"Pass123!\"
}" "$USER_AUTH"
log_info "User POST /users: status=$LAST_STATUS"
ASSERT_TOTAL=$((ASSERT_TOTAL + 1))
if [[ "$LAST_STATUS" == "403" || "$LAST_STATUS" == "401" ]]; then
  ASSERT_PASS=$((ASSERT_PASS + 1))
  log_info "[PASS] User rejected from POST /users with status $LAST_STATUS"
else
  ASSERT_FAIL=$((ASSERT_FAIL + 1))
  TEST_RESULT="FAIL"
  log_error "[FAIL] Expected 403/401 for POST /users, got $LAST_STATUS"
fi

# --- POST /agents: 普通用户应被拒绝 ---
curl_post "/api/v1/agents" "{
  \"name\": \"Forbidden Agent\",
  \"description\": \"Should be rejected\",
  \"systemPrompt\": \"test\"
}" "$USER_AUTH"
log_info "User POST /agents: status=$LAST_STATUS"
ASSERT_TOTAL=$((ASSERT_TOTAL + 1))
if [[ "$LAST_STATUS" == "403" || "$LAST_STATUS" == "401" ]]; then
  ASSERT_PASS=$((ASSERT_PASS + 1))
  log_info "[PASS] User rejected from POST /agents with status $LAST_STATUS"
else
  ASSERT_FAIL=$((ASSERT_FAIL + 1))
  TEST_RESULT="FAIL"
  log_error "[FAIL] Expected 403/401 for POST /agents, got $LAST_STATUS"
fi

# --- GET /agents: 普通用户应该成功 (200) ---
curl_get "/api/v1/agents" "$USER_AUTH"
assert_http_status 200
log_info "User GET /agents: allowed as expected"

# --- GET /users: 普通用户应该成功 (200) ---
curl_get "/api/v1/users" "$USER_AUTH"
assert_http_status 200
log_info "User GET /users: allowed as expected"

finish_test
