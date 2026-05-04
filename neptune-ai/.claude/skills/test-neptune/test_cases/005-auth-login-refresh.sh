#!/bin/bash
# 用例 005: 登录 + Token 刷新
# 验证 POST /api/v1/auth/login 和 POST /api/v1/auth/token/refresh
source "$(dirname "$0")/../scripts/lib.sh"
init_test_log "005-auth-login-refresh"

# 从 003 加载管理员凭据
ADMIN_EMAIL=$(load_var "ADMIN_EMAIL")
ADMIN_PASSWORD=$(load_var "ADMIN_PASSWORD")
if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  log_error "ADMIN_EMAIL or ADMIN_PASSWORD not found. Run 003 first."
  finish_test
  exit 1
fi

# 登录
curl_post "/api/v1/auth/login" "{
  \"email\": \"${ADMIN_EMAIL}\",
  \"password\": \"${ADMIN_PASSWORD}\"
}"
assert_http_status 200
assert_json_field ".user.email" "$ADMIN_EMAIL"
assert_json_exists ".accessToken"
assert_json_exists ".refreshToken"
assert_json_exists ".user.id"

# 提取 refreshToken 并刷新
REFRESH_TOKEN=$(echo "$LAST_BODY" | jq -r '.refreshToken')

curl_post "/api/v1/auth/token/refresh" "{
  \"refreshToken\": \"${REFRESH_TOKEN}\"
}"
assert_http_status 200
assert_json_exists ".accessToken"

NEW_ACCESS_TOKEN=$(echo "$LAST_BODY" | jq -r '.accessToken')
log_info "New access token obtained (length: ${#NEW_ACCESS_TOKEN})"

finish_test
