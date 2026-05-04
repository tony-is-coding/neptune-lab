#!/bin/bash
# 用例 014: 计费查询测试
# 验证 admin 角色（非 tenant_admin/platform_admin）访问 billing 端点返回 403
source "$(dirname "$0")/../scripts/lib.sh"
init_test_log "014-billing-query"

# 加载变量
ADMIN_TOKEN=$(load_var "ADMIN_TOKEN")
TENANT_ID=$(load_var "TENANT_ID")
if [[ -z "$ADMIN_TOKEN" ]]; then
  log_error "ADMIN_TOKEN not found. Run 003 first."
  finish_test
  exit 1
fi
if [[ -z "$TENANT_ID" ]]; then
  log_error "TENANT_ID not found. Run 003 first."
  finish_test
  exit 1
fi

AUTH_HEADER="-H \"Authorization: Bearer $ADMIN_TOKEN\""

log_info "NOTE: billing 路由需要 tenant_admin 或 platform_admin 角色。admin 角色预期返回 403。"

# --- admin 角色访问 billing: 预期 403 ---
curl_get "/api/v1/tenants/${TENANT_ID}/billing" "$AUTH_HEADER"
assert_http_status 403

log_info "Confirmed: admin role is correctly rejected from billing endpoint (requires tenant_admin or platform_admin)."

finish_test
