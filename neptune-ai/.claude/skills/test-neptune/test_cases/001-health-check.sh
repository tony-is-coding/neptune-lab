#!/bin/bash
# 用例 001: 健康检查
# 验证 /health 和 /health/db 端点返回正确响应
source "$(dirname "$0")/../scripts/lib.sh"
init_test_log "001-health-check"

# 测试 /health
curl_get "/health"
assert_http_status 200
assert_json_field ".status" "ok"
assert_json_exists ".timestamp"
assert_json_exists ".uptime"

# 测试 /health/db
curl_get "/health/db"
assert_http_status 200
assert_json_field ".status" "ok"
assert_json_field ".database" "connected"

finish_test
