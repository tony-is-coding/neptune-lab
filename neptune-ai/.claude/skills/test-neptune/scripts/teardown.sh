#!/bin/bash
# teardown.sh — 清理测试环境
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(cd "$SKILL_DIR/../../.." && pwd)"
SERVER_DIR="$PROJECT_DIR/neptune-ai/server"

echo "=== 清理测试环境 ==="

# 停止后端进程（仅当 setup.sh 启动的）
PID_FILE="${LOG_DIR:-/tmp}/_backend.pid"
if [[ -f "$PID_FILE" ]]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "停止后端进程 (PID: $PID)..."
    kill "$PID" 2>/dev/null || true
    sleep 1
    kill -9 "$PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

echo "清理完成"
