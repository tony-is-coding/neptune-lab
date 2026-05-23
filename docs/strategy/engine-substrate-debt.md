# Engine Substrate Debt — Agent Loop 缺失诊断与修复计划

> **状态**：调研完成、待用户审阅。审完后才进 Phase C 代码实施。
> **作者**：claude-opus-4.7（接手 codex 9536 worktree）
> **日期**：2026-05-23
> **HEAD**：`733d42d feat(builtin-tools): Phase B`

---

## 0. 一句话摘要

**`neptune-engine/` 当前完全没有 agent loop**：没有 tool_use 提取、没有 ToolDispatcher、没有 multi-turn 反馈、没有 ToolUseContext 真实注入。所有 7 个 Provider 的 `query()` 直接返错 `unsupportedProductRuntimeProvider()`。这是 Claude Code agent runtime 的灵魂，被剥离过程一刀剥光、又没补回来。

**原因**：2026-05-22 凌晨 `52e5fb1` 把 product 反向依赖清零（**只内联类型，没补实现**），半天后 `a9a894e` 进一步 enforce kernel boundary（**直接把所有 Provider 的 `await import('../../services/api/claude.js')` 删干净**）。此后 engine 跑不通任何 LLM 请求。

**修复路径**（已与用户对齐）：**路径 2 — 在 engine 里重新长出最小干净 agent loop**，不抄 product 那 3490 行 claude.ts 里的 product-specific 行为（langfuse / VCR / advisor / growthbook / cached microcompact / token budget / autocompact / skill prefetch / queryTracking / circuit breaker 等）。Engine 是 substrate（基底），不是 supervisor（监督者）—— 给模型多次犯错的机会，把错误暴露出来，而不是替模型代偿。

---

## 1. 事实链：剥离过程做错了什么

### 1.1 时间线

```
2026-05-22 11:27   52e5fb1  清零 engine 层对 product 反向依赖
                            - 内联了 75 处类型引用
                            - 但**没有内联任何运行时实现**
                            - Provider.query() 仍然 await import('../../services/api/claude.js')
                            - 这是中间态（编译靠类型、运行靠 product）

2026-05-22 16:55   a9a894e  enforce runtime kernel boundary
                            - 删掉所有 7 个 Provider 的 await import claude.js
                            - 替换为 yield this.unsupportedProductRuntimeProvider()
                            - DefaultCCRuntime 的 require('../../QueryEngine.js') 全删
                            - HeadlessToolRegistry 把 zod schema 替成静态 JSON Schema
                            - **此时起 engine 任何 LLM 请求都返错**
```

### 1.2 罪魁 commit 的具体 hunk（可追溯）

**`a9a894e` AnthropicProvider.ts`：原本 38 行的 query 逻辑被剥光**

```diff
-                 const {queryModelWithStreaming} = await import('../../../services/api/claude.js')
-                 // 1. 参数转换：ProviderQueryParams → CC 所需格式
-                 const systemPrompt = this.buildSystemPrompt(params.systemPrompt)
-                 const messages = this.normalizeMessages(params.messages)
-                 const model = params.model || this.config.defaultModel || 'claude-sonnet-4-20250514'
-                 // 2. 构建 queryModelWithStreaming 所需的 Options
-                 const options = this.buildOptions({...params, model})
-                 // 3. 调用 CC 的 queryModelWithStreaming
-                 const stream = queryModelWithStreaming({...})
-                 // 4. 转换流式响应：CC 格式 → ProviderMessage
-                 try {
-                   for await (const event of stream) {
-                     yield this.convertToProviderMessage(event)
-                   }
-                 } finally { ... }
+                 void params
+                 yield this.unsupportedProductRuntimeProvider()
```

同样剥法应用在 6 个其他 Provider（Bedrock / Foundry / Gemini / Grok / OpenAI / Vertex）。

**`a9a894e` DefaultCCRuntime.ts：90% 实现被替成 no-op**

| 方法 | 剥离前 | 剥离后 |
|---|---|---|
| `getAllBaseTools()` | `require('../../tools.js').getAllBaseTools()` | `(this.toolRegistry ?? new HeadlessToolRegistry()).getTools()` |
| `enableConfigs()` | `require('../../utils/config.js').enableConfigs()` | `// Product hosts may enable their own config system` (空) |
| `setupBootstrap(state)` | `setCwdState/setOriginalCwd/setProjectRoot` | `// SessionContext carries cwd/projectRoot` (空) |
| `createQueryEngine()` | `new QueryEngine(config)` | `new HeadlessQueryEngine(config)` |
| `runWithCwd()` | `runWithCwdOverride(cwd, fn)` | `void cwd; return fn()` |
| `createFileStateCache()` | `new CCFileStateCache(...)` | `new SimpleFileStateCache()` |
| `hasPermissionsToUseTool()` | `ccHasPermissionsToUseTool(...)` | `return {behavior: 'allow'}` |

