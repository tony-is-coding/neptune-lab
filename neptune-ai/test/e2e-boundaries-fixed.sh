#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="${1:-http://localhost:3000}"
RANDOM_SUFFIX=$(openssl rand -hex 4)
TENANT_NAME="Boundary Test ${RANDOM_SUFFIX}"
ADMIN_EMAIL="admin-${RANDOM_SUFFIX}@test.com"
ADMIN_PASSWORD="admin123"
AGENT_NAME="Agent 1"
AGENT_2_NAME="Agent 2"

ADMIN_ACCESS_TOKEN=""
AGENT_ID=""
AGENT_2_ID=""

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${YELLOW}[STEP]${NC} $1"; }
log_scenario() { echo -e "${BLUE}[SCENARIO]${NC} $1"; }

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

get() {
    local endpoint=$1
    local token=${2:-}
    curl -s -w "\nHTTPCODE:%{http_code}" ${token:+-H "Authorization: Bearer $token"} "${BASE_URL}${endpoint}"
}

post() {
    local endpoint=$1
    local data=$2
    local token=${3:-}
    curl -s -w "\nHTTPCODE:%{http_code}" -X POST -H "Content-Type: application/json" ${token:+-H "Authorization: Bearer $token"} -d "$data" "${BASE_URL}${endpoint}"
}

delete() {
    local endpoint=$1
    local token=$2
    curl -s -w "\nHTTPCODE:%{http_code}" -X DELETE ${token:+-H "Authorization: Bearer $token"} "${BASE_URL}${endpoint}"
}

patch() {
    local endpoint=$1
    local token=$2
    curl -s -w "\nHTTPCODE:%{http_code}" -X PATCH ${token:+-H "Authorization: Bearer $token"} "${BASE_URL}${endpoint}"
}

parse_json() {
    local json=$1
    local field=$2
    echo "$json" | grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | cut -d'"' -f4
}

setup() {
    log_step "设置测试环境"
    response=$(post "/api/v1/auth/register" "{\"tenantName\": \"${TENANT_NAME}\", \"name\": \"Admin\", \"email\": \"${ADMIN_EMAIL}\", \"password\": \"${ADMIN_PASSWORD}\"}")
    check_status "$response" "201" "注册管理员"
    ADMIN_ACCESS_TOKEN=$(parse_json "$response" "accessToken")
    echo ""
}

test_b0() {
    log_scenario "B0: 零 Agent 场景"
    log_step "GET /agents 返回空数组"
    response=$(get "/api/v1/agents" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "200" "获取 Agent 列表"
    log_info "Agent 列表为空 ✓"
    echo ""
}

test_b1() {
    log_scenario "B1: 有 Agent 但零对话场景"
    log_step "创建 Agent"
    response=$(post "/api/v1/agents" "{\"name\": \"${AGENT_NAME}\", \"description\": \"Test\", \"systemPrompt\": \"Helpful.\", \"modelConfig\": {\"provider\": \"anthropic\", \"model\": \"claude-sonnet-4-20250514\", \"temperature\": 0.7, \"maxTokens\": 4096}, \"tools\": [], \"skills\": [], \"mcpServers\": []}" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "201" "创建 Agent"
    AGENT_ID=$(parse_json "$response" "id")
    log_info "Agent ID: $AGENT_ID"
    
    log_step "GET /agents?include=thread_summary"
    response=$(get "/api/v1/agents?include=thread_summary" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "200" "获取 Agent 列表（含 thread_summary）"
    
    log_step "GET /agents/:agentId/threads"
    response=$(get "/api/v1/agents/${AGENT_ID}/threads" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "200" "获取 Thread 列表"
    echo ""
}

test_b2a() {
    log_scenario "B2a: Agent 被停用场景"
    log_step "创建第二个 Agent"
    response=$(post "/api/v1/agents" "{\"name\": \"${AGENT_2_NAME}\", \"description\": \"Test 2\", \"systemPrompt\": \"Helpful.\", \"modelConfig\": {\"provider\": \"anthropic\", \"model\": \"claude-sonnet-4-20250514\", \"temperature\": 0.7, \"maxTokens\": 4096}, \"tools\": [], \"skills\": [], \"mcpServers\": []}" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "201" "创建第二个 Agent"
    AGENT_2_ID=$(parse_json "$response" "id")
    
    log_step "停用第一个 Agent"
    response=$(patch "/api/v1/agents/${AGENT_ID}/deactivate" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "200" "停用 Agent"
    
    log_step "active=true 过滤停用的 Agent"
    response=$(get "/api/v1/agents?active=true" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "200" "获取活跃 Agent"
    
    log_step "重新激活 Agent"
    response=$(patch "/api/v1/agents/${AGENT_ID}/activate" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "200" "激活 Agent"
    echo ""
}

test_b2b() {
    log_scenario "B2b: Agent 被删除场景"
    log_step "删除第二个 Agent"
    response=$(delete "/api/v1/agents/${AGENT_2_ID}" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "204" "删除 Agent"
    
    log_step "访问已删除的 Agent 返回 404"
    response=$(get "/api/v1/agents/${AGENT_2_ID}" "$ADMIN_ACCESS_TOKEN")
    check_status "$response" "404" "访问已删除的 Agent"
    echo ""
}

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
