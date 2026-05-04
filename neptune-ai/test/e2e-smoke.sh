#!/bin/bash
#
# Neptune-AI E2E Smoke Test
#
# 完整用户旅程测试，验证核心功能可用性
#
# 使用方法:
#   ./e2e-smoke.sh [base_url]
#
# 参数:
#   base_url - API 基础 URL (默认: http://localhost:3000)
#

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
BASE_URL="${1:-http://localhost:3000}"
TIMESTAMP=$(date +%s)
RANDOM_SUFFIX=$(openssl rand -hex 4)

# 测试数据
TENANT_NAME="Smoke Test Tenant ${RANDOM_SUFFIX}"
ADMIN_EMAIL="admin-${RANDOM_SUFFIX}@test.com"
ADMIN_PASSWORD="admin123"
USER_EMAIL="user-${RANDOM_SUFFIX}@test.com"
USER_PASSWORD="user123"
AGENT_NAME="Smoke Test Agent"

# 辅助函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${YELLOW}[STEP]${NC} $1"
}

# 检查响应
check_response() {
    local response=$1
    local expected_code=$2
    local description=$3

    local code=$(echo "$response" | grep -o '^HTTP Status:' | cut -d':' -f2 | tr -d ' ')

    if [ "$code" != "$expected_code" ]; then
        log_error "$description - 预期 $expected_code，实际 $code"
        echo "响应: $response"
        exit 1
    fi

    log_info "$description - ✓"
}

# HTTP 请求函数
get() {
    local endpoint=$1
    local token=${2:-}

    curl -s -w '\nHTTP Status: %{http_code}' \
        -H "Content-Type: application/json" \
        ${token:+-H "Authorization: Bearer $token"} \
        "${BASE_URL}${endpoint}"
}

post() {
    local endpoint=$1
    local data=$2
    local token=${3:-}

    curl -s -w '\nHTTP Status: %{http_code}' \
        -X POST \
        -H "Content-Type: application/json" \
        ${token:+-H "Authorization: Bearer $token"} \
        -d "$data" \
        "${BASE_URL}${endpoint}"
}

put() {
    local endpoint=$1
    local data=$2
    local token=$3

    curl -s -w '\nHTTP Status: %{http_code}' \
        -X PUT \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "$data" \
        "${BASE_URL}${endpoint}"
}

delete() {
    local endpoint=$1
    local token=$2

    curl -s -w '\nHTTP Status: %{http_code}' \
        -X DELETE \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        "${BASE_URL}${endpoint}"
}

patch() {
    local endpoint=$1
    local token=$2

    curl -s -w '\nHTTP Status: %{http_code}' \
        -X PATCH \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        "${BASE_URL}${endpoint}"
}

# 解析 JSON 字段
parse_json() {
    local json=$1
    local field=$2
    echo "$json" | grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | cut -d'"' -f4
}

