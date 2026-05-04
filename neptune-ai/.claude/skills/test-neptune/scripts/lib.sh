#!/bin/bash
# lib.sh — Neptune AI 后端测试公共函数库
# 所有测试用例都 source 此文件

set -euo pipefail

# === 环境变量 ===
BASE_URL="${BASE_URL:-http://localhost:3000}"
CASE_TIMEOUT="${CASE_TIMEOUT:-60}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-10}"
CURL_MAX_TIME="${CURL_MAX_TIME:-30}"
LOG_DIR=""
CURRENT_LOG=""
TEST_START_TIME=0

# 上次请求的响应
LAST_STATUS=0
LAST_BODY=""
LAST_RESPONSE_TIME=0
LAST_SSE_EVENTS=""

# 断言计数
ASSERT_TOTAL=0
ASSERT_PASS=0
ASSERT_FAIL=0
TEST_RESULT="PASS"

# === 日志工具 ===

init_test_log() {
  local test_name="$1"
  if [[ -z "$LOG_DIR" ]]; then
    echo "ERROR: LOG_DIR not set. Run via run-all.sh"
    exit 1
  fi
  CURRENT_LOG="$LOG_DIR/${test_name}.log"
  TEST_START_TIME=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
  ASSERT_TOTAL=0
  ASSERT_PASS=0
  ASSERT_FAIL=0
  TEST_RESULT="PASS"

  {
    echo "========================================"
    echo "TEST: $test_name"
    echo "TIME: $(date -u +%Y-%m-%dT%H:%M:%S)"
    echo "========================================"
    echo ""
  } > "$CURRENT_LOG"
}

log_info() {
  local msg="$*"
  echo "[INFO] $msg" >> "$CURRENT_LOG"
}

log_error() {
  local msg="$*"
  echo "[ERROR] $msg" >> "$CURRENT_LOG"
}

# === HTTP 封装 ===

_curl_common() {
  curl -s -w "\n%{http_code}\n%{time_total}" \
    --connect-timeout "$CURL_CONNECT_TIMEOUT" \
    --max-time "$CURL_MAX_TIME" \
    "$@"
}

curl_get() {
  local path="$1"
  local headers="${2:-}"
  log_info "Request: GET $path"

  local raw
  if [[ -n "$headers" ]]; then
    raw=$(_curl_common -X GET -H "Content-Type: application/json" $headers "${BASE_URL}${path}" 2>&1) || true
  else
    raw=$(_curl_common -X GET -H "Content-Type: application/json" "${BASE_URL}${path}" 2>&1) || true
  fi

  _parse_response "$raw"
}

curl_post() {
  local path="$1"
  local body="$2"
  local headers="${3:-}"
  log_info "Request: POST $path"
  log_info "Body: $body"

  local raw
  if [[ -n "$headers" ]]; then
    raw=$(_curl_common -X POST -H "Content-Type: application/json" $headers -d "$body" "${BASE_URL}${path}" 2>&1) || true
  else
    raw=$(_curl_common -X POST -H "Content-Type: application/json" -d "$body" "${BASE_URL}${path}" 2>&1) || true
  fi

  _parse_response "$raw"
}

curl_put() {
  local path="$1"
  local body="$2"
  local headers="${3:-}"
  log_info "Request: PUT $path"
  log_info "Body: $body"

  local raw
  if [[ -n "$headers" ]]; then
    raw=$(_curl_common -X PUT -H "Content-Type: application/json" $headers -d "$body" "${BASE_URL}${path}" 2>&1) || true
  else
    raw=$(_curl_common -X PUT -H "Content-Type: application/json" -d "$body" "${BASE_URL}${path}" 2>&1) || true
  fi

  _parse_response "$raw"
}

