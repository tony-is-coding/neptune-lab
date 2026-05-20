# Neptune AI 全量验证测试报告

生成时间：2026-05-20 17:22 CST  
验证范围：`neptune-ai/server`、`neptune-ai/web`、`neptune-engine`、Langfuse 可观测链路  
验证模式：本地 Docker Postgres/Redis + 本地 Langfuse + controlled engine mock LLM

## 结论

当前可以确认：基础登录、路由保护、Agent/Skill/Collaborate 主要页面、Thread 创建、Chat SSE、模型交互 UI、工具调用 UI、`ask_user` 决策块、artifact 面板、plan 面板、SSE abort/401/409/404 恢复、跨 Thread 历史隔离与刷新恢复，在 controlled engine 模式下已经形成可重复的自动化验收门禁。Chat wire event、Web SSE parser、requestId、Langfuse trace/span/generation/tool metadata 已进入自动测试门禁。

当前不能确认：真实外部 LLM provider 的端到端生产质量仍未纳入本地自动门禁；真实 Langfuse 后端查询/展示层面的验收仍未自动化；`ask_user` 的回答结果当前只验证前端本地已回答状态，尚未验证 engine resume 语义和回答内容刷新后持久化。

## 登录 500 排查结论

本轮从“登录时出现 500”进入排查。当前环境没有复现登录 API 本身的 500：初始事实是 `localhost:3000` 没有 server 监听，`localhost:3004` 前端仍在运行。重新执行 E2E seed 并以 controlled engine 模式启动 server 后，`POST /api/v1/auth/login` 在 `localhost:3000` 和经由 web proxy 的 `localhost:3004` 均返回 200，浏览器认证项目 7/7 通过，完整 Playwright 矩阵 26/26 通过。

执行注记：同一条 `npx playwright test --workers=1` 在 Codex macOS 沙箱内会因 Chromium `MachPortRendezvousServer` 权限被拒绝而 0ms 失败；这不是产品代码失败。沙箱外执行同一命令通过，结果为 `26 passed (49.8s)`。

已确认的环境前置条件：

- DB: Postgres `localhost:5433` 可用。
- Redis: `localhost:6380` 可用。
- Server: `NEPTUNE_ENGINE_MODE=controlled bun run dev` 监听 `0.0.0.0:3000`。
- Web: Vite dev server `http://localhost:3004`。
- Seed: `bun run src/scripts/seed-e2e.ts` 已创建/确认 E2E 用户与 Agent。

本轮验证账号：

- 用户：`e2e@neptune.ai`
- 密码：`NeptuneE2E2026!`
- Agent：`E2E Assistant`

因此，这次登录 500 更像是“后端未启动或启动环境不完整”导致的前端侧失败表现，而不是认证路由业务逻辑在当前代码下稳定返回 500。真正的代码层风险已经在 Thread 路由 guard 中处理：非法 UUID、缺失 Agent、跨租户 Agent、非法 Thread ID 返回 404，避免数据库 UUID/FK 异常向上冒成 500。

## 测试环境

- Server: `NEPTUNE_ENGINE_MODE=controlled bun run dev`，当前 `.env` 默认 `PORT=3000`
- Web: `bun run dev`，Vite `http://localhost:3004`
- DB: Docker Postgres `localhost:5433`
- Redis: Docker Redis `localhost:6380`
- Langfuse: `http://localhost:3001`
- E2E 用户：`e2e@neptune.ai`
- E2E Agent：`E2E Assistant`

## 自动化结果