### 1.3 留下的简化版 `HeadlessQueryEngine`

`neptune-engine/src/engine/cc-runtime/HeadlessQueryEngine.ts`（177 行）—— 这是当前唯一能"跑"的 query 路径，但功能极度简化：

- ✅ 直接 `fetch('https://api.anthropic.com/v1/messages')`，不通过 SDK
- ✅ SSE 帧切分 + JSON 解析（`\n\n` 边界）
- ❌ **只解析 `event.delta?.type === 'text_delta'`**，丢弃所有其他事件
- ❌ 不处理 `content_block_start` / `content_block_stop` / `message_start` / `message_delta` / `message_stop`
- ❌ 不处理 `tool_use` block（input_json_delta 累积）
- ❌ 不处理 `thinking` / `signature_delta` / `thinking_delta`
- ❌ `messages.map(m => ({role: 'user', content: String(m.message?.content ?? '')}))` —— 直接把所有 messages 强转成 user role + 字符串 content，**完全不识别 assistant message + tool_use + tool_result block**
- ❌ 没有 multi-turn 循环：fetch 一次、yield text、`type: 'result', subtype: 'success'` 结束
- ❌ 没有 tool dispatcher、没有 newMessages 反馈、没有 token usage 累计、没有取消信号传播

**结论**：当前 `neptune-engine/` 只能跑"无工具的单轮纯文本对话"，这不是 agent runtime，是个 demo。

### 1.4 完整 agent loop 仍然活在 product 层

| 文件 | 行数 | 角色 |
|---|---|---|
| `neptune-engine-product/src/services/api/claude.ts` | 3490 | LLM 客户端 + SSE 解析 + token usage |
| ↳ `queryModelWithStreaming` (772-806) | 35 | 入口：包 VCR、转 callModel |
| ↳ `queryModel` (1037-2969) | 1933 | SSE 主循环 + 重试 + fallback + 微编译 |
| ↳ SSE 事件分发 (2024-2300) | 277 | content_block_start/delta/stop + message_start/delta + thinking + tool_use 累积 |
| ↳ `userMessageToMessageParam` / `assistantMessageToMessageParam` (578-674) | 97 | Message ↔ MessageParam 转换 |
| ↳ `addCacheBreakpoints` (3134-3284) | 151 | prompt caching 标记 |
| ↳ `updateUsage` / `accumulateUsage` (2995-3110) | 116 | token usage 累计 |
| ↳ `cleanupStream` (2969-2994) | 26 | 取消时清理 |
| `neptune-engine-product/src/query.ts` | 1779 | Multi-turn loop |
| ↳ `query` (217-275) | 59 | 顶层入口 |
| ↳ `queryLoop` (276-1778) | 1503 | `while(true)` 主循环：调 callModel → 收 assistantMessage → 跑 tools → push toolResults → state.messages 反馈 |
| `neptune-engine-product/src/services/tools/StreamingToolExecutor.ts` | 366 | tool_use 并发执行器 + tool_result 生成 |

**这些代码 Claude Code product 用户每天都在用**，是经过百万级真实 prompt 验证过的实现。

---

## 2. 缺失清单（按层级展开，每条带证据）

### 2.1 SSE 解析层（Provider 内部）

| # | 缺失项 | 证据（product 侧 line ref） | engine 现状 | 影响 |
|---|---|---|---|---|
| 1 | `message_start` 事件累积（partialMessage / 初始 usage） | `claude.ts:2046-2059` | 完全没处理 | 拿不到 stop_reason、initial usage、id |
| 2 | `content_block_start` for `text` block | `claude.ts:2080-2090` | 没处理 | 不知道 block 类型，无法初始化累积器 |
| 3 | `content_block_start` for `tool_use` block | `claude.ts:2050-2057` | **完全没处理** | 拿不到 tool 名字 + tool_use_id，loop 无法继续 |
| 4 | `content_block_start` for `thinking` block | `claude.ts:2092-2098` | 没处理 | thinking 内容丢失 |
| 5 | `content_block_delta` 中 `text_delta` | `claude.ts:2160-2173` | ✅ 已处理（仅此一种） | — |
| 6 | `content_block_delta` 中 `input_json_delta` | `claude.ts:2143-2160` | **完全没处理** | tool input 是流式的 JSON 字符串，必须累积成完整 JSON |
| 7 | `content_block_delta` 中 `thinking_delta` / `signature_delta` | `claude.ts:2196-2210` | 没处理 | thinking 数据丢失 |
| 8 | `content_block_stop` → emit AssistantMessage | `claude.ts:2224-2266` | 没处理 | 没有完整 block 边界，无法 emit |
| 9 | `message_delta` → 更新 usage / stop_reason | `claude.ts:2269-2310` | 没处理 | 不知道为什么停（end_turn / tool_use / max_tokens） |
| 10 | `message_stop` → 终止信号 | `claude.ts` SSE | 没处理 | 流结束没有标记 |

