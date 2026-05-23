# Headless Engine 与权限改造实施计划

日期：2026-05-20

## 当前状态

状态：已完成第一阶段实现，并已完成核心测试验证。

本计划最初用于指导“服务端真实 Engine 路径无头化 + 权限委托化”的实现。当前代码已经从早期设计演进为更清晰的落地方案：

- 不再让 Server 为 Engine 的 UI 依赖补 stub。
- 不再让服务端真实 Engine 路径实例化 CLI `QueryEngine.ts`。
- 新增 `HeadlessQueryEngine`，作为 Server host 的无头执行路径。
- 新增 `HeadlessToolRegistry`，作为 Server host 的无 UI 工具注册表。
- `ClaudeCodeEngineFactory` 已改为使用 `createHeadlessCCRuntime()`。
- 服务端权限已改为通过 `TenantPermissionDelegate` 决策，不再使用 `bypassPermissions: true`。

## 目标

让 Neptune AI 服务端真实 Engine 路径满足三个要求：

1. Headless：服务端运行时不加载 React、Ink、CLI UI、hook 或工具渲染模块。
2. Permission-aware：服务端工具执行必须经过租户级权限委托。
3. Testable：Engine 边界、Server 权限、产品层 SSE/UI 路径都能通过自动化测试验证。

这不是修一个 import bug，而是修正层级边界：Engine 不能把 UI 宿主的假设传染给 Server。

## 架构原则

### 1. Server 不为 UI 依赖兜底

原始错误是：

```text
Cannot find module '../hooks/useSettings.js'
from neptune-engine/src/ui/components/HighlightedCode.tsx
```

这类错误说明服务端路径触碰了 UI 模块。正确做法不是补一个假的 `useSettings.js`，而是让服务端路径根本不导入 UI。

### 2. Engine 提供宿主环境适配点

Engine 应该暴露清晰接口，让不同宿主选择不同 runtime：

- CLI/Desktop：可以选择 UI-aware runtime。
- Server：选择 headless runtime。
- Test：可以选择 controlled/fake runtime。

### 3. 权限必须在服务端确定化

服务端不能依赖交互式权限确认，也不能默认 bypass。权限判断必须能被测试，且必须基于：

- Agent 配置；
- workspace 路径；
- MCP server allowlist；
- 工具白名单；
- 请求上下文。

## 文件结构

### Engine 层

已新增：

- `neptune-engine/src/engine/cc-runtime/HeadlessQueryEngine.ts`
- `neptune-engine/src/engine/cc-runtime/HeadlessToolRegistry.ts`
- `neptune-engine/src/engine/cc-runtime/__tests__/headless-runtime.test.ts`

已修改：

- `neptune-engine/src/engine/cc-runtime/DefaultCCRuntime.ts`
- `neptune-engine/src/engine/cc-runtime/index.ts`
- `neptune-engine/src/engine/index.ts`
- `neptune-engine/src/engine/bridge/OriginalQueryEngineBridge.ts`
- `neptune-engine/src/services/roughTokenEstimation.ts`
- `neptune-engine/src/engine/__tests__/public-entrypoint.test.ts`

### Server 层

已修改：

- `neptune-ai/server/src/services/engine-factory.ts`
- `neptune-ai/server/src/services/permission-delegate.ts`
- `neptune-ai/server/src/services/thread-manager.ts`

已新增测试：

- `neptune-ai/server/test/permission-delegate.test.ts`
- `neptune-ai/server/test/engine-factory-permissions.test.ts`

### Headless-safe 拆分

已做延迟导入或纯模块拆分的关键区域：

- `utils/api.ts`
- `queryContext.ts`
- `roughTokenEstimation.ts`

目的都是避免服务端路径在 import 阶段碰到 UI-only 依赖。

## 实施任务

### 任务 1：新增 Headless Runtime Adapter

状态：已完成。

实现要点：

- 在 Engine 层新增 `createHeadlessCCRuntime()`。
- 该 factory 返回服务端专用 runtime。
- runtime 使用 `HeadlessToolRegistry`。
- runtime 使用 `HeadlessQueryEngine`，避免走 CLI QueryEngine。
- public engine entrypoint 导出该 factory，供 Server 层使用。

