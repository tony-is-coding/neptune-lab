#!/bin/bash
# 用例 006: 获取当前用户信息 + 鉴权失败
# 验证 GET /api/v1/auth/me 正常返回和无效 token 返回 401
source "$(dirname "$0")/../scripts/lib.sh"
init_test_log "006-auth-me"

# 从 003 加载 token 和用户信息
ADMIN_TOKEN=$(load_var "ADMIN_TOKEN")
ADMIN_EMAIL=$(load_var "ADMIN_EMAIL")
ADMIN_USER_ID=$(load_var "ADMIN_USER_ID")
if [[ -z "$ADMIN_TOKEN" ]]; then
  log_error "ADMIN_TOKEN not found. Run 003 first."
  finish_test
  exit 1
fi

# 有效 token 获取当前用户
curl_get "/api/v1/auth/me" "-H \"Authorization: Bearer $ADMIN_TOKEN\""
assert_http_status 200
assert_json_field ".email" "$ADMIN_EMAIL"
assert_json_field ".role" "admin"
assert_json_exists ".id"

# 无效 token 应返回 401
curl_get "/api/v1/auth/me" "-H \"Authorization: Bearer invalid-token-xxx\""
assert_http_status 401

finish_test
