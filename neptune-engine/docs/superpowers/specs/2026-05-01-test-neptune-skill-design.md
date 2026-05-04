# Neptune AI 后端自动化测试 SKILL 设计文档

> 日期：2026-05-01
> 状态：已确认
> 范围：Neptune AI 后端全量 API 回归测试

---

## 1. 概述

### 1.1 目标

为 Neptune AI 后端构建一个可手动触发的自动化测试 SKILL（`/test-neptune`），用于：

- 在设计、架构、产品功能、新增特性变更后执行全量回归测试
- 通过 curl + bash 脚本对后端 API 进行黑盒测试
- 持续积累测试用例，每次新增用例只需添加一个 .sh 文件

### 1.2 核心决策

| 决策项 | 选择 |
|--------|------|
| 触发方式 | 手动 `/test-neptune` |
| 测试范围 | 每次全量回归 |
| 后端启动 | 自动启动（docker-compose + bun dev） |
| 数据处理 | 隔离模式：清理数据库 + 重建 |
| 结果报告 | 每个用例独立日志 + 汇总报告 |
| Chat SSE 测试 | Mock Agent（基础） + 真实 Agent 引擎（完整 E2E） |
| 用例组织 | 文件化用例库，按编号排序，自动扫描 |

---

## 2. 技术方案：纯 Bash + Curl

选择理由：
1. curl 是最通用的 HTTP 测试工具，macOS 自带
2. 零额外依赖，不需要安装任何 npm 包
3. 用例即文档，每个 .sh 文件就是一个可读的测试场景
4. 新增用例只需在 test_cases/ 下添加文件

---

## 3. 目录结构

```
.claude/skills/test-neptune/
├── SKILL.md                            # SKILL 主体说明
├── reference/
│   └── architecture.md                 # Neptune AI 后端架构参考
├── scripts/
│   ├── run-all.sh                      # 主入口：编排全流程
│   ├── setup.sh                        # 自动启动基础设施 + 后端 + 数据准备
│   ├── teardown.sh                     # 停止服务 + 清理
│   └── lib.sh                          # 公共函数库
└── test_cases/                         # 文件化用例库（按编号排序）
    ├── 001-health-check.sh
    ├── 002-error-responses.sh
    ├── 003-auth-register-new-tenant.sh
    ├── 004-auth-register-join-tenant.sh
    ├── 005-auth-login-refresh.sh
    ├── 006-auth-me.sh
    ├── 007-tenant-crud.sh
    ├── 008-user-crud.sh
    ├── 009-agent-template-crud.sh
    ├── 010-agent-template-constraints.sh
    ├── 011-rbac-permissions.sh
    ├── 012-agent-chat-sse-mock.sh
    ├── 013-agent-chat-sse-real.sh
    ├── 014-billing-query.sh
    └── 015-agent-chat-history.sh
```

### 测试日志目录

```
./test_logs/{YYYYMMDD_HHmmss}/
├── 001-health-check.log
├── 002-error-responses.log
├── ...
├── _vars.env                           # 用例间传递的变量
└── _summary.log                        # 汇总报告
```

---

## 4. SKILL.md 设计

```markdown
# Neptune AI 后端自动化测试

## 触发
当用户调用 /test-neptune 时执行。

## 行为
对 Neptune AI 后端执行全量回归测试，验证所有 API 端点和核心业务流程。

## 执行流程
1. 运行 scripts/setup.sh — 自动启动基础设施和后端
2. 按顺序执行 test_cases/*.sh 中所有测试用例
3. 运行 scripts/teardown.sh — 清理环境
4. 输出汇总报告

## 关键规则
- 所有测试通过 curl 发送 HTTP 请求
- 每个用例独立一个日志文件，存放在 ./test_logs/{timestamp}/
- 数据隔离：每次测试前清理数据库，用例间通过 save_var/load_var 传递数据
- Mock Agent 和真实 Agent 引擎双重测试（012-mock / 013-real）
- 真实 Agent 测试默认跳过，设置 ENABLE_REAL_AGENT=1 启用

## 新增用例
在 test_cases/ 目录下新增 .sh 文件，文件名以编号开头（如 016-xxx.sh），
遵循 lib.sh 提供的函数接口：
- init_test_log() 初始化日志
- curl_get/post/put/patch/delete 发送请求
- assert_* 系列函数断言结果
- save_var/load_var 传递数据
- finish_test() 结束用例

## 参考
- reference/architecture.md — 系统架构文档
- scripts/lib.sh — 公共函数库 API
```

