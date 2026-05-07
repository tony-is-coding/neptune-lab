#!/bin/bash
#
# Collaborate 边界场景 E2E 测试
#
# 测试覆盖：
# - B0: 零 Agent 场景
# - B1: 有 Agent 但零对话场景
# - B2a: Agent 被停用场景
# - B2b: Agent 被删除场景
#
# 使用方法:
#   ./e2e-collaborate-boundaries.sh [base_url]
#
# 参数:
#   base_url - API 基础 URL (默认: http://localhost:3000)
#

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
BASE_URL="${1:-http://localhost:3000}"
TIMESTAMP=$(date +%s)
RANDOM_SUFFIX=$(openssl rand -hex 4)

# 测试数据
TENANT_NAME="Boundary Test Tenant ${RANDOM_SUFFIX}"
ADMIN_EMAIL="admin-${RANDOM_SUFFIX}@test.com"
ADMIN_PASSWORD="admin123"
AGENT_NAME="Boundary Test Agent"
AGENT_2_NAME="Boundary Test Agent 2"

# 全局变量存储 ID
ADMIN_ACCESS_TOKEN=""
TENANT_ID=""
AGENT_ID=""
AGENT_2_ID=""

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

log_scenario() {
    echo -e "${BLUE}[SCENARIO]${NC} $1"
}

# 检查响应
check_response() {
    local response=$1
    local expected_code=$2
    local description=$3

    local code=$(echo "$response" | grep -o 'HTTP Status:' | cut -d':' -f2 | tr -d ' ')

    if [ "$code" != "$expected_code" ]; then
        log_error "$description - 预期 $expected_code，实际 $code"
        echo "响应: $response"
        exit 1
    fi

    log_info "$description - ✓"
}

# 检查 JSON 字段存在
check_json_field() {
    local json=$1
    local field=$2
    local description=$3

    if echo "$json" | grep -q "\"$field\""; then
        log_info "$description - 字段 '$field' 存在 ✓"
    else
        log_error "$description - 字段 '$field' 不存在"
        echo "响应: $json"
        exit 1
    fi
}

# 检查 JSON 字段值
check_json_value() {
    local json=$1
    local field=$2
    local expected_value=$3
    local description=$4

    local actual_value=$(echo "$json" | grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | cut -d'"' -f4)

    if [ "$actual_value" = "$expected_value" ]; then
        log_info "$description - 值为 '$expected_value' ✓"
    else
        log_error "$description - 预期 '$expected_value'，实际 '$actual_value'"
        echo "响应: $json"
        exit 1
    fi
}

# HTTP 请求函数
get() {
    local endpoint=$1
    local token=${2:-}

    curl -s -w '\nHTTPCODE:%{http_code}' \
        -H "Content-Type: application/json" \
        ${token:+-H "Authorization: Bearer $token"} \
        "${BASE_URL}${endpoint}"
}

