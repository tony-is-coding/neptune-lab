#!/bin/bash
# setup.sh — 自动启动 Neptune AI 后端基础设施
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(cd "$SKILL_DIR/../../.." && pwd)"
SERVER_DIR="$PROJECT_DIR/neptune-ai/server"

echo "=== Neptune AI 测试环境启动 ==="
echo "项目目录: $PROJECT_DIR"
echo "服务目录: $SERVER_DIR"

# === 1. 检查 Docker ===
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker 未安装"
  exit 1
fi

if ! docker info &>/dev/null 2>&1; then
  echo "Docker 未运行，尝试启动..."
  open -a Docker 2>/dev/null || true
  echo "等待 Docker 启动..."
  for i in $(seq 1 30); do
    if docker info &>/dev/null 2>&1; then
      echo "Docker 已就绪"
      break
    fi
    sleep 2
  done
  if ! docker info &>/dev/null 2>&1; then
    echo "ERROR: Docker 启动超时"
    exit 1
  fi
fi

# === 2. 启动基础设施 ===
echo "启动 PostgreSQL + Redis..."
cd "$SERVER_DIR"

if ! docker-compose ps | grep -q "neptune.*postgres.*running" 2>/dev/null; then
  docker-compose up -d 2>&1
else
  echo "基础设施已在运行"
fi

# === 3. 等待 PG/Redis 就绪 ===
echo "等待 PostgreSQL 就绪..."
for i in $(seq 1 30); do
  if docker-compose exec -T postgres pg_isready -U postgres &>/dev/null 2>&1; then
    echo "PostgreSQL 已就绪"
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "ERROR: PostgreSQL 就绪超时"
    exit 1
  fi
  sleep 1
done

echo "等待 Redis 就绪..."
for i in $(seq 1 15); do
  if docker-compose exec -T redis redis-cli ping &>/dev/null 2>&1 | grep -q PONG; then
    echo "Redis 已就绪"
    break
  fi
  if [[ $i -eq 15 ]]; then
    echo "ERROR: Redis 就绪超时"
    exit 1
  fi
  sleep 1
done

# === 4. 安装依赖（如需要）===
if [[ ! -d "$SERVER_DIR/node_modules" ]]; then
  echo "安装依赖..."
  cd "$SERVER_DIR" && bun install 2>&1
fi

# === 5. 检查端口 3000 ===
BACKEND_STARTED=0
if lsof -i :3000 &>/dev/null 2>&1; then
  echo "端口 3000 已被占用，检查后端是否运行中..."
  if curl -s "${BASE_URL:-http://localhost:3000}/health" | grep -q "ok" 2>/dev/null; then
    echo "后端已在运行中"
  else
    echo "WARNING: 端口 3000 被占用但不是 Neptune AI 后端"
  fi
else
  # === 6. 启动后端 ===
  echo "启动后端..."
  cd "$SERVER_DIR"
  nohup bun run dev > "${LOG_DIR:-/tmp}/_backend.log" 2>&1 &
  BACKEND_PID=$!
  echo "$BACKEND_PID" > "${LOG_DIR:-/tmp}/_backend.pid"
  BACKEND_STARTED=1
  echo "后端 PID: $BACKEND_PID"
fi

# === 7. 等待后端就绪 ===
echo "等待后端就绪..."
for i in $(seq 1 30); do
  if curl -s --connect-timeout 2 "${BASE_URL:-http://localhost:3000}/health" 2>/dev/null | grep -q "ok"; then
    echo "后端已就绪"
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "ERROR: 后端启动超时"
    echo "--- 后端日志 ---"
    cat "${LOG_DIR:-/tmp}/_backend.log" 2>/dev/null | tail -20
    exit 1
  fi
  sleep 1
done

# === 8. 清理旧测试数据 ===
echo "清理旧测试数据..."
cd "$SERVER_DIR"

# 使用 bun 执行 SQL 清理（利用现有 DB 连接）
bun -e "
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/neptune_ai');
try {
  await sql\`TRUNCATE TABLE billing_records, sessions, agent_templates, users, tenants CASCADE\`;
  console.log('数据库已清理');
} catch (e) {
  console.error('清理失败:', e.message);
} finally {
  await sql.end();
}
" 2>&1 || echo "WARNING: 数据库清理失败，可能表不存在"

echo ""
echo "=== 环境就绪 ==="
echo "后端地址: ${BASE_URL:-http://localhost:3000}"
echo "后端启动: $([ $BACKEND_STARTED -eq 1 ] && echo '本次启动' || echo '已有进程')"
echo ""