---

## 5. 核心脚本设计

### 5.1 lib.sh — 公共函数库

```bash
# === 环境变量 ===
BASE_URL="http://localhost:3000"
LOG_DIR=""
CURRENT_LOG=""
TEST_START_TIME=0
LAST_STATUS=0
LAST_BODY=""
LAST_HEADERS=""
CASE_TIMEOUT=60                # 单个用例超时（秒）
CURL_CONNECT_TIMEOUT=10        # curl 连接超时（秒）
CURL_MAX_TIME=30               # curl 请求最大时间（秒）

# === 日志工具 ===
init_test_log()         # 初始化当前用例日志文件
log_info()              # 写入 [INFO] 日志
log_error()             # 写入 [ERROR] 日志

# === HTTP 封装 ===
# 所有 curl 封装默认添加 --connect-timeout $CURL_CONNECT_TIMEOUT --max-time $CURL_MAX_TIME
curl_get(path, headers)            # GET 请求
curl_post(path, body, headers)     # POST 请求
curl_put(path, body, headers)      # PUT 请求
curl_patch(path, body, headers)    # PATCH 请求
curl_delete(path, headers)         # DELETE 请求
curl_sse(path, body, headers, timeout, max_lines)  # SSE 流式请求（使用自定义 timeout）

# === 断言函数 ===
assert_http_status(expected)             # 断言 HTTP 状态码
assert_json_field(jq_path, expected)     # 断言 JSON 字段值
assert_json_exists(jq_path)              # 断言 JSON 字段存在
assert_json_array_length(path, expected) # 断言数组长度
assert_sse_event(event_type)             # 断言 SSE 事件包含指定类型
assert_response_time(max_ms)             # 断言响应时间

# === 数据管理 ===
save_var(name, value)    # 保存变量到 _vars.env
load_var(name)           # 读取变量

# === 生命周期 ===
finish_test()            # 标记用例完成，计算耗时，记录 PASS/FAIL
```

### 5.2 setup.sh — 环境准备流程

```
1. 检查 docker 是否运行
2. cd neptune-ai/server && docker-compose up -d  # 启动 PG + Redis
3. 等待 PG/Redis 就绪（健康检查轮询，最多 30s）
4. 执行数据库迁移（如需要）
5. 检查端口 3000 是否被占用（lsof -i :3000），如被占用则跳过启动
6. bun dev 启动后端（后台进程）：
   - PID 保存到 $LOG_DIR/_backend.pid
   - stdout/stderr 重定向到 $LOG_DIR/_backend.log
   - 如果启动失败（30s 内 /health 未返回 200），报告错误并退出
7. 等待 /health 返回 200（轮询，最多 30s）
8. 清理旧测试数据（TRUNCATE ... CASCADE 按外键依赖顺序）
```

### 5.3 run-all.sh — 主编排流程

```
1. source scripts/lib.sh
2. 创建 test_logs/{timestamp}/ 目录
3. 执行 scripts/setup.sh
4. 扫描 test_cases/*.sh（按文件名排序）
5. 逐个执行用例（每个用例用 timeout $CASE_TIMEOUT 包装）：
   - source 用例脚本
   - 超时则标记 ERROR
   - 记录 PASS/FAIL/SKIP/ERROR
   - 失败时记录详细错误到日志
6. 连续 3 个用例失败则触发 fail-fast，跳过剩余用例
7. 执行 scripts/teardown.sh
8. 生成 _summary.log 汇总报告
9. 输出汇总到终端
```

### 5.4 用例间数据传递

用例间通过 save_var / load_var 传递数据，变量存储在 `$LOG_DIR/_vars.env`：

```bash
# 003-auth-register.sh 注册后保存
save_var "ADMIN_TOKEN" "$ACCESS_TOKEN"
save_var "TENANT_ID" "$TENANT_ID"

# 007-tenant-crud.sh 使用
ADMIN_TOKEN=$(load_var "ADMIN_TOKEN")
```

---

## 6. 测试用例清单

### 模块 1：基础设施（2 个）

| # | 用例名 | 测试内容 |
|---|--------|----------|
| 001 | health-check | GET /health 返回 200 + 正确结构；GET /health/db 返回 200 |
| 002 | error-responses | 访问不存在路径返回 404；无认证访问受保护路径返回 401 |

