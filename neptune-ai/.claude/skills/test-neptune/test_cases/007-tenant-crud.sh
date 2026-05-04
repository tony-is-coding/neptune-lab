#!/bin/bash
# 用例 007: 租户 CRUD 操作
# 验证 POST/GET/PUT/DELETE /api/v1/tenants 完整生命周期
source "$(dirname "$0")/../scripts/lib.sh"
init_test_log "007-tenant-crud"

# 从 003 加载 token
ADMIN_TOKEN=$(load_var "ADMIN_TOKEN")
if [[ -z "$ADMIN_TOKEN" ]]; then
  log_error "ADMIN_TOKEN not found. Run 003 first."
  finish_test
  exit 1
fi

AUTH_HEADER="-H \"Authorization: Bearer $ADMIN_TOKEN\""
TIMESTAMP=$(date +%s)

# CREATE: 创建租户
curl_post "/api/v1/tenants" "{
  \"name\": \"Tenant-${TIMESTAMP}\"
}" "$AUTH_HEADER"
assert_http_status 201
assert_json_exists ".id"

CREATED_TENANT_ID=$(echo "$LAST_BODY" | jq -r '.id')
log_info "Created tenant: $CREATED_TENANT_ID"

# READ: 获取单个租户
curl_get "/api/v1/tenants/${CREATED_TENANT_ID}" "$AUTH_HEADER"
assert_http_status 200
assert_json_field ".id" "$CREATED_TENANT_ID"

# UPDATE: 更新租户名称
curl_put "/api/v1/tenants/${CREATED_TENANT_ID}" "{
  \"name\": \"Updated-Tenant-${TIMESTAMP}\"
}" "$AUTH_HEADER"
assert_http_status 200

# LIST: 获取租户列表
curl_get "/api/v1/tenants" "$AUTH_HEADER"
assert_http_status 200

# DELETE: 删除租户
curl_delete "/api/v1/tenants/${CREATED_TENANT_ID}" "$AUTH_HEADER"
assert_http_status 200

finish_test
