#!/bin/bash
# 用例 008: 用户 CRUD + 权限控制
# 验证 POST/GET/PUT /api/v1/users 以及普通用户无法创建用户
source "$(dirname "$0")/../scripts/lib.sh"
init_test_log "008-user-crud"

# 加载变量
ADMIN_TOKEN=$(load_var "ADMIN_TOKEN")
USER_TOKEN=$(load_var "USER_TOKEN")
TENANT_ID=$(load_var "TENANT_ID")
if [[ -z "$ADMIN_TOKEN" ]]; then
  log_error "ADMIN_TOKEN not found. Run 003 first."
  finish_test
  exit 1
fi

ADMIN_AUTH="-H \"Authorization: Bearer $ADMIN_TOKEN\""
TIMESTAMP=$(date +%s)

# CREATE: 管理员创建用户
curl_post "/api/v1/users" "{
  \"name\": \"Created-User-${TIMESTAMP}\",
  \"email\": \"created-${TIMESTAMP}@test-neptune.io\",
  \"password\": \"CreatedPass123!\"
}" "$ADMIN_AUTH"
assert_http_status 201
assert_json_exists ".id"

CREATED_USER_ID=$(echo "$LAST_BODY" | jq -r '.id')
log_info "Created user: $CREATED_USER_ID"

# READ: 获取单个用户
curl_get "/api/v1/users/${CREATED_USER_ID}" "$ADMIN_AUTH"
assert_http_status 200
assert_json_field ".id" "$CREATED_USER_ID"

# UPDATE: 更新用户名称
curl_put "/api/v1/users/${CREATED_USER_ID}" "{
  \"name\": \"Updated-User-${TIMESTAMP}\"
}" "$ADMIN_AUTH"
assert_http_status 200

# LIST: 获取用户列表
curl_get "/api/v1/users" "$ADMIN_AUTH"
assert_http_status 200

# 权限控制: 普通用户创建用户应被拒绝 (403)
if [[ -n "$USER_TOKEN" ]]; then
  USER_AUTH="-H \"Authorization: Bearer $USER_TOKEN\""
  curl_post "/api/v1/users" "{
    \"name\": \"Forbidden-User-${TIMESTAMP}\",
    \"email\": \"forbidden-${TIMESTAMP}@test-neptune.io\",
    \"password\": \"ForbiddenPass123!\"
  }" "$USER_AUTH"
  # 期望 403 或 401 均可
  if [[ "$LAST_STATUS" == "403" || "$LAST_STATUS" == "401" ]]; then
    ASSERT_TOTAL=$((ASSERT_TOTAL + 1))
    ASSERT_PASS=$((ASSERT_PASS + 1))
    log_info "[PASS] Non-admin user rejected with status $LAST_STATUS"
  else
    ASSERT_TOTAL=$((ASSERT_TOTAL + 1))
    ASSERT_FAIL=$((ASSERT_FAIL + 1))
    TEST_RESULT="FAIL"
    log_error "[FAIL] Expected 403/401, got $LAST_STATUS"
  fi
else
  log_error "USER_TOKEN not found, skipping permission test. Run 004 first."
fi

finish_test
