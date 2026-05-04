#!/bin/bash
# run-all.sh — Neptune AI 后端全量回归测试主入口
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(cd "$SKILL_DIR/../../.." && pwd)"
CASE_TIMEOUT="${CASE_TIMEOUT:-60}"
FAIL_FAST_COUNT="${FAIL_FAST_COUNT:-3}"

# 创建日志目录
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="$PROJECT_DIR/test_logs/$TIMESTAMP"
mkdir -p "$LOG_DIR"
export LOG_DIR

echo "========================================"
echo "Neptune AI 后端全量回归测试"
echo "========================================"
echo "时间: $(date -u +%Y-%m-%dT%H:%M:%S)"
echo "日志: $LOG_DIR"
echo "超时: ${CASE_TIMEOUT}s/用例"
echo ""

# === Setup ===
echo "--- 环境准备 ---"
source "$SCRIPT_DIR/lib.sh"
if ! bash "$SCRIPT_DIR/setup.sh"; then
  echo "ERROR: 环境启动失败"
  exit 1
fi
echo ""

# === 执行测试用例 ===
echo "--- 执行测试用例 ---"

TOTAL=0
PASS=0
FAIL=0
SKIP=0
ERROR=0
CONSECUTIVE_FAILS=0
FAILED_CASES=""
SKIPPED_CASES=""

for case_file in "$SKILL_DIR"/test_cases/*.sh; do
  [[ -f "$case_file" ]] || continue
  case_name=$(basename "$case_file" .sh)

  # 检查是否需要跳过
  # 013-real 需要 ENABLE_REAL_AGENT=1
  if [[ "$case_name" == *"real"* ]] && [[ "${ENABLE_REAL_AGENT:-0}" != "1" ]]; then
    echo "  SKIP  $case_name  0ms  0/0  (set ENABLE_REAL_AGENT=1)"
    SKIP=$((SKIP + 1))
    SKIPPED_CASES="$SKIPPED_CASES\n  [SKIP] $case_name.sh\n    Reason: Set ENABLE_REAL_AGENT=1 to enable"
    # 创建空日志
    {
      echo "========================================"
      echo "TEST: $case_name"
      echo "TIME: $(date -u +%Y-%m-%dT%H:%M:%S)"
      echo "========================================"
      echo ""
      echo "RESULT: SKIP | Reason: ENABLE_REAL_AGENT not set"
    } > "$LOG_DIR/${case_name}.log"
    continue
  fi

  TOTAL=$((TOTAL + 1))

  # 用 timeout 包装执行
  if timeout "$CASE_TIMEOUT" bash "$case_file" 2>&1; then
    PASS=$((PASS + 1))
    CONSECUTIVE_FAILS=0
  else
    exit_code=$?
    if [[ $exit_code -eq 124 ]]; then
      echo "  ERROR $case_name  timeout (${CASE_TIMEOUT}s)"
      ERROR=$((ERROR + 1))
      {
        echo "RESULT: ERROR | Reason: Timeout after ${CASE_TIMEOUT}s"
      } >> "$LOG_DIR/${case_name}.log"
    else
      FAIL=$((FAIL + 1))
      FAILED_CASES="$FAILED_CASES\n  [FAIL] $case_name.sh\n    Log: $LOG_DIR/${case_name}.log"
      CONSECUTIVE_FAILS=$((CONSECUTIVE_FAILS + 1))
    fi
  fi

  # Fail-fast 检查
  if [[ $CONSECUTIVE_FAILS -ge $FAIL_FAST_COUNT ]]; then
    echo ""
    echo "WARNING: 连续 $CONSECUTIVE_FAILS 个用例失败，触发 fail-fast"
    break
  fi
done

echo ""

# === Teardown ===
echo "--- 环境清理 ---"
bash "$SCRIPT_DIR/teardown.sh" 2>/dev/null || true
echo ""

# === 生成汇总报告 ===
OVERALL_RESULT="PASS"
[[ $FAIL -gt 0 || $ERROR -gt 0 ]] && OVERALL_RESULT="FAIL"

{
  echo "========================================"
  echo "Neptune AI Backend Test Report"
  echo "========================================"
  echo "Timestamp:  $(date -u +%Y-%m-%dT%H:%M:%S)"
  echo "Base URL:   ${BASE_URL:-http://localhost:3000}"
  echo ""
  echo "--- Results ---"
  echo "Total: $((TOTAL + SKIP)) | PASS: $PASS | FAIL: $FAIL | SKIP: $SKIP | ERROR: $ERROR"
  echo ""

  if [[ -n "$FAILED_CASES" ]]; then
    echo "--- Failed ---"
    echo -e "$FAILED_CASES"
    echo ""
  fi

  if [[ -n "$SKIPPED_CASES" ]]; then
    echo "--- Skipped ---"
    echo -e "$SKIPPED_CASES"
    echo ""
  fi

  echo "--- Per-Case Summary ---"
  for log_file in "$LOG_DIR"/*.log; do
    [[ -f "$log_file" ]] || continue
    name=$(basename "$log_file" .log)
    result=$(grep "^RESULT:" "$log_file" | head -1 | sed 's/RESULT: //' | cut -d'|' -f1 | tr -d ' ')
    echo "  $result  $name"
  done

  echo ""
  echo "========================================"
  echo "OVERALL: $OVERALL_RESULT"
  echo "========================================"
} | tee "$LOG_DIR/_summary.log"

echo ""
echo "完整日志: $LOG_DIR/"

# 返回退出码
[[ "$OVERALL_RESULT" == "PASS" ]] && exit 0 || exit 1