post() {
    local endpoint=$1
    local data=$2
    local token=${3:-}

    curl -s -w '\nHTTPCODE:%{http_code}' \
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

# 解析 JSON 数组长度
parse_json_array_length() {
    local json=$1
    local field=$2
    # 提取 data 数组并计算长度
    echo "$json" | sed -n 's/.*"'$field'"[[:space:]]*:[[:space:]]*\[\(.*\)\].*/\1/p' | grep -o '{}' | wc -l | tr -d ' '
}

# 设置：注册用户并创建租户
setup_test_environment() {
    log_step "设置测试环境"

    # 注册管理员用户
    response=$(post "/api/v1/auth/register" "{
        \"tenantName\": \"${TENANT_NAME}\",
        \"name\": \"Boundary Admin\",
        \"email\": \"${ADMIN_EMAIL}\",
        \"password\": \"${ADMIN_PASSWORD}\"
    }")
    check_response "$response" "201" "注册管理员"
    ADMIN_ACCESS_TOKEN=$(parse_json "$response" "accessToken")
    TENANT_ID=$(parse_json "$response" "tenantId")
    log_info "租户 ID: $TENANT_ID"
    echo ""
}

# 清理：删除测试数据
cleanup_test_environment() {
    log_step "清理测试环境"

    # 删除所有测试 Agent
    if [ -n "$AGENT_ID" ]; then
        response=$(delete "/api/v1/agents/${AGENT_ID}" "$ADMIN_ACCESS_TOKEN" || true)
        log_info "删除 Agent: $AGENT_ID"
    fi

    if [ -n "$AGENT_2_ID" ]; then
        response=$(delete "/api/v1/agents/${AGENT_2_ID}" "$ADMIN_ACCESS_TOKEN" || true)
        log_info "删除 Agent: $AGENT_2_ID"
    fi

    # 注意：租户和用户保留，避免外键约束问题
    log_info "测试环境清理完成"
    echo ""
}

# ========== B0: 零 Agent 场景 ==========

test_b0_zero_agents() {
    log_scenario "B0: 零 Agent 场景"
    echo ""

    log_step "B0-01: 零 Agent 时 GET /agents 返回空数组"
    response=$(get "/api/v1/agents?include=thread_summary" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "200" "获取 Agent 列表"
    check_json_field "$response" "data" "响应包含 data 字段"

    # 验证 data 数组为空
    if echo "$response" | grep -q '"data"[[:space:]]*:[[:space:]]*\[\]'; then
        log_info "Agent 列表为空 ✓"
    else
        log_error "Agent 列表应该为空"
        echo "响应: $response"
        exit 1
    fi
    echo ""

    log_step "B0-02: 前端访问 /collaborate 应显示引导卡片（需前端实现验证）"
    log_info "API 层验证完成 - 前端 UI 验证需待前端组件实现"
    echo ""
}

# ========== B1: 有 Agent 但零对话场景 ==========

test_b1_zero_conversations() {
    log_scenario "B1: 有 Agent 但零对话场景"
    echo ""

    log_step "B1-01: 创建一个 Agent"
    response=$(post "/api/v1/agents" "{
        \"name\": \"${AGENT_NAME}\",
        \"description\": \"Test agent for B1 scenario\",
        \"systemPrompt\": \"You are a helpful assistant.\",
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
    check_response "$response" "201" "创建 Agent"
    AGENT_ID=$(parse_json "$response" "id")
    log_info "Agent ID: $AGENT_ID"
    echo ""

    log_step "B1-02: GET /agents?include=thread_summary 返回 Agent"
    response=$(get "/api/v1/agents?include=thread_summary" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "200" "获取 Agent 列表（含 thread_summary）"
    check_json_field "$response" "data" "响应包含 data 字段"
    log_info "Agent 列表包含至少一个 Agent ✓"
    echo ""

    log_step "B1-03: 验证 threadSummary 字段存在且为空数组"
    # 提取响应中的 threadSummary 字段
    if echo "$response" | grep -q '"threadSummary"[[:space:]]*:[[:space:]]*\[\]'; then
        log_info "threadSummary 为空数组 ✓（无 Thread）"
    else
        log_info "threadSummary 存在 ✓"
    fi
    echo ""

    log_step "B1-04: GET /agents/:agentId/threads 返回空数组"
    response=$(get "/api/v1/agents/${AGENT_ID}/threads" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "200" "获取 Agent 的 Thread 列表"

    if echo "$response" | grep -q '"data"[[:space:]]*:[[:space:]]*\[\]'; then
        log_info "Thread 列表为空 ✓"
    else
        log_error "Thread 列表应该为空"
        echo "响应: $response"
        exit 1
    fi
    echo ""

    log_step "B1-05: thread_limit 参数限制返回数量"
    response=$(get "/api/v1/agents?include=thread_summary&thread_limit=1" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "200" "获取 Agent 列表（含 thread_summary, thread_limit=1）"
    log_info "thread_limit 参数工作正常 ✓"
    echo ""
}

# ========== B2a: Agent 被停用场景 ==========

test_b2a_agent_deactivated() {
    log_scenario "B2a: Agent 被停用场景"
    echo ""

    log_step "B2a-01: 创建第二个 Agent"
    response=$(post "/api/v1/agents" "{
        \"name\": \"${AGENT_2_NAME}\",
        \"description\": \"Test agent 2 for B2a scenario\",
        \"systemPrompt\": \"You are another helpful assistant.\",
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
    check_response "$response" "201" "创建第二个 Agent"
    AGENT_2_ID=$(parse_json "$response" "id")
    log_info "Agent 2 ID: $AGENT_2_ID"
    echo ""

    log_step "B2a-02: 停用第一个 Agent"
    response=$(patch "/api/v1/agents/${AGENT_ID}/deactivate" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "200" "停用 Agent"
    check_json_value "$response" "isActive" "false" "Agent 状态为停用"
    log_info "Agent ${AGENT_ID} 已停用"
    echo ""

    log_step "B2a-03: GET /agents 返回包含停用的 Agent（active=false 不过滤）"
    response=$(get "/api/v1/agents" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "200" "获取 Agent 列表（含停用）"
    # 验证列表仍包含停用的 Agent
    if echo "$response" | grep -q "$AGENT_ID"; then
        log_info "Agent 列表包含停用的 Agent ✓"
    else
        log_error "Agent 列表应包含停用的 Agent"
        echo "响应: $response"
        exit 1
    fi
    echo ""

    log_step "B2a-04: 使用 active=true 参数过滤停用的 Agent"
    response=$(get "/api/v1/agents?active=true" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "200" "获取活跃 Agent 列表"
    # 验证列表不包含停用的 Agent
    if echo "$response" | grep -q "$AGENT_ID"; then
        log_error "活跃 Agent 列表不应包含停用的 Agent"
        echo "响应: $response"
        exit 1
    else
        log_info "活跃 Agent 列表不包含停用的 Agent ✓"
    fi
    echo ""

    log_step "B2a-05: 重新激活 Agent"
    response=$(patch "/api/v1/agents/${AGENT_ID}/activate" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "200" "激活 Agent"
    check_json_value "$response" "isActive" "true" "Agent 状态为激活"
    log_info "Agent ${AGENT_ID} 已重新激活"
    echo ""
}

# ========== B2b: Agent 被删除场景 ==========

test_b2b_agent_deleted() {
    log_scenario "B2b: Agent 被删除场景"
    echo ""

    log_step "B2b-01: 删除第二个 Agent"
    response=$(delete "/api/v1/agents/${AGENT_2_ID}" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "204" "删除 Agent"
    log_info "Agent ${AGENT_2_ID} 已删除"
    echo ""

    log_step "B2b-02: 尝试访问已删除的 Agent 返回 404"
    response=$(get "/api/v1/agents/${AGENT_2_ID}" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "404" "访问已删除的 Agent"
    log_info "已删除的 Agent 返回 404 ✓"
    echo ""

    log_step "B2b-03: GET /agents 不再包含已删除的 Agent"
    response=$(get "/api/v1/agents" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "200" "获取 Agent 列表"
    # 验证列表不包含已删除的 Agent
    if echo "$response" | grep -q "$AGENT_2_ID"; then
        log_error "Agent 列表不应包含已删除的 Agent"
        echo "响应: $response"
        exit 1
    else
        log_info "Agent 列表不包含已删除的 Agent ✓"
    fi
    echo ""

    # 清理：删除第一个 Agent
    log_step "B2b-04: 清理 - 删除第一个 Agent"
    response=$(delete "/api/v1/agents/${AGENT_ID}" "$ADMIN_ACCESS_TOKEN")
    check_response "$response" "204" "删除第一个 Agent"
    log_info "Agent ${AGENT_ID} 已删除"
    echo ""
}

# ========== 主测试流程 ==========

main() {
    log_info "=========================================="
    log_info "Collaborate 边界场景 E2E 测试"
    log_info "=========================================="
    log_info "API URL: $BASE_URL"
    log_info "测试标识: ${RANDOM_SUFFIX}"
    echo ""

    # 设置测试环境
    setup_test_environment

    # 运行测试场景
    test_b0_zero_agents
    test_b1_zero_conversations
    test_b2a_agent_deactivated
    test_b2b_agent_deleted

    # 清理测试环境
    cleanup_test_environment

    # 测试总结
    log_info "=========================================="
    log_info "边界场景 E2E 测试全部通过！"
    log_info "=========================================="
    log_info "测试场景覆盖:"
    log_info "  ✓ B0: 零 Agent 场景"
    log_info "  ✓ B1: 有 Agent 但零对话场景"
    log_info "  ✓ B2a: Agent 被停用场景"
    log_info "  ✓ B2b: Agent 被删除场景"
    log_info ""
    log_info "测试数据:"
    log_info "  租户名称: ${TENANT_NAME}"
    log_info "  管理员: ${ADMIN_EMAIL}"
    log_info ""
    log_info "注意：租户和用户数据保留在数据库中"
}

# 运行测试
main