curl_patch() {
  local path="$1"
  local body="${2:-}"
  local headers="${3:-}"
  log_info "Request: PATCH $path"
  [[ -n "$body" ]] && log_info "Body: $body"

  local raw
  if [[ -n "$headers" ]]; then
    raw=$(_curl_common -X PATCH -H "Content-Type: application/json" $headers ${body:+-d "$body"} "${BASE_URL}${path}" 2>&1) || true
  else
    raw=$(_curl_common -X PATCH -H "Content-Type: application/json" ${body:+-d "$body"} "${BASE_URL}${path}" 2>&1) || true
  fi

  _parse_response "$raw"
}

curl_delete() {
  local path="$1"
  local headers="${2:-}"
  log_info "Request: DELETE $path"

  local raw
  if [[ -n "$headers" ]]; then
    raw=$(_curl_common -X DELETE -H "Content-Type: application/json" $headers "${BASE_URL}${path}" 2>&1) || true
  else
    raw=$(_curl_common -X DELETE -H "Content-Type: application/json" "${BASE_URL}${path}" 2>&1) || true
  fi

  _parse_response "$raw"
}

curl_sse() {
  local path="$1"
  local body="$2"
  local headers="${3:-}"
  local timeout="${4:-30}"
  local max_lines="${5:-50}"
  log_info "SSE Request: POST $path"
  log_info "Body: $body"

  local raw=""
  local header_args=(-H "Content-Type: application/json" -H "Accept: text/event-stream")
  if [[ -n "$headers" ]]; then
    header_args+=($headers)
  fi

  # 使用 curl 的 --no-buffer 和 timeout 命令配合
  raw=$(timeout "$timeout" curl -s -N --no-buffer \
    --connect-timeout "$CURL_CONNECT_TIMEOUT" \
    "${header_args[@]}" \
    -d "$body" \
    "${BASE_URL}${path}" 2>&1 | head -n "$((max_lines * 3))") || true

  LAST_SSE_EVENTS="$raw"
  log_info "SSE Raw Response:"
  echo "$raw" | while IFS= read -r line; do
    log_info "  $line"
  done

  log_info "SSE Stream captured (max_lines=$max_lines, timeout=${timeout}s)"
}

_parse_response() {
  local raw="$1"

  # 最后一行是 time_total，倒数第二行是 http_code，其余是 body
  local response_time=$(echo "$raw" | tail -1)
  local status_code=$(echo "$raw" | tail -2 | head -1)
  local body=$(echo "$raw" | head -n -2)

  LAST_STATUS="$status_code"
  LAST_BODY="$body"
  LAST_RESPONSE_TIME=$(echo "$response_time" | awk '{printf "%.0f", $1 * 1000}')

  log_info "Response Status: $LAST_STATUS"
  log_info "Response Body: $(echo "$LAST_BODY" | head -c 500)"
  log_info "Duration: ${LAST_RESPONSE_TIME}ms"
}

# === 断言函数 ===

assert_http_status() {
  local expected="$1"
  ASSERT_TOTAL=$((ASSERT_TOTAL + 1))

  if [[ "$LAST_STATUS" == "$expected" ]]; then
    log_info "[PASS] HTTP status is $expected"
    ASSERT_PASS=$((ASSERT_PASS + 1))
  else
    log_error "[FAIL] HTTP status: expected $expected, got $LAST_STATUS"
    ASSERT_FAIL=$((ASSERT_FAIL + 1))
    TEST_RESULT="FAIL"
  fi
}

assert_json_field() {
  local jq_path="$1"
  local expected="$2"
  ASSERT_TOTAL=$((ASSERT_TOTAL + 1))

  local actual
  actual=$(echo "$LAST_BODY" | jq -r "$jq_path" 2>/dev/null) || actual="PARSE_ERROR"

  if [[ "$actual" == "$expected" ]]; then
    log_info "[PASS] $jq_path == \"$expected\""
    ASSERT_PASS=$((ASSERT_PASS + 1))
  else
    log_error "[FAIL] $jq_path: expected \"$expected\", got \"$actual\""
    ASSERT_FAIL=$((ASSERT_FAIL + 1))
    TEST_RESULT="FAIL"
  fi
}

