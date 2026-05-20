# Neptune AI 全量验证测试报告

生成时间：2026-05-19 23:52 CST  
验证范围：`neptune-ai/server`、`neptune-ai/web`、`neptune-engine`、Langfuse 可观测链路  
验证模式：本地 Docker Postgres/Redis + 本地 Langfuse + controlled engine mock LLM

## 结论

当前可以确认：基础登录、路由保护、Agent/Skill/Collaborate 主要页面、Thread 创建、Chat SSE、模型交互 UI、工具调用 UI、对话历史恢复，在 controlled engine 模式下已经形成可重复的自动化验收门禁。

当前不能确认：真实 `AgentEngine` 调用真实 LLM 的生产路径仍被 `neptune-engine` 的 UI/Ink 导入链阻断；Langfuse 只验证到初始化和事件处理代码路径，尚未形成 trace payload 的自动断言；旧 EnginePool 测试与当前“每次 dispatch 创建/销毁 Engine”的实现已不一致。

## 测试环境

- Server: `PORT=3000 NEPTUNE_ENGINE_MODE=controlled bun run dev`
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
| Web Playwright 全量 | `bun run test -- --workers=1` | 22/22 通过 | smoke/auth/api-alignment/auth-401/navigation/collaborate/controlled-chat |
| Web controlled chat | `bun run test -- --project=controlled-chat --workers=1` | 8/8 通过 | 包含 smoke/auth 依赖和模型交互 UI |
| Server controlled/compat/workspace | `bun test test/controlled-engine-chat.test.ts test/threads-chat.test.ts test/thread-manager-workspace.test.ts` | 22/22 通过 | Chat SSE、旧 API 兼容、workspace 隔离 |
| Server DELETE 聚焦回归 | `bun test test/thread-manager.test.ts -t "DELETE"` | 3/3 通过 | 修复 204/404 路径重复写头问题 |
| Engine headless | `bun test src/engine/cc-runtime/__tests__/CCRuntime.test.ts src/engine/__tests__/public-entrypoint.test.ts` | 17/17 通过 | public entrypoint 和 MockCCRuntime 安全导入 |
| Server Thread 全量组合 | `bun test test/controlled-engine-chat.test.ts test/threads-chat.test.ts test/thread-manager.test.ts test/thread-manager-workspace.test.ts` | 42/47 通过 | 5 个失败来自陈旧 EnginePool 断言和已修复前的 DELETE 问题 |

## 本次新增/修复的验收能力

- 新增 `ControlledEngineFactory`：通过 `NEPTUNE_ENGINE_MODE=controlled` 或 `NEPTUNE_MOCK_LLM=1` 注入受控模型，避免 server chat 测试加载真实 engine/UI 链。
- 新增后端测试 `controlled-engine-chat.test.ts`：验证 thinking、tool_use、tool_result、text、done、history。
- 新增 Playwright 测试 `controlled-chat.spec.ts`：从浏览器验证登录、独立 thread、发送消息、SSE 流式响应、工具 UI、输入框恢复、刷新后历史恢复。
- 将 `controlled-chat` 纳入 Playwright project。
- 修复 Playwright 多处 `waitUntil: "load"` / `networkidle` 导致的非确定性超时，改为 `domcontentloaded` + 明确 UI/API 断言。
- 修复 Thread DELETE 路由 204/404 路径在测试中触发 `ERR_HTTP_HEADERS_SENT` 的问题。

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

## 仍缺失的测试

- `ask_user` 问答块：UI 有 `QuestionBlock` 和 `/reply` API，但没有端到端测试。
- `artifact` 块和右侧 artifact 面板：mapper 和 hook 有支持，但没有 controlled case 覆盖。
- `plan_created/plan_step/plan_done`：PlanManager 与右侧任务面板未纳入浏览器门禁。
- SSE 解析边界：多行 `data:`、半包 JSON、parse error、abort、401 chat fetch 未形成单元/浏览器组合测试。
- 并发 Chat：`ThreadManager.lastUsage` 和 `LangfuseTracingProvider` 均存在全局可变状态风险，缺少并发隔离测试。
- Langfuse payload：当前只验证初始化和代码路径，缺少 fake Langfuse provider 的 trace/span/generation/tool payload 断言。

## 重要缺口

### 1. 真实 engine 仍失败

在旧 chat 兼容测试中，真实 `ClaudeCodeEngineFactory` 路径仍出现：

- `Cannot find module '../OffscreenFreeze.js' from .../ShellProgressMessage.tsx`
- `Requested module is not instantiated yet.`

根因是 server 调用真实 engine 时，`DefaultCCRuntime.getAllBaseTools()` 拉入 `neptune-engine/src/tools.ts`，继而加载 builtin tools 的 React/Ink UI 文件。controlled engine 证明产品编排/SSE/UI 可以工作，但不能替代真实 engine 的 headless 解耦工作。

### 2. 旧 EnginePool 测试陈旧

`thread-manager.test.ts` 的 EnginePool 断言期望 engine 不销毁、二次 dispatch 复用 session、pool 淘汰。这与当前 `ThreadManager` 文件头描述的“每次 dispatch 创建/销毁 Engine”冲突。建议删除旧 pool 断言或重写为当前生命周期测试。

### 3. API 错误语义仍不一致

`/collaborate/test-agent-id` 会触发 `/agents/test-agent-id/threads` 500。页面没有崩溃，但语义上应返回 404 或前端避免对不存在 agent 发 threads 请求。

### 4. Langfuse 可观测还不是验收门禁

当前 Langfuse 初始化成功，但没有自动测试断言 trace 内容。尤其缺少 `requestId`、`route`、`sdkSessionId`、`threadId` 之间的关联；provider 也使用 `currentTrace/currentTurnSpan/currentRoundSpan/lastGeneration` 单例字段，并发 dispatch 有串线风险。

## 建议门禁

短期把以下命令作为本地 release gate：

```bash
cd neptune-ai/server
bun test test/controlled-engine-chat.test.ts test/threads-chat.test.ts test/thread-manager-workspace.test.ts

cd ../web
bun run lint
bun run test -- --workers=1

cd ../../neptune-engine
bun test src/engine/cc-runtime/__tests__/CCRuntime.test.ts src/engine/__tests__/public-entrypoint.test.ts
```

真实 engine headless 解耦完成后，再加入真实 LLM smoke 或 mock provider integration，而不是继续依赖 UI stub。