### 2.2 Provider 调用层

| # | 缺失项 | 证据 | engine 现状 | 影响 |
|---|---|---|---|---|
| 11 | Anthropic SDK 客户端注入 | `claude.ts:1830 getAnthropicClient()` | 直接 fetch，不走 SDK | 没有内置重试、超时、错误标准化 |
| 12 | `messages` 字段正确序列化（含 tool_use / tool_result block 数组） | `claude.ts:578-674 userMessageToMessageParam / assistantMessageToMessageParam` | 强转成 `{role: 'user', content: String(...)}` | tool_use_id 丢失，multi-turn 不可能 |
| 13 | `system` 字段（system prompt 数组化 + cache_control） | `claude.ts:3284-3310 buildSystemPromptBlocks` | 简化为 string | 失去 prompt caching、失去 system 多块结构 |
| 14 | `tools` 字段（工具 schema 数组发给 API） | `claude.ts:queryModel params 构造` | **完全没传 tools** | 模型永远拿不到 tool list，永远不会 emit tool_use |
| 15 | `signal` 取消信号传播到 fetch | `HeadlessQueryEngine.ts:54` | ✅ 已处理 | — |
| 16 | API error → 标准化错误事件 | `claude.ts:executeNonStreamingRequest 错误处理` | catch 后 yield error | 错误信息基本不可用 |

### 2.3 Multi-turn Loop 层

| # | 缺失项 | 证据 | engine 现状 | 影响 |
|---|---|---|---|---|
| 17 | `while(true)` 主循环（直到 stop_reason === 'end_turn'） | `query.ts:342-1778` | **完全没有** | 一次 fetch 完就结束 |
| 18 | 收集本轮 assistant content blocks | `query.ts:assistantMessages` | 没有 | — |
| 19 | 提取本轮 tool_use blocks | `query.ts:toolUseBlocks 数组` | 没有 | — |
| 20 | 调用 ToolDispatcher 执行 tool_use | `query.ts:1430 runTools(toolUseBlocks, ...)` | **没有 ToolDispatcher** | tools 不会被执行 |
| 21 | tool 执行结果 → tool_result block | `StreamingToolExecutor.ts:99-102 type:'tool_result',is_error,tool_use_id` | 没有 | — |
| 22 | tool_result 包成 user message | `query.ts:1442 toolResults.push(...)` + `normalizeMessagesForAPI` | 没有 | — |
| 23 | state.messages 反馈下一轮 | `query.ts:1635/1766 messages: [...messagesForQuery, ...assistantMessages, ...toolResults]` | 没有 | multi-turn 不可能 |
| 24 | 取消信号 → 停 loop | `query.ts:abortController.signal` | 部分处理 | — |
| 25 | 错误包成 tool_result `is_error: true`（不抛回 loop） | `StreamingToolExecutor.ts:99-102` | 没有 ToolDispatcher | tool 抛错会冲垮整个会话 |

### 2.4 ToolUseContext 注入层

| # | 缺失项 | 证据 | engine 现状 | 影响 |
|---|---|---|---|---|
| 26 | `ToolUseContext` 真实构造（abortController / agentId / options.tools 等） | `query.ts:queryLoop params.toolUseContext` | 类型存在、不被构造 | tools 调用时拿不到上下文 |
| 27 | `canUseTool` permission delegate 注入 | `query.ts:canUseTool` | 类型存在、`hasPermissionsToUseTool` 直接 allow | 权限模型废弃 |
| 28 | per-session SessionContext / cwd 注入 | `DefaultCCRuntime.runWithCwd` | `void cwd` (no-op) | cwd 不切换、多 workspace 并发不安全 |

