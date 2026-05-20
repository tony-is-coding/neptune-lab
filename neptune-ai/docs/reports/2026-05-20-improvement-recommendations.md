# Neptune AI 改进建议

生成时间：2026-05-19 23:52 CST

## 总体判断

当前项目已经具备可运行的 SaaS 编排雏形：认证、Agent 模板、Thread、Collaborate UI、SSE 消费、workspace 隔离和 Langfuse 接入都已存在。真正影响下一阶段质量的不是再堆 UI，而是收敛边界：engine headless 化、权限委托接入、契约单一事实源、可观测关联、测试门禁分层。

## P0：必须优先处理

### 1. Engine 与 UI 解耦

现状：

- 真实 chat 会在 `DefaultCCRuntime.getAllBaseTools()` 拉入 `tools.ts`。
- `tools.ts` 继续导入 builtin tools 的 React/Ink UI 文件。
- server 真实路径失败：`Cannot find module '../OffscreenFreeze.js'` 和 `Requested module is not instantiated yet.`

建议：

- 在 `neptune-engine` 提供 headless tool registry，只暴露执行 schema/handler，不导入 UI renderer。
- 将 UI renderer 移到 CLI/desktop 专用 registry。
- `AgentEngine.create()` 支持显式 runtime/toolRegistry 注入，server 默认使用 headless runtime。
- 保留 controlled engine 作为产品层 E2E mock，不作为真实 engine 替代品。

验收：

- server import `claude-code-best/engine` 不加载 React/Ink。
- 真实 engine mock provider 能完成一次 chat SSE 成功流。
- 删除 `neptune-engine/src/ui/**` stub 依赖后 server 测试仍通过。

### 2. 权限委托真正接入

现状：

- `TenantPermissionDelegate` 已实现工具白名单、workspace 限制、MCP 白名单语义。
- `ClaudeCodeEngineFactory` 创建了 delegate，但实际配置里使用 `bypassPermissions: true`。

建议：

- 关闭 bypass。
- 将 `TenantPermissionDelegate` 接入 engine permission extension。
- 增加跨 workspace 文件路径、未授权工具、未注册 MCP server 的集成测试。

验收：

- 未授权工具调用被拒绝。
- `../` 或绝对路径越界访问被拒绝。
- 未登记 MCP server 调用被拒绝。

### 3. API/SSE 类型契约统一

现状：

- server 定义 SSE union。
- web 定义 ChatMessage/PlanTask 类型。
- docs 里 SSE 示例与真实 `event: message` + `data.type` 不一致。
- `shared/types` 还是空骨架。

建议：

- 在 `shared/types` 放置 API DTO、错误 envelope、SSE event union。
- server 和 web 均从 shared 导入。
- 为 OpenAPI 或 Zod schema 增加契约测试。

验收：

- `PlanTask.status` 与 server `plan_step.status` 一致。
- `SSEEvent` 增删字段会同时影响 server/web 编译。
- docs 从 schema 生成或至少由契约测试校验。

### 4. 数据库迁移链路收敛

现状：

- Drizzle migrations 在 `src/db/migrations`。
- 另有手写 `server/db-migrations/001-simplify-session-schema.sql`，不在 Drizzle journal。

建议：

- 只保留一个正式迁移入口。
- 将手写迁移纳入 ledger 或转为 Drizzle migration。
- 增加空库初始化和旧库升级验证脚本。

验收：

- 新环境 `db:migrate` 后 schema 与代码一致。
- 旧环境升级不会遗漏 `sessions/messages/billing_records` 变更。

## P1：近期强化

### 5. Langfuse 可观测从“接入”升级为“可验收”

现状：

- Langfuse 初始化可用。
- Trace processor 能处理 SDK event。
- 缺少 request correlation。
- Provider 使用单例可变字段，存在并发串线风险。

建议：

- 每个 HTTP 请求生成 `requestId`，写入 response header、日志 MDC、Langfuse metadata。
- dispatch 传递 `requestId/threadId/userId/tenantId/agentId/sdkSessionId/model`。
- Langfuse provider 改为 per-trace context 对象，避免 `currentTrace` 全局状态。
- 增加 fake Langfuse provider 测试，断言 trace/span/generation/tool payload。

验收：

- 一次 chat 可从浏览器 request id 追到 server log 和 Langfuse trace。
- 两个并发 dispatch 不共享 generation/usage/trace。

### 6. Thread usage 按请求绑定

现状：

- `ThreadManager.lastUsage` 是 manager 级字段。
- SSE `done` 从 `threadManager.getLastUsage()` 读取。
- 并发请求可能拿错 usage。

建议：

- `dispatch()` yield 一个内部 done/usage event，或返回 per-dispatch context。
- route 不再读取全局 `lastUsage`。

验收：

- 两个并发 chat 返回各自模型 usage。
- controlled engine 测试能硬断言 `done.usage.modelUsage`。

### 7. 错误处理统一

现状：

- Fastify 没有统一 `setErrorHandler`。
- 路由各自 try/catch。
- SSE error 直接 `String(error)`。
- 前端 API client 多处只抛 `failed: status`。

建议：

- 引入 `AppError`/`ApiError`：`code/message/details/requestId`。
- HTTP 和 SSE 共用错误 envelope。
- 前端统一解析错误并给出恢复动作。

验收：

- 不存在 agent 的 `/threads` 返回 404，而不是 500。
- 前端不会只显示 `listThreads failed: 500`。

### 8. 测试分层清理

现状：

- Playwright 全量已通过，但部分测试仍偏诊断。
- `thread-manager.test.ts` 有 EnginePool 陈旧断言。
- 存在未纳入 projects 的回归测试文件。

建议：

- 分层：unit、integration-db、contract、browser-e2e、observability。
- 删除或重写 EnginePool 历史测试。
- `agent-config.spec.ts`、`bug2-refresh-fix.spec.ts` 要么纳入 Playwright project，要么移到 archive。
- `api-alignment` 从打印诊断改成硬断言。

验收：

- `bun run test -- --workers=1` 继续 22/22。
- server 全量不再包含与当前架构冲突的断言。

## P2：体验与工程效率

### 9. 前端错误恢复体验

建议：

- 加全局 ErrorBoundary。
- 用 toast/inline error 统一替代分散 `console.error`/`alert`。
- SSE 断线、409 running、404 removed agent 给明确恢复入口。

### 10. SSE client 抽象

建议：

- 抽出可靠 SSE parser。
- 支持多行 `data:`、半包、parse error 上报、done/error 幂等、401 统一恢复。
- 对 parser 做单元测试，不只依赖浏览器 E2E。

### 11. DX 启动脚本

建议：

- 根目录统一提供 `db:up`、`dev:server`、`dev:web`、`dev:all`、`check`。
- 更新 web README，去掉模板残留文案。
- 将 `neptune-ai/web` 纳入根 workspace 或明确独立边界。

### 12. 生产安全默认值

建议：

- `NODE_ENV=production` 时强制 `validateConfig()`。
- CORS allowlist 环境变量化。
- 默认 admin 改为显式 seed 命令，不在 server start 隐式创建。

## 推荐执行顺序

1. Headless engine runtime/tool registry。
2. 权限 delegate 接入。
3. shared contract + SSE schema。
4. Langfuse request correlation + per-trace provider。
5. 清理 server 陈旧测试和迁移链路。
6. 前端错误恢复和 SSE client 抽象。