| 层级 | 命令 | 结果 | 说明 |
|---|---|---:|---|
| Web lint | `bun run lint` | 通过 | `tsc --noEmit` 退出码 0 |
| Web SSE parser 单测 | `bunx vitest run src/api/sse-parser.test.ts` | 3/3 通过 | 覆盖半包、多帧、多行 data、坏 JSON 跳过 |
| Web controlled chat | `npx playwright test --project=controlled-chat --workers=1` | 8/8 通过 | smoke/auth 依赖 + 模型交互 UI + 工具 UI + 历史恢复；沙箱外运行以绕过 macOS Chromium Mach port 限制 |
| Web advanced workflow | `npx playwright test --project=advanced-chat --project=sse-recovery --project=thread-stability --workers=1` | 11/11 通过 | 覆盖 `ask_user`、artifact、plan、abort、401、409、404、thread 切换/刷新恢复 |
| Web chat workflow gate | `npx playwright test --project=controlled-chat --project=advanced-chat --project=sse-recovery --project=thread-stability --workers=1` | 12/12 通过 | controlled-chat 与高级工作流组合门禁 |
| Web auth focused | `npx playwright test --project=auth --workers=1` | 7/7 通过 | 覆盖登录页、正确登录、错误登录、注册切换、token 持久化 |
| Web full E2E matrix | `npx playwright test --workers=1` | 26/26 通过 | `26 passed (49.8s)`；覆盖 auth、api-alignment、auth-401、navigation、collaborate、controlled-chat、advanced-chat、sse-recovery、thread-stability |
| Server 全量 | `bun test` | 275/275 通过 | 覆盖认证、Agent/Skill/Thread、权限、Prompt、Plan、Chat contract、Observability、Thread 路由坏输入稳定性 |
| Server Thread focused | `bun test test/thread-manager.test.ts` | 34/34 通过 | 覆盖 Thread CRUD/chat/history/reply/tasks、非法 Agent/Thread ID、租户隔离和无池化 Engine 生命周期 |
| Server chat/contract/observability | `bun test test/controlled-engine-chat.test.ts test/threads-chat.test.ts test/chat-request-context.test.ts test/chat-contract.test.ts test/observability-request-context.test.ts` | 16/16 通过 | Chat SSE、旧 API 兼容、shared contract、requestId、Langfuse payload |
| Engine headless | `bun test src/engine/cc-runtime/__tests__/CCRuntime.test.ts src/engine/cc-runtime/__tests__/headless-runtime.test.ts src/engine/__tests__/public-entrypoint.test.ts` | 20/20 通过 | public entrypoint、MockCCRuntime、headless runtime 安全导入 |
| 默认启动验证 | `NEPTUNE_ENGINE_MODE=controlled bun run dev` | 通过 | server 绑定 `0.0.0.0:3000`，`GET /health` 返回 200 |

## 本次新增/修复的验收能力