### 模块 2：认证（4 个）

| # | 用例名 | 测试内容 |
|---|--------|----------|
| 003 | auth-register-new-tenant | POST /auth/register (tenantName) -> 201 + admin 角色 + 新租户 |
| 004 | auth-register-join-tenant | POST /auth/register (tenantId) -> 201 + user 角色 |
| 005 | auth-login-refresh | POST /auth/login -> 200 + token pair；POST /auth/token/refresh -> 200 + 新 token |
| 006 | auth-me | GET /auth/me -> 200 + 正确用户信息；错误 token -> 401 |

### 模块 3：租户 CRUD（1 个）

| # | 用例名 | 测试内容 |
|---|--------|----------|
| 007 | tenant-crud | 完整 CRUD 循环：创建 -> 查询 -> 更新 -> 列表 -> 删除 |

### 模块 4：用户管理（1 个）

| # | 用例名 | 测试内容 |
|---|--------|----------|
| 008 | user-crud | admin 创建用户 -> 查询 -> 更新 -> 列表 -> 删除；user 不能创建用户 |

### 模块 5：Agent 模板（2 个）

| # | 用例名 | 测试内容 |
|---|--------|----------|
| 009 | agent-template-crud | 完整 CRUD + 激活/停用 + 列表过滤 |
| 010 | agent-template-constraints | 验证 systemPrompt 必填；modelConfig 结构；JSON 格式校验 |

### 模块 6：RBAC 权限（1 个）

| # | 用例名 | 测试内容 |
|---|--------|----------|
| 011 | rbac-permissions | user 不能创建/更新/删除租户、用户、Agent 模板 |

### 模块 7：Agent Chat SSE（2 个）

| # | 用例名 | 测试内容 |
|---|--------|----------|
| 012 | agent-chat-sse-mock | Mock Agent：SSE 格式验证、连接建立、正常关闭 |
| 013 | agent-chat-sse-real | 真实 Agent 引擎：完整对话流程 + SSE 流验证 |

### 模块 8：计费（1 个）

| # | 用例名 | 测试内容 |
|---|--------|----------|
| 014 | billing-query | GET /tenants/:id/billing -> 返回 usage 结构 |

### 模块 9：Session 历史（1 个）

| # | 用例名 | 测试内容 |
|---|--------|----------|
| 015 | agent-chat-history | Chat 后 GET history -> 返回对话记录 |

### 覆盖率总结

- API 端点覆盖：100%（全部 25+ 个端点）
- 认证场景：注册（2 种模式）、登录、刷新、me、无效 token
- CRUD 操作：租户、用户、Agent 模板
- RBAC：admin vs user 权限边界
- SSE 流：Mock + 真实 Agent 引擎
- 边界/错误：404、401、权限拒绝、字段校验

---

## 7. 日志格式

### 7.1 单用例日志格式

```
========================================
TEST: 003-auth-register-new-tenant
TIME: 2026-05-01T14:32:05
========================================

[INFO] Request: POST /api/v1/auth/register
[INFO] Body: {"email":"test_003@example.com","password":"Test@1234",...}
[INFO] Response Status: 201
[INFO] Response Body: {"user":{"id":"...","email":"test_003@example.com","role":"admin","tenantId":"..."},"accessToken":"...","refreshToken":"...","expiresIn":3600}
[INFO] Duration: 125ms

--- Assertions ---
[PASS] HTTP status is 201
[PASS] $.user.email == "test_003@example.com"
[PASS] $.user.role == "admin"
[PASS] $.user.tenantId exists
[PASS] $.accessToken exists

========================================
RESULT: PASS | Duration: 125ms | Assertions: 5/5
========================================
```

### 7.2 SSE 日志格式

```
[INFO] SSE Request: POST /api/v1/agents/:agentId/chat
[INFO] Body: {"content":"Hello"}
[INFO] SSE Connection established
[INFO] SSE Event [0]: event: message | data: {"type":"text","content":"..."}
[INFO] SSE Event [1]: event: done | data: {}
[INFO] SSE Stream closed (total: 3 events, duration: 2100ms)

--- Assertions ---
[PASS] SSE connection established (Content-Type: text/event-stream)
[PASS] Received event type "message"
[PASS] Received event type "done"
[PASS] Total events >= 1
```

### 7.3 汇总报告 _summary.log