### 2.5 Phase B 工具的实战风险

Phase B 的 11 个 kernel tools（TodoWrite / TaskCreate / ToolSearch / DiscoverSkills / MemoryWrite 等）要工作，需要 #20 (ToolDispatcher) + #14 (tools 字段传给 API) + #3/#6 (tool_use SSE 累积) + #22 (tool_result 反馈) 全部到位。**目前一个都没有**，所以 Phase B 工具虽然单测通过 218 个，但**集成路径根本走不通**。

---

## 3. 边界判定：什么属于 engine，什么属于 product

按用户已对齐的边界（"通用 Agent 核心 vs Product UX"），逐项判定：

### 3.1 Core（必须搬到 engine，最小干净版）

| 项 | 为什么是 core |
|---|---|
| **SSE 事件解析**（10 种事件全套） | 任何 LLM Provider 调用都必须解析流式事件，是 substrate 最底层 |
| **content_block 累积器**（text / tool_use / thinking） | tool_use input 是流式 JSON，必须有累积逻辑 |
| **AssistantMessage 构造与 emit** | assistant 输出的标准格式 |
| **Multi-turn while loop**（直到 stop_reason 不是 tool_use） | agent loop 的第一性，不能丢 |
| **ToolDispatcher**（接 ToolRegistry + 调 call() + 错误转 tool_result is_error） | 行动能力的 substrate |
| **tool_result → next user message 反馈** | multi-turn 闭环，不能丢 |
| **ToolUseContext 构造**（abortController + agentId + tools + permissions） | 工具运行时上下文 |
| **取消信号传播**（loop / fetch / tool 都要响应） | 模型可能跑飞，必须能立即叫停 |
| **token usage 累计**（input/output/cache_read/cache_creation） | 任何 agent runtime 都需要计 token，是基础信号 |
| **错误标准化**（tool 错 → tool_result is_error；API 错 → 上抛 + 上层决策） | substrate 的"暴露错误而不代偿"原则 |
| **MessageParam 序列化**（user/assistant/tool_use/tool_result block 正确编码发给 API） | 不正确编码就拿不到 multi-turn |

### 3.2 Product（不搬，留在 product）

| 项 | 为什么不是 core |
|---|---|
| Langfuse 追踪埋点 | 业务可观测性，不是 substrate |
| Analytics（tengu_streaming_*） | 业务指标 |
| Growthbook feature flags | A/B 实验，product 决策面 |
| VCR（withStreamingVCR） | 录制回放工具，与 substrate 解耦 |
| Advisor model（subagent 模型） | product 高级特性 |
| Cached microcompact | 优化策略，可在上层包 |
| Auto-compact / token budget | 省钱策略，product 决策 |
| Snip / history pruning | 上下文管理策略，product 决策 |
| Skill prefetch | 性能优化，product 决策 |
| QueryTracking（chainId / depth） | 业务追踪，product 维度 |
| Circuit breaker | 稳定性策略，可作为 hook 注入 |
| Streaming idle watchdog（90s 超时） | 性能策略，可作为 hook 注入 |
| LSP defer | LSP product 特性 |
| Off-switch（feature gates） | product 控制 |
| Global cache scope 配置 | product 设置 |
| Stop hook / pre-tool hook 业务实现 | hook 由 product 注入；engine 提供 hook 点 |
| `withRetry` / `getNonstreamingFallbackTimeoutMs` | product 重试策略，engine 给 hook |

### 3.3 Hybrid（engine 给抽象，product 给实现）

| 项 | engine 侧 | product 侧 |
|---|---|---|
| **Provider client 创建** | `ProviderAdapter.query()` 接口 + 默认 Anthropic 实现 | 注入 `getAnthropicClient` 时可换成 product 的（带 fetchOverride） |
| **Tool permission** | `canUseTool: (tool, input, ctx) => Result` 接口 + 默认 allow-all | product 实现 ask-user / ask-policy |
| **Hook 点**（pre-tool / post-tool / stream-start / stream-end） | engine 提供 emit + 串行调用 | product 注入业务 hook |
| **Prompt caching** | engine 暴露 `cache_control` API | product 决策何时打 cache breakpoint |
| **System prompt** | engine 接受 `string \| {text, cache_control}[]` | product 构造 identity / agents / tool docs |

---

## 4. 修复路径：在 engine 长出最小干净 agent loop

### 4.1 设计第一性原理

> **harness 的本质**：完美模型 100% 跑通 + 弱模型时兜住暴露错误 + 给模型多次犯错的机会。
> Engine 是 substrate（基底），不是 supervisor（监督者）。