验证重点：

- `getAllBaseTools()` 不再触发 `tools.ts` fallback。
- headless runtime 可被独立导入。
- public entrypoint 可导入 headless factory。

### 任务 2：新增 Headless Tool Registry

状态：已完成。

实现要点：

- 提供服务端基础工具集合。
- 不导入 UI components、React hooks、Ink 组件或 CLI renderer。
- 与原 UI-aware tool registry 分离。

设计判断：

`HeadlessToolRegistry` 不是临时 mock，也不是 UI registry 的降级版。它是 Server host 的正式工具入口。

### 任务 3：新增 Headless Query Engine

状态：已完成第一阶段。

实现要点：

- 新增 `HeadlessQueryEngine`。
- `createHeadlessCCRuntime()` 不再实例化 CLI `QueryEngine.ts`。
- 服务端真实 engine 路径不再因为 UI import 失败。

当前边界：

- 当前实现覆盖最小真实 provider 文本流路径。
- 完整工具循环、复杂 provider 行为和 core tool extraction 仍属于后续深化。

这意味着第一阶段解决的是“Server 可干净运行真实 Engine 路径”，不是一次性完成完整 Claude Code CLI 行为复刻。

### 任务 4：接入 TenantPermissionDelegate

状态：已完成。

实现要点：

- `ClaudeCodeEngineFactory` 不再设置 `bypassPermissions: true`。
- 改为创建并注入 `TenantPermissionDelegate`。
- delegate 接收 workspace、工具白名单、MCP allowlist 等上下文。
- MCP 判断基于 server name，而不是 URL 字符串。

路径安全要求：

- 使用 `resolve` 计算绝对路径。
- 使用 `relative` 判断目标是否仍在 workspace 内。
- 使用 `isAbsolute` 处理绝对路径输入。
- 拒绝 `../` 路径逃逸。

权限优先级：

1. MCP allowlist 优先判断 MCP server 是否允许。
2. 普通工具再走工具白名单。
3. 文件路径必须额外通过 workspace containment 检查。

### 任务 5：改造 ClaudeCodeEngineFactory

状态：已完成。

实现要点：

- 使用 `createHeadlessCCRuntime()`。
- 将 agent identity 与 instructions 拼接为 `systemPrompt`。
- 将 MCP 配置转换为 `mcpServers: Array<{ name, url }>`。
- 将 MCP server name 传给 `TenantPermissionDelegate` 做 allowlist。
- 保留 controlled engine 路径，继续用于产品层自动化测试。

关键判断：

真实 Engine 路径和 controlled Engine 路径的用途不同：

- 真实 Engine 路径验证底层生产能力。
- controlled Engine 路径验证产品编排、SSE 和 UI。

它们应并存，但不能互相伪装。

### 任务 6：修复 Headless-safe Import

状态：已完成。

实现要点：

- 将容易触发 UI/CLI 依赖的模块改为延迟导入。
- 将纯逻辑能力拆成无 UI 依赖的模块。
- 让 Server 路径只导入 server-safe 代码。

涉及区域：

- API utility。
- query context。
- token estimation。
- 原 QueryEngine bridge。

判断标准：

服务端真实路径启动时，不应再出现 UI hook、React component、Ink renderer 等模块缺失错误。

## 验证命令

### Engine 核心测试

已通过：

```bash
cd neptune-engine
bun test src/engine/cc-runtime/__tests__/CCRuntime.test.ts src/engine/cc-runtime/__tests__/headless-runtime.test.ts src/engine/__tests__/public-entrypoint.test.ts
```

验证结果：

- 20 个测试通过。
- headless runtime 测试通过。
- public entrypoint 测试通过。
- 原 CCRuntime 测试保持通过。

### Server 权限测试

已通过：

```bash
cd neptune-ai/server
bun test test/permission-delegate.test.ts test/engine-factory-permissions.test.ts
```

验证结果：

- 7 个测试通过。
- 权限 delegate allow/deny 行为通过。
- engine factory runtime/permissions 接线通过。

### Server Chat 路径测试