- 新增 `ControlledEngineFactory`：通过 `NEPTUNE_ENGINE_MODE=controlled` 或 `NEPTUNE_MOCK_LLM=1` 注入受控模型，避免 server chat 测试加载真实 engine/UI 链。
- 新增后端测试 `controlled-engine-chat.test.ts`：验证 thinking、tool_use、tool_result、text、done、history。
- 新增 Playwright 测试 `controlled-chat.spec.ts`：从浏览器验证登录、独立 thread、发送消息、SSE 流式响应、工具 UI、输入框恢复、刷新后历史恢复。
- 新增 Playwright 测试 `advanced-chat.spec.ts`：从浏览器验证 `ask_user` 问答块、artifact 详情面板、plan 进度，并在刷新后恢复。
- 新增 Playwright 测试 `sse-recovery.spec.ts`：覆盖用户主动停止生成、401 chat fetch、409 running thread、404 missing thread 的前端恢复。
- 新增 Playwright 测试 `thread-stability.spec.ts`：覆盖两个 Thread 的历史隔离、刷新恢复和切换恢复，防止会话串线/丢数据。
- 将 `controlled-chat`、`advanced-chat`、`sse-recovery`、`thread-stability` 纳入 Playwright project。
- 新增 shared Chat/API/Observability 契约：Server/Web/SSE 共享同一组 wire event、view model、API envelope 类型。
- 新增 request scoped tracing provider：每次 dispatch 创建独立 `LangfuseTracingProvider`，避免并发请求覆盖 `currentTrace/currentTurnSpan/currentRoundSpan/lastGeneration`。
- Langfuse trace、turn span、round span、reasoning span、tool span、generation、trace final update 统一携带 `requestId/threadId/agentId/tenantId/userId/model/sdkSessionId`。
- Web SSE parser 从 `sendThreadMessage` 中抽出为独立 Module，形成可单测的契约入口，覆盖半包、多帧、多行 data 和坏 JSON。
- Chat 输入区在 streaming 时展示“停止生成”，abort 后恢复可输入状态。
- Thread history event sourcing 扩展到 `ask_user`、artifact、`plan_created/plan_step/plan_done`，刷新后可重建用户可见工作流块。
- Thread 路由入口新增 Agent/Thread 可访问性 guard：非法 UUID、合法但不存在的 Agent、跨租户 Agent、非法 Thread ID 统一返回 404，避免 Postgres UUID/FK 异常冒成 500。
- Thread 子路由 `chat/history/reply/tasks` 共用同一个 ownership lookup，降低重复判断导致的漏网风险。
- 修正 Engine 生命周期测试夹具：Thread 创建使用同租户普通用户，保留真实租户隔离前提。
- 修复 Playwright 多处 `waitUntil: "load"` / `networkidle` 导致的非确定性超时，改为 `domcontentloaded` + 明确 UI/API 断言。
- 修复 Thread DELETE 路由 204/404 路径在测试中触发 `ERR_HTTP_HEADERS_SENT` 的问题。
- 修复 server 默认端口漂移：本地 `.env` 从 `PORT=3005` 收敛为 `PORT=3000`，与 web proxy、E2E 和文档默认值一致。
- 删除/重写陈旧 EnginePool 断言，改为验证当前“每次 dispatch 创建/销毁 Engine”的无池化生命周期。
- 修复测试用户构造：`createTestUser` 现在生成唯一邮箱/租户，并保证普通用户角色不被注册流程提升为 admin。
- 修复 Agent 管理和 Thread 更新的重复写响应问题，避免权限 preHandler 已返回后 handler 继续发送响应。

## 浏览器覆盖矩阵

| 场景 | 覆盖状态 | 证据 |
|---|---|---|
| 登录页渲染 | 已覆盖 | smoke |
| 未登录访问受保护路由跳转 `/login` | 已覆盖 | smoke |
| JS runtime error 基础检查 | 已覆盖 | smoke/collaborate |
| 正确账号登录 | 已覆盖 | auth |
| 登录状态刷新保留 | 已覆盖 | auth |
| 错误账号提示 | 已覆盖 | auth |
| 注册/登录模式切换 | 已覆盖 | auth |
| 无效 token 自动清除 | 已覆盖 | auth-401 |
| `token=undefined` 自动恢复 | 已覆盖 | auth-401 |
| Home/Skills/Agents/Collaborate API 连通 | 已覆盖 | api-alignment/navigation |
| Collaborate Agent + Thread API | 已覆盖 | collaborate/api-alignment |
| Agent 切换触发 Thread API | 已覆盖 | collaborate |
| Chat SSE 模型交互 UI | 已覆盖 | controlled-chat |
| Tool UI 展示 | 已覆盖 | controlled-chat |
| History reload 恢复 | 已覆盖 | controlled-chat |
| SSE parser 半包/多帧/多行 data | 已覆盖 | `src/api/sse-parser.test.ts` |
| Chat requestId header/connected/done/error | 已覆盖 | server contract + controlled-chat |
| Langfuse payload correlation metadata | 已覆盖 | `observability-request-context.test.ts` |
| `ask_user` 问答块展示与提交 | 已覆盖 | advanced-chat |
| artifact 列表与详情面板 | 已覆盖 | advanced-chat |
| plan 面板步骤与完成进度 | 已覆盖 | advanced-chat |
| `ask_user`/artifact/plan 刷新恢复 | 已覆盖 | advanced-chat |
| 主动停止 SSE stream | 已覆盖 | sse-recovery |
| Chat 401 恢复提示 | 已覆盖 | sse-recovery |
| Thread running 409 恢复提示 | 已覆盖 | sse-recovery |
| 缺失 Thread 404 错误面板 | 已覆盖 | sse-recovery |
| 多 Thread 历史隔离和切换恢复 | 已覆盖 | thread-stability |
| 非法/不存在 Agent 的 Thread 创建和列表 | 已覆盖 | `test/thread-manager.test.ts` |
| 非法 Thread ID 的 chat/history/reply/tasks | 已覆盖 | `test/thread-manager.test.ts` |

