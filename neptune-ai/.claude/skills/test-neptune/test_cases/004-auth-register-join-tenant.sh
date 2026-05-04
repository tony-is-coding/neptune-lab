#!/bin/bash
# 用例 004: 加入已有租户注册普通用户
# 验证 POST /api/v1/auth/register 使用 tenantId 加入已有租户，角色为 user
source "$(dirname "$0")/../scripts/lib.sh"
init_test_log "004-auth-register-join-tenant"

# 从 003 加载租户 ID
TENANT_ID=$(load_var "TENANT_ID")
if [[ -z "$TENANT_ID" ]]; then
  log_error "TENANT_ID not found. Run 003 first."
  finish_test
  exit 1
fi

# 生成唯一邮箱
TIMESTAMP=$(date +%s)
USER_EMAIL="user-${TIMESTAMP}@test-neptune.io"
USER_PASSWORD="UserPass123!"
USER_NAME="Normal User"

# 加入已有租户
curl_post "/api/v1/auth/register" "{
  \"email\": \"${USER_EMAIL}\",
  \"password\": \"${USER_PASSWORD}\",
  \"name\": \"${USER_NAME}\",
  \"tenantId\": \"${TENANT_ID}\"
}"
assert_http_status 201
assert_json_field ".user.role" "user"
assert_json_field ".user.tenantId" "$TENANT_ID"
assert_json_exists ".accessToken"
assert_json_exists ".refreshToken"

# 保存变量
USER_TOKEN=$(echo "$LAST_BODY" | jq -r '.accessToken')
USER_ID=$(echo "$LAST_BODY" | jq -r '.user.id')

save_var "USER_TOKEN" "$USER_TOKEN"
save_var "USER_ID" "$USER_ID"
save_var "USER_EMAIL" "$USER_EMAIL"

log_info "Saved vars: USER_ID=$USER_ID, USER_EMAIL=$USER_EMAIL"

finish_test
