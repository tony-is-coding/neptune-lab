#!/bin/bash
# 用例 002: 错误响应格式
# 验证 404 和 401 错误响应格式
source "$(dirname "$0")/../scripts/lib.sh"
init_test_log "002-error-responses"

# 测试 404 — 不存在的路径
curl_get "/api/v1/nonexistent-path"
assert_http_status 404

# 测试 401 — 无 token 访问受保护路径
curl_get "/api/v1/auth/me"
assert_http_status 401
assert_json_field ".error" "UNAUTHORIZED"

# 测试 401 — 无效 token
curl_get "/api/v1/auth/me" '-H "Authorization: Bearer invalid-token-xxx"'
assert_http_status 401

finish_test