具体表达：

1. **暴露错误，不代偿**：tool 抛错 → 包成 `tool_result is_error: true` 发回模型，让模型自己重试或选别的工具；API 抛错 → 直接上抛，让 product 决策（重试 / fallback / 给用户）。
2. **给模型工具，不替模型决策**：engine 不做 autocompact、不做 microcompact、不做 token budget，这些是 product 决策；engine 只忠实地把 messages 发给 API、忠实地把 tool_result 装回去。
3. **per-session 隔离**：所有状态都在 SessionContext 里，不再走全局。
4. **可注入而非内置**：retry / VCR / langfuse / circuit breaker 都通过 hook 注入，engine 自己只跑骨架。
5. **失败要响**，不要静默 fallback。比如 a9a894e 的 `boundary check` 就是因为 `rg` 缺失静默 passed —— substrate 必须把这种 fail-open 都改成 fail-loud。

### 4.2 目标代码体量

不抄 product 那 3490 + 1779 = 5269 行（含巨量 product-specific 关注点）。目标：

| 模块 | 预估行数 | 内容 |
|---|---|---|
| `engine/agent-loop/SSEParser.ts` | ~250 | 10 种 SSE 事件分发 + content_block 累积器 |
| `engine/agent-loop/MessageSerializer.ts` | ~120 | Message ↔ MessageParam（含 tool_use / tool_result block） |
| `engine/agent-loop/ToolDispatcher.ts` | ~150 | 串行 + 并发执行 + tool_result 生成 + 错误包装 |
| `engine/agent-loop/AgentLoop.ts` | ~200 | while(true) + stop_reason 判定 + tool_result 反馈 |
| `engine/agent-loop/ToolUseContext.ts` | ~80 | 上下文构造 + 注入 |
| `engine/agent-loop/UsageTracker.ts` | ~80 | input/output/cache token 累计 |
| `engine/agent-loop/HookSurface.ts` | ~80 | pre-stream / post-tool / on-error hook 注入点 |
| `engine/provider/adapters/AnthropicProvider.ts` 改写 | ~150 | 用 SDK + 调 SSEParser + 通过 ProviderAdapter 接口暴露 |
| 单测 | ~500 | 每个模块测 happy path + edge case |
| **合计** | **~1610 行** | 不到 product 5269 行的 1/3 |

### 4.3 修复 Batch 划分

#### Batch 7：SSE 解析骨架 + content_block 累积（独立可测）

**新增**：

- `neptune-engine/src/engine/agent-loop/types.ts` — SSE 事件 / content block / 累积器 类型
- `neptune-engine/src/engine/agent-loop/SSEParser.ts` — 10 种事件分发 + 累积器
- `neptune-engine/src/engine/agent-loop/__tests__/SSEParser.test.ts` — 用 fixture SSE 流测每种事件

**验收**：

- `bunx tsc --noEmit` 0 错
- SSEParser 单测覆盖：text_delta / tool_use input_json_delta / thinking_delta / message_start/delta/stop / content_block_start/stop（不少于 15 个测试）
- 不动 HeadlessQueryEngine（保留作为 fallback）

#### Batch 8：MessageSerializer + Provider 接入 SSEParser

**新增**：

- `neptune-engine/src/engine/agent-loop/MessageSerializer.ts` — UserMessage/AssistantMessage ↔ MessageParam
- 改写 `AnthropicProvider.query()`：直接调 Anthropic SDK，stream 进 SSEParser，emit AssistantMessage

**验收**：

- ProviderAdapter 集成测试：能完整收到一条 assistant message（含 tool_use block）
- 不动 multi-turn loop（先单轮）

#### Batch 9：ToolDispatcher + ToolUseContext

**新增**：

- `neptune-engine/src/engine/agent-loop/ToolDispatcher.ts` — 接 ToolRegistry，串行执行，错误包成 tool_result is_error
- `neptune-engine/src/engine/agent-loop/ToolUseContext.ts` — 默认上下文工厂

**验收**：

- 单测：mock tool 抛错 → tool_result 是 is_error: true
- 单测：mock tool 返字符串 → tool_result content 正确

#### Batch 10：AgentLoop multi-turn while

**新增**：

- `neptune-engine/src/engine/agent-loop/AgentLoop.ts` — while(true) + stop_reason 判定 + tool_result 反馈
- 替换 HeadlessQueryEngine 内部实现（调 AgentLoop）

**验收**：