依赖本地 Docker 服务，已在沙箱外通过：

```bash
cd neptune-ai/server
bun test test/controlled-engine-chat.test.ts
```

验证结果：

- 1 个测试通过。
- controlled engine chat 路径保持可用。

```bash
cd neptune-ai/server
bun test test/threads-chat.test.ts
```

验证结果：

- 9 个测试通过。
- threads chat 路径保持可用。

### 真实 Headless Query 最小验证

已验证：

- 不再报 UI import 错误。
- 在沙箱外网不可达时，失败点变为 provider 网络连接失败。

这说明原始问题已经从“错误加载 UI 模块”推进到“真实 provider 网络访问问题”，架构边界问题已被第一阶段修正。

## 残余风险

### 1. HeadlessQueryEngine 仍是第一阶段实现

当前实现更接近最小 Anthropic SSE 文本流 adapter。后续仍需要补齐：

- 工具调用循环。
- 工具结果回填。
- provider 中断与恢复。
- 更完整的 usage/token 统计。
- 更细粒度的错误事件。

### 2. 权限模型需要继续产品化

当前 delegate 已具备核心 allow/deny 能力，但后续需要：

- 把权限决策记录进可观测系统。
- 在 UI 中展示 agent 权限边界。
- 对高风险工具提供更细策略。
- 对 MCP server 能力做更结构化描述。

### 3. Langfuse 关联还不是端到端闭环

当前重点是 headless + permission。Langfuse 后续需要独立阶段处理：

- request/thread/agent trace 关联。
- provider call span。
- tool call span。
- permission decision span。
- SSE event 与 trace 的对应关系。

### 4. 浏览器自动化仍需继续补覆盖率

当前测试已覆盖基础可用性，但还需要形成稳定报告：

- 认证流。
- Agent 创建/编辑/删除。
- 会话创建。
- controlled engine mock LLM 对话。
- SSE 渲染。
- 错误态。
- 空态。
- 权限拒绝态。

## 后续建议

### 优先级 P0：真实 Engine 工具循环

目标：

- 让 headless runtime 支持完整 tool call lifecycle。
- 明确 tool call、permission decision、MCP call、provider event 的统一事件模型。

原因：

这是产品从“可对话”走向“可执行任务”的核心。

### 优先级 P1：Langfuse 可观测闭环

目标：

- 每次用户请求都能追踪到 thread、agent、provider、tool、permission。
- 测试中可断言关键 span 存在。

原因：

Agent 产品如果不可观测，就无法 debug，也无法做质量提升。

### 优先级 P1：浏览器自动化覆盖率报告

目标：

- 固化 Playwright 测试矩阵。
- 输出覆盖清单、截图、trace、失败原因。
- 区分 UI coverage、API coverage、Engine coverage。

原因：

浏览器自动化的价值不是“跑过一次”，而是变成每次改动后的产品安全网。

### 优先级 P2：Shared 协议收敛

目标：

- 把 SSE/API 类型抽到 shared。
- 让 Web、Server、Engine 对事件语义达成同一契约。

原因：

当真实 Engine 能力扩大后，协议不稳定会成为前后端协作瓶颈。

## 完成标准

本阶段完成标准如下：

1. 原始 `useSettings.js` UI import 错误消失。
2. 服务端真实 Engine 路径不再需要 UI stub。
3. Server 使用 `createHeadlessCCRuntime()`。
4. Server 使用 `TenantPermissionDelegate`。
5. 权限拒绝路径有测试。
6. 路径逃逸防护有测试。
7. Engine headless runtime 有测试。
8. controlled engine 产品测试保持通过。
9. 文档与当前实现一致。

当前状态：以上第一阶段完成标准已经满足。

## 结论

这次优化的关键不是“修了一个 Bun import 报错”，而是把错误暴露出来的架构问题向下追到了正确层级：

- UI 依赖不能进入 Server runtime。
- Server 权限不能 bypass。
- Engine 必须提供宿主环境适配点。
- 产品测试和真实 Engine 测试必须分层。

后续应继续沿着这个方向推进：少做局部粉饰，多做能让系统边界更清晰、运行更可验证、Agent 行为更可观测的改造。