```
========================================
Neptune AI Backend Test Report
========================================
Timestamp:  2026-05-01T14:32:00
Duration:   12.5s
Base URL:   http://localhost:3000

--- Results ---
Total:  15 | PASS: 13 | FAIL: 1 | SKIP: 1 | ERROR: 0

--- Failed ---
  [FAIL] 007-tenant-crud.sh
    Reason: Expected HTTP 200, got 500
    Log:   ./test_logs/20260501_143200/007-tenant-crud.log

--- Skipped ---
  [SKIP] 013-agent-chat-sse-real.sh
    Reason: Agent engine not available (set ENABLE_REAL_AGENT=1)

--- Per-Case Summary ---
  PASS  001-health-check              45ms    3/3
  PASS  002-error-responses           38ms    4/4
  PASS  003-auth-register-new-tenant  125ms   5/5
  ...
  FAIL  007-tenant-crud               230ms   6/8
  SKIP  013-agent-chat-sse-real       0ms     0/0

========================================
```

---

## 8. Mock vs Real Agent 测试策略

### Mock Agent 测试 (012)
- 不依赖 claude-code-best/engine，使用预设的 SSE 响应数据
- **实现机制**：后端需支持环境变量 `AGENT_ENGINE=mock`，在 `session.ts` 中根据此变量切换 mock 实现
- Mock 实现返回预设的 SSE 事件流（text/done 事件），不调用真实 Agent Engine
- **前置条件**：后端 session.ts 需实现 mock 模式分支（作为独立前置任务）
- 验证点：SSE 连接建立、event 格式、data JSON 结构、连接关闭
- 每次都执行，快速稳定

### Real Agent 测试 (013)
- 依赖真实的 Agent 引擎和外部 API
- 验证点：完整对话流程、多轮 SSE 事件、usage 统计、session 创建
- 默认跳过（SKIP），设置 ENABLE_REAL_AGENT=1 启用
- 设置超时（30s）和最大事件数（50），避免无限等待

---

## 9. reference/architecture.md 内容

包含以下系统架构信息（供 Claude 读取理解后端系统）：

- **API 路由全列表**：25+ 个端点（方法、路径、认证、角色、功能）
- **数据模型定义**：5 张核心表（tenants、users、agent_templates、sessions、billing_records）
- **认证流程**：JWT 双 Token 机制（HS256、accessToken 1h、refreshToken 7d）
- **核心业务流程**：QueryDispatcher（Agent Chat 调度器）、CostAggregator（计费聚合器）、TenantPermissionDelegate（权限委托）
- **启动方式**：docker-compose（PG 16 + Redis 7）+ bun dev
- **RBAC 体系**：4 种角色 — admin（全量操作）、user（只读 + chat）、tenant_admin（租户级管理 + billing）、platform_admin（平台级管理）
- **注意**：billing 路由检查 tenant_admin/platform_admin 角色，注册创建的 admin 角色可能无 billing 访问权限，需要验证

---

## 10. 用例编写示例

```bash
#!/bin/bash
# 用例：003-auth-register-new-tenant
# 测试：注册新用户并创建新租户
source "$(dirname "$0")/../scripts/lib.sh"
TEST_NAME="auth-register-new-tenant"
init_test_log

# 生成唯一测试数据
TEST_EMAIL="test_$(date +%s)@example.com"

# 执行注册（创建新租户模式）
RESULT=$(curl_post "/api/v1/auth/register" "{
  \"email\": \"$TEST_EMAIL\",
  \"password\": \"Test@1234\",
  \"name\": \"Test User\",
  \"tenantName\": \"Test Org\"
}")

# 断言（注意：注册响应结构为 {user: {...}, accessToken, refreshToken, expiresIn}）
assert_http_status 201
assert_json_field ".user.email" "$TEST_EMAIL"
assert_json_field ".user.role" "admin"
assert_json_exists ".user.tenantId"
assert_json_exists ".accessToken"
assert_json_exists ".refreshToken"

# 保存变量供后续用例使用
save_var "ADMIN_TOKEN" "$(echo "$LAST_BODY" | jq -r '.accessToken')"
save_var "TENANT_ID" "$(echo "$LAST_BODY" | jq -r '.user.tenantId')"
save_var "ADMIN_USER_ID" "$(echo "$LAST_BODY" | jq -r '.user.id')"

finish_test
```