## 仍缺失的测试

- `ask_user` 的后端 resume 语义：当前 `/reply` 返回 202，浏览器只验证“已回答”前端状态；还需要覆盖回答内容进入下一轮 engine 上下文、刷新后回答状态/答案仍可恢复。
- artifact 内容版本化/多 artifact 选择：当前覆盖单个 `workflow-summary.md`，还缺多个 artifact、同名更新、下载/复制等用户动作。
- plan 的失败/阻塞/重试状态：当前覆盖 completed happy path，未覆盖 failed、blocked、in_progress 长时间运行和计划重建。
- 并发 Chat：`ThreadManager.lastUsage` 仍保留兼容接口，虽然 chat route 已不依赖它，但仍缺少多 thread 并发 dispatch 的 payload 级回归测试。
- Langfuse payload：已覆盖 request context 贯穿，但还缺真实本地 Langfuse 查询或导出层面的验收；目前断言停在 fake provider payload。

## 重要缺口

### 1. 真实 provider 仍缺端到端门禁

当前 headless runtime/public entrypoint 已通过 20 个 engine 测试，证明 server 侧可以安全导入 headless engine，不再依赖 CLI/UI 模块作为基本前提。仍未完成的是：真实外部 LLM provider 的可重复集成门禁、provider 失败/限流/超时语义、以及 Langfuse 对真实 generation/tool payload 的端到端核验。

### 2. 高级交互已进门禁，但 resume 语义仍偏浅

当前浏览器门禁已覆盖普通文本、thinking、tool_use、tool_result、done、`ask_user`、artifact、plan 面板、SSE 错误恢复和 Thread 稳定性。下一层缺口不是“能不能显示”，而是“用户决策是否真正改变后续 engine 执行”，也就是 `ask_user` answer resume、artifact 多版本、plan 失败/阻塞/恢复的状态机完整性。

### 3. 非 Thread 路由仍需继续做坏输入稳定性扫描

Thread 路由已经把非法 UUID、合法但不存在的 Agent、跨租户 Agent、非法 Thread ID 收敛为 404。下一步应把同样的入口 guard 思路扩展到 Agent、Skill、Document、Tenant/User 等其它直接使用 UUID 查询的路由，避免坏输入从路由层穿透成数据库异常。

### 4. Langfuse 可观测仍需真实后端核验

当前 fake provider 已自动断言 trace/span/generation/tool payload 的 correlation metadata，包括 `requestId/threadId/agentId/tenantId/userId/model/sdkSessionId`。下一步缺口不是“代码有没有传字段”，而是“真实 Langfuse 后端是否按预期展示、查询、聚合这些字段”，以及多 thread 并发 dispatch 的实际 trace 不串线。

## 建议门禁

短期把以下命令作为本地 release gate：

```bash
cd neptune-ai/server
bun test

cd ../web
bun run lint
bunx vitest run src/api/sse-parser.test.ts
npx playwright test --project=controlled-chat --project=advanced-chat --project=sse-recovery --project=thread-stability --workers=1

cd ../../neptune-engine
bun test src/engine/cc-runtime/__tests__/CCRuntime.test.ts src/engine/cc-runtime/__tests__/headless-runtime.test.ts src/engine/__tests__/public-entrypoint.test.ts
```

真实 provider integration 完成后，再加入“受控 provider + 真实 Langfuse 查询”的集成门禁，而不是继续只依赖 controlled engine 与 fake provider。
