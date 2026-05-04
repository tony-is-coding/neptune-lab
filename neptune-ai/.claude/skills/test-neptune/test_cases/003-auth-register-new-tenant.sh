#!/bin/bash
# 用例 003: 注册新租户管理员
# 验证 POST /api/v1/auth/register 创建新租户并返回管理员身份
source "$(dirname "$0")/../scripts/lib.sh"
init_test_log "003-auth-register-new-tenant"

# 生成唯一邮箱
TIMESTAMP=$(date +%s)
ADMIN_EMAIL="admin-${TIMESTAMP}@test-neptune.io"
ADMIN_PASSWORD="TestPass123!"
ADMIN_NAME="Admin User"
TENANT_NAME="Test Tenant ${TIMESTAMP}"

# 注册新租户管理员
curl_post "/api/v1/auth/register" "{
  \"email\": \"${ADMIN_EMAIL}\",
  \"password\": \"${ADMIN_PASSWORD}\",
  \"name\": \"${ADMIN_NAME}\",
  \"tenantName\": \"${TENANT_NAME}\"
}"
assert_http_status 201
assert_json_field ".user.role" "admin"
assert_json_exists ".user.tenantId"
assert_json_exists ".accessToken"
assert_json_exists ".refreshToken"

# 提取并保存变量供后续用例使用
TENANT_ID=$(echo "$LAST_BODY" | jq -r '.user.tenantId')
ADMIN_USER_ID=$(echo "$LAST_BODY" | jq -r '.user.id')
ADMIN_TOKEN=$(echo "$LAST_BODY" | jq -r '.accessToken')

save_var "ADMIN_TOKEN" "$ADMIN_TOKEN"
save_var "TENANT_ID" "$TENANT_ID"
save_var "ADMIN_USER_ID" "$ADMIN_USER_ID"
save_var "ADMIN_EMAIL" "$ADMIN_EMAIL"
save_var "ADMIN_PASSWORD" "$ADMIN_PASSWORD"

log_info "Saved vars: TENANT_ID=$TENANT_ID, ADMIN_USER_ID=$ADMIN_USER_ID, ADMIN_EMAIL=$ADMIN_EMAIL"

finish_test