- 集成测试：用 ScriptedProvider（fake API）模拟 "tool_use → tool_result → end_turn" 一个完整 turn
- Phase B 11 个 kernel tools 之一（TodoWrite）能跑通端到端

#### Batch 11：UsageTracker + Hook 接入

**新增**：

- `neptune-engine/src/engine/agent-loop/UsageTracker.ts`
- `engine/agent-loop/HookSurface.ts`
- AgentLoop 集成 hooks

**验收**：

- token usage 在每个 turn 后累计、暴露给上层
- hook 调用顺序正确（pre-stream → emit text → emit tool_use → pre-tool → tool 执行 → post-tool → post-stream）

#### Batch 12（可选）：取消、错误、清理硬化

**内容**：

- AbortSignal 全链路传播（API fetch / tool 执行 / loop）
- API 错误标准化（429 / 500 / network error 各种类）
- streaming_idle 检测（作为 hook 注入接口，engine 不内置 90s 默认值）

**验收**：

- 单测：abort during stream → 资源被清理、不残留
- 单测：abort during tool exec → tool_result is_error: 'aborted'

### 4.4 不在本计划内的事项（明确拒绝）

- ❌ 不抄 langfuse / analytics / growthbook
- ❌ 不抄 VCR
- ❌ 不抄 advisor model
- ❌ 不抄 microcompact / autocompact
- ❌ 不抄 token budget / snip
- ❌ 不抄 circuit breaker（暴露 hook 给 product）
- ❌ 不抄 stop_hook 业务实现（暴露 hook 接口）
- ❌ 不动 product 层（product 编不过不修，是备份）

### 4.5 节奏与验证三件套

每个 batch 闭环：

```bash
bash neptune-engine/scripts/verify-runtime-boundaries.sh    # boundary 0 反向依赖
cd neptune-engine && bunx tsc --noEmit --pretty false       # engine kernel 0 错
cd neptune-engine && bun test src/engine                    # 不回归现有 218 测试
```

每个 batch commit + ff 合入 develop。

---

## 5. 验收标准（Phase C 完成定义）

完成后必须满足：

1. ✅ Engine 不依赖 product 层（boundary 脚本通过）
2. ✅ 7 个 Provider adapter 中至少 AnthropicProvider 完整可用（其他 Provider 可暂留 unsupported）
3. ✅ 能跑通 "system prompt + tools + user message" → 模型 emit tool_use → engine 执行 → emit tool_result → 模型 emit end_turn 的完整 turn
4. ✅ Phase B 的 11 个 kernel tools 中至少 TodoWrite + TaskCreate + ToolSearch 能端到端跑通
5. ✅ token usage 正确累计到 SessionContext
6. ✅ 取消信号能在 100ms 内停止流 + 停止当前 tool 执行
7. ✅ tool 抛错 → 包成 tool_result is_error，不冲垮 loop
8. ✅ 单测 + 集成测试不少于 50 个新增测试
9. ✅ 不回归现有 218 个测试

---

## 6. 风险与权衡

| 风险 | 缓解 |
|---|---|
| SSE 协议未来变化（thinking 2.0 / extended thinking） | engine 只解析当前 stable spec，新事件由 hook 注入扩展 |
| Provider SDK 升级破坏 stream 类型 | engine 内部用自定义 SSE 类型，与 SDK 解耦 |
| 用户 product 已经依赖 langfuse 等 product-specific 行为 | product 不动，product 层重新长一层 wrapper 调 engine |
| Phase B kernel tools 依赖的 KernelToolContext 接口 | 在 ToolUseContext 里把 kernel-protocol（SkillRegistry/TodoState 等）作为字段透传 |

---

## 7. 我需要你拍板的事

1. **Batch 7-12 的拆分粒度可不可以**？要不要并成更大批次？
2. **`AnthropicProvider` 是直接用 `@anthropic-ai/sdk`，还是手写 fetch + 自定义重试**？前者快、稳；后者控制力强但写更多代码。
3. **Hook 接口要不要在 Batch 11 引入，还是延后到 Phase D**？早引入会让前 4 个 batch 接口设计更复杂；延后则需要 Batch 7-10 之后再做一次集中重构。
4. **取消语义**：tool 执行中途收到 abort 时，是把当前 tool_use 的 tool_result 标记 `is_error: 'aborted'` 发回模型让模型自己处理，还是直接退出 loop？前者更"给模型机会"，后者更干脆。

审完这份文档、拍板上面 4 个问题后，我开 Batch 7 落地代码。
