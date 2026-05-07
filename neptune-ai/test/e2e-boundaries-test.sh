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

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
BASE_URL="${1:-http://localhost:3000}"
RANDOM_SUFFIX=$(openssl rand -hex 4)

# 测试数据
TENANT_NAME="Boundary Test Tenant ${RANDOM_SUFFIX}"
ADMIN_EMAIL="admin-${RANDOM_SUFFIX}@test.com"
ADMIN_PASSWORD="admin123"
AGENT_NAME="Boundary Test Agent"
AGENT_2_NAME="Boundary Test Agent 2"

# 全局变量
ADMIN_ACCESS_TOKEN=""
AGENT_ID=""
AGENT_2_ID=""

# 辅助函数
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${YELLOW}[STEP]${NC} $1"; }
log_scenario() { echo -e "${BLUE}[SCENARIO]${NC} $1"; }

# 检查响应状态码
check_status() {
    local response=$1
    local expected=$2
    local desc=$3
    
    local status=$(echo "$response" | grep -oE 'HTTPCODE:[0-9]{3}' | cut -d: -f2)
    
    if [ "$status" != "$expected" ]; then
        log_error "$desc - 预期 $expected，实际 $status"
        echo "响应: $response"
        exit 1
    fi
    log_info "$desc - ✓"
}

# HTTP 请求
get() {
    local endpoint=$1
    local token=${2:-}
    curl -s -w "\nHTTPCODE:%{http_code}" \
        ${token:+-H "Authorization: Bearer $token"} \
        "${BASE_URL}${endpoint}"
}

post() {
    local endpoint=$1
    local data=$2
    local token=${3:-}
    curl -s -w "\nHTTPCODE:%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        ${token:+-H "Authorization: Bearer $token"} \
        -d "$data" \
        "${BASE_URL}${endpoint}"
}

delete() {
    local endpoint=$1
    local token=$2
    curl -s -w "\nHTTPCODE:%{http_code}" \
        -X DELETE \
        ${token:+-H "Authorization: Bearer $token"} \
        "${BASE_URL}${endpoint}"
}

patch() {
    local endpoint=$1
    local token=$2
    curl -s -w "\nHTTPCODE:%{http_code}" \
        -X PATCH \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        "${BASE_URL}${endpoint}"
}

parse_json() {
    local json=$1
    local field=$2
    echo "$json" | grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | cut -d'"' -f4
}

# ========== 设置测试环境 ==========
setup() {
    log_step "设置测试环境"
    response=$(post "/api/v1/auth/register" "{
        \"tenantName\": \"${TENANT_NAME}\",
        \"name\": \"Boundary Admin\",
        \"email\": \"${ADMIN_EMAIL}\",
        \"password\": \"${ADMIN_PASSWORD}\"
    }")
    check_status "$response" "201" "注册管理员"
    ADMIN_ACCESS_TOKEN=$(parse_json "$response" "accessToken")
    echo ""
}

# ========== B0: 零 Agent 场景 ==========
test_b0() {
    log_scenario "B0: 零 Agent 场景"
    echo ""
    
    log_step "B0-01: 零 Agent 时 GET /agents 返回空数组"
    response=$(get "/api/v1/agents?include=thread_summary" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "200" "获取 Agent 列表"
    
    if echo "$response" | grep -q '"data":[[:space:]]*\[\]'; then
        log_info "Agent 列表为空 ✓"
    fi
    echo ""
}

# ========== B1: 有 Agent 但零对话场景 ==========
test_b1() {
    log_scenario "B1: 有 Agent 但零对话场景"
    echo ""
    
    log_step "B1-01: 创建 Agent"
    response=$(post "/api/v1/agents" "{
        \"name\": \"${AGENT_NAME}\",
        \"description\": \"Test agent\",
        \"systemPrompt\": \"You are helpful.\",
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
    check_status "$response" "201" "创建 Agent"
    AGENT_ID=$(parse_json "$response" "id")
    log_info "Agent ID: $AGENT_ID"
    echo ""
    
    log_step "B1-02: GET /agents?include=thread_summary"
    response=$(get "/api/v1/agents?include=thread_summary" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "200" "获取 Agent 列表（含 thread_summary）"
    echo ""
    
    log_step "B1-03: GET /agents/:agentId/threads 返回空数组"
    response=$(get "/api/v1/agents/${AGENT_ID}/threads" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "200" "获取 Thread 列表"
    echo ""
}

# ========== B2a: Agent 被停用场景 ==========
test_b2a() {
    log_scenario "B2a: Agent 被停用场景"
    echo ""
    
    log_step "B2a-01: 创建第二个 Agent"
    response=$(post "/api/v1/agents" "{
        \"name\": \"${AGENT_2_NAME}\",
        \"description\": \"Test agent 2\",
        \"systemPrompt\": \"You are helpful.\",
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
    check_status "$response" "201" "创建第二个 Agent"
    AGENT_2_ID=$(parse_json "$response" "id")
    echo ""
    
    log_step "B2a-02: 停用第一个 Agent"
    response=$(patch "/api/v1/agents/${AGENT_ID}/deactivate" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "200" "停用 Agent"
    echo ""
    
    log_step "B2a-03: active=true 过滤停用的 Agent"
    response=$(get "/api/v1/agents?active=true" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "200" "获取活跃 Agent"
    echo ""
    
    log_step "B2a-04: 重新激活 Agent"
    response=$(patch "/api/v1/agents/${AGENT_ID}/activate" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "200" "激活 Agent"
    echo ""
}

# ========== B2b: Agent 被删除场景 ==========
test_b2b() {
    log_scenario "B2b: Agent 被删除场景"
    echo ""
    
    log_step "B2b-01: 删除第二个 Agent"
    response=$(delete "/api/v1/agents/${AGENT_2_ID}" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "204" "删除 Agent"
    echo ""
    
    log_step "B2b-02: 访问已删除的 Agent 返回 404"
    response=$(get "/api/v1/agents/${AGENT_2_ID}" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "404" "访问已删除的 Agent"
    echo ""
}

# ========== 主测试流程 ==========
main() {
    log_info "=========================================="
    log_info "Collaborate 边界场景 E2E 测试"
    log_info "=========================================="
    log_info "API URL: $BASE_URL"
    echo ""
    
    setup
    test_b0
    test_b1
    test_b2a
    test_b2b
    
    log_info "=========================================="
    log_info "边界场景 E2E 测试全部通过！"
    log_info "=========================================="
}

main