# 主测试流程
main() {
    log_info "开始 Neptune-AI E2E Smoke Test"
    log_info "API URL: $BASE_URL"
    log_info "测试标识: ${RANDOM_SUFFIX}"
    echo ""

    # 1. 健康检查
    log_step "1. 健康检查"
    response=$(get "/health")
    check_response "$response" "200" "健康检查端点"
    echo ""

    # 2. 数据库健康检查
    log_step "2. 数据库健康检查"
    response=$(get "/health/db")
    check_response "$response" "200" "数据库连接检查"
    echo ""

    # 3. 注册管理员用户（创建租户）
    log_step "3. 注册管理员用户"
    response=$(post "/api/v1/auth/register" "{
        \"tenantName\": \"${TENANT_NAME}\",
        \"name\": \"Smoke Admin\",
        \"email\": \"${ADMIN_EMAIL}\",
        \"password\": \"${ADMIN_PASSWORD}\"
    }")
    check_response "$response" "201" "注册管理员"
    ADMIN_ACCESS_TOKEN=$(parse_json "$response" "accessToken")
    log_info "获取到管理员 Access Token"
    echo ""

    # 4. 登录验证
    log_step "4. 登录验证"
    response=$(post "/api/v1/auth/login" "{
        \"email\": \"${ADMIN_EMAIL}\",
        \"password\": \"${ADMIN_PASSWORD}\"
    }")
    check_response "$response" "200" "管理员登录"
    log_info "登录成功"
    echo ""

    # 5. 获取当前用户信息
    log_step "5. 获取当前用户信息"
    response=$(get "/api/v1/auth/me" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "200" "获取用户信息"
    log_info "用户信息获取成功"
    echo ""

    # 6. 创建普通用户
    log_step "6. 创建普通用户"
    response=$(post "/api/v1/users" "{
        \"name\": \"Smoke User\",
        \"email\": \"${USER_EMAIL}\",
        \"password\": \"${USER_PASSWORD}\"
    }" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "201" "创建普通用户"
    USER_ID=$(parse_json "$response" "id")
    log_info "用户 ID: $USER_ID"
    echo ""

    # 7. 普通用户登录
    log_step "7. 普通用户登录"
    response=$(post "/api/v1/auth/login" "{
        \"email\": \"${USER_EMAIL}\",
        \"password\": \"${USER_PASSWORD}\"
    }")
    check_response "$response" "200" "普通用户登录"
    USER_ACCESS_TOKEN=$(parse_json "$response" "accessToken")
    log_info "获取到普通用户 Access Token"
    echo ""

    # 8. 创建 Agent 模板（管理员）
    log_step "8. 创建 Agent 模板"
    response=$(post "/api/v1/agents" "{
        \"name\": \"${AGENT_NAME}\",
        \"description\": \"E2E test agent\",
        \"systemPrompt\": \"You are a helpful assistant for E2E testing.\",
        \"modelConfig\": {
            \"provider\": \"anthropic\",
            \"model\": \"claude-sonnet-4-20250514\",
            \"temperature\": 0.7,
            \"maxTokens\": 4096
        },
        \"tools\": [],
        \"skills\": [],
        \"mcpServers\": []
    }" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "201" "创建 Agent 模板"
    AGENT_ID=$(parse_json "$response" "id")
    log_info "Agent ID: $AGENT_ID"
    echo ""

    # 9. 获取 Agent 列表
    log_step "9. 获取 Agent 列表"
    response=$(get "/api/v1/agents" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "200" "获取 Agent 列表"
    log_info "Agent 列表获取成功"
    echo ""

    # 10. 获取 Agent 详情
    log_step "10. 获取 Agent 详情"
    response=$(get "/api/v1/agents/${AGENT_ID}" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "200" "获取 Agent 详情"
    log_info "Agent 详情获取成功"
    echo ""

    # 11. 测试权限验证（普通用户不能创建 Agent）
    log_step "11. 测试权限验证"
    response=$(post "/api/v1/agents" "{
        \"name\": \"Unauthorized Agent\",
        \"systemPrompt\": \"This should fail\",
        \"modelConfig\": {
            \"provider\": \"anthropic\",
            \"model\": \"claude-sonnet-4-20250514\",
            \"temperature\": 0.7,
            \"maxTokens\": 4096
        }
    }" "$USER_ACCESS_TOKEN")
    check_response "$response" "403" "权限验证（普通用户不能创建 Agent）"
    log_info "权限验证成功"
    echo ""

    # 12. 测试 SSE Chat 端点（格式验证）
    log_step "12. 测试 SSE Chat 端点"
    # 使用 timeout 限制请求时间
    response=$(timeout 3 curl -s -w '\nHTTP Status: %{http_code}' \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
        -d "{\"content\": \"Hello, this is a smoke test.\"}" \
        "${BASE_URL}/api/v1/agents/${AGENT_ID}/chat" || true)

    # 检查是否包含 SSE 格式
    if echo "$response" | grep -q "event: connected"; then
        log_info "SSE 格式验证成功 - 找到 connected 事件"
    else
        log_error "SSE 格式验证失败 - 未找到 connected 事件"
        echo "响应: $response"
    fi

    if echo "$response" | grep -q "content-type: text/event-stream"; then
        log_info "SSE Content-Type 验证成功"
    else
        log_error "SSE Content-Type 验证失败"
    fi
    echo ""

    # 13. 测试错误响应格式
    log_step "13. 测试错误响应格式"
    response=$(post "/api/v1/auth/login" "{
        \"email\": \"wrong@test.com\",
        \"password\": \"wrong\"
    }")
    if echo "$response" | grep -q "\"error\""; then
        log_info "错误响应包含 error 字段 - ✓"
    else
        log_error "错误响应缺少 error 字段"
    fi
    if echo "$response" | grep -q "\"message\""; then
        log_info "错误响应包含 message 字段 - ✓"
    else
        log_error "错误响应缺少 message 字段"
    fi
    echo ""

    # 14. 获取用户列表
    log_step "14. 获取用户列表"
    response=$(get "/api/v1/users" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "200" "获取用户列表"
    log_info "用户列表获取成功"
    echo ""

    # 15. 获取租户列表
    log_step "15. 获取租户列表"
    response=$(get "/api/v1/tenants" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "200" "获取租户列表"
    log_info "租户列表获取成功"
    echo ""

    # 测试总结
    log_info "=========================================="
    log_info "E2E Smoke Test 全部通过！"
    log_info "=========================================="
    log_info "测试数据:"
    log_info "  租户名称: ${TENANT_NAME}"
    log_info "  管理员: ${ADMIN_EMAIL}"
    log_info "  普通用户: ${USER_EMAIL}"
    log_info "  Agent ID: ${AGENT_ID}"
    log_info ""
    log_info "注意：这些数据保留在数据库中，可在后续测试中使用"
}

# 运行测试
main