assert_json_exists() {
  local jq_path="$1"
  ASSERT_TOTAL=$((ASSERT_TOTAL + 1))

  local actual
  actual=$(echo "$LAST_BODY" | jq -r "$jq_path" 2>/dev/null) || actual="null"

  if [[ "$actual" != "null" && "$actual" != "" ]]; then
    log_info "[PASS] $jq_path exists (value: ${actual:0:50})"
    ASSERT_PASS=$((ASSERT_PASS + 1))
  else
    log_error "[FAIL] $jq_path does not exist or is null"
    ASSERT_FAIL=$((ASSERT_FAIL + 1))
    TEST_RESULT="FAIL"
  fi
}

assert_json_array_length() {
  local jq_path="$1"
  local expected="$2"
  ASSERT_TOTAL=$((ASSERT_TOTAL + 1))

  local actual
  actual=$(echo "$LAST_BODY" | jq "$jq_path | length" 2>/dev/null) || actual="-1"

  if [[ "$actual" == "$expected" ]]; then
    log_info "[PASS] $jq_path length == $expected"
    ASSERT_PASS=$((ASSERT_PASS + 1))
  else
    log_error "[FAIL] $jq_path length: expected $expected, got $actual"
    ASSERT_FAIL=$((ASSERT_FAIL + 1))
    TEST_RESULT="FAIL"
  fi
}

assert_sse_event() {
  local event_type="$1"
  ASSERT_TOTAL=$((ASSERT_TOTAL + 1))

  if echo "$LAST_SSE_EVENTS" | grep -q "event: ${event_type}"; then
    log_info "[PASS] SSE event type \"$event_type\" found"
    ASSERT_PASS=$((ASSERT_PASS + 1))
  else
    log_error "[FAIL] SSE event type \"$event_type\" not found"
    ASSERT_FAIL=$((ASSERT_FAIL + 1))
    TEST_RESULT="FAIL"
  fi
}

assert_response_time() {
  local max_ms="$1"
  ASSERT_TOTAL=$((ASSERT_TOTAL + 1))

  if [[ "$LAST_RESPONSE_TIME" -le "$max_ms" ]]; then
    log_info "[PASS] Response time ${LAST_RESPONSE_TIME}ms <= ${max_ms}ms"
    ASSERT_PASS=$((ASSERT_PASS + 1))
  else
    log_error "[FAIL] Response time ${LAST_RESPONSE_TIME}ms > ${max_ms}ms"
    ASSERT_FAIL=$((ASSERT_FAIL + 1))
    TEST_RESULT="FAIL"
  fi
}

# === 数据管理 ===

save_var() {
  local name="$1"
  local value="$2"
  echo "${name}=\"${value}\"" >> "$LOG_DIR/_vars.env"
}

load_var() {
  local name="$1"
  if [[ -f "$LOG_DIR/_vars.env" ]]; then
    grep "^${name}=" "$LOG_DIR/_vars.env" | tail -1 | cut -d'=' -f2- | tr -d '"'
  fi
}

auth_header() {
  local token
  token=$(load_var "$1")
  echo "-H \"Authorization: Bearer $token\""
}

# === 生命周期 ===

finish_test() {
  local end_time
  end_time=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
  local duration=$(( end_time - TEST_START_TIME ))

  {
    echo ""
    echo "--- Assertions ---"
    echo "========================================"
    echo "RESULT: $TEST_RESULT | Duration: ${duration}ms | Assertions: ${ASSERT_PASS}/${ASSERT_TOTAL}"
    echo "========================================"
  } >> "$CURRENT_LOG"

  # 输出到终端
  if [[ "$TEST_RESULT" == "PASS" ]]; then
    echo "  PASS  $(basename "$CURRENT_LOG" .log)  ${duration}ms  ${ASSERT_PASS}/${ASSERT_TOTAL}"
  else
    echo "  FAIL  $(basename "$CURRENT_LOG" .log)  ${duration}ms  ${ASSERT_PASS}/${ASSERT_TOTAL}"
  fi
}
