# Agent Loop Rebuild — 整体设计

> **从总规划到具体接口、模块结构、数据流的设计**
> **配套**：[00-plan.md](./00-plan.md), [02-tasks.md](./02-tasks.md), [03-oracle-verification.md](./03-oracle-verification.md)

---

## 1. 模块布局（engine 内部）

```
neptune-engine/src/engine/
├── agent-loop/                         # 新增：agent loop 核心
│   ├── types.ts                        # 公共类型
│   ├── sse/
│   │   ├── SSEParser.ts                # 10 种事件分发 + 累积器
│   │   ├── ContentBlockAccumulator.ts  # text / tool_use / thinking / connector_text
│   │   └── __tests__/
│   ├── message/
│   │   ├── MessageSerializer.ts        # Message ↔ MessageParam
│   │   ├── ContentBlockNormalizer.ts   # stripGeminiProviderMetadata 等
│   │   └── __tests__/
│   ├── dispatcher/
│   │   ├── ToolDispatcher.ts           # 串行执行（M1）
│   │   ├── StreamingToolExecutor.ts    # 并发执行（后置到 M2 末或 M3）
│   │   ├── ToolUseContext.ts           # 上下文工厂
│   │   └── __tests__/
│   ├── loop/
│   │   ├── AgentLoop.ts                # while(true) + stop_reason 状态机
│   │   ├── StopReasonHandler.ts        # 4 种 stop_reason 分支
│   │   └── __tests__/
│   ├── usage/
│   │   ├── UsageTracker.ts             # 4 档 token + cost
│   │   └── __tests__/
│   ├── hook/
│   │   ├── HookSurface.ts              # pre/post-stream/tool 注入点
│   │   ├── HookRegistry.ts             # per-session 注册
│   │   └── __tests__/
│   ├── cancellation/
│   │   ├── CancellationToken.ts        # 全链路 abort 协调
│   │   └── __tests__/
│   ├── retry/                          # M2
│   │   ├── RetryPolicy.ts              # 接口
│   │   ├── DefaultRetryPolicy.ts       # 指数退避 + 错误分类
│   │   ├── ErrorClassifier.ts          # 429/529/network/auth 分类
│   │   └── __tests__/
│   ├── fallback/                       # M2
│   │   ├── NonStreamingFallback.ts     # 流式撞墙切非流
│   │   ├── ModelFallback.ts            # 主模型挂切备用
│   │   └── __tests__/
│   ├── watchdog/                       # M2
│   │   ├── StreamWatchdog.ts           # 90s idle abort
│   │   ├── StallDetector.ts            # 30s 警告
│   │   └── __tests__/
│   ├── caching/                        # M3
│   │   ├── CacheControlPolicy.ts       # 接口
│   │   ├── DefaultCachePolicy.ts       # 末块打 cache
│   │   ├── BreakpointPlanner.ts        # addCacheBreakpoints 算法
│   │   └── __tests__/
│   ├── compaction/                     # M3
│   │   ├── CompactionPolicy.ts         # 接口
│   │   ├── MicroCompaction.ts          # 默认：tool_result 按 id 替换
│   │   └── __tests__/
│   └── budget/                         # M3
│       ├── BudgetTracker.ts            # 接口
│       ├── DefaultBudget.ts            # 默认 200k turn budget
│       ├── CircuitBreaker.ts           # 5 次失败 30 秒冷却
│       └── __tests__/
├── provider/
│   └── adapters/
│       └── AnthropicProvider.ts        # Batch 8 改写：用 SDK + SSEParser
└── cc-runtime/
    └── HeadlessQueryEngine.ts          # Batch 10 替换内部为 AgentLoop
```

## 2. 数据流（M1 完成后的端到端）

```
SessionContext / KernelToolContext (Phase A 已就位)
     │
     ▼
HeadlessQueryEngine.submitMessage(input)
     │
     ▼
AgentLoop.run({ messages, systemPrompt, tools, signal, hooks, providers })
     │
     │── while (stopReason !== 'end_turn') {
     │
     │  ┌─ MessageSerializer.toRequestParams(messages, tools, system, cache_control)
     │  │
     │  ▼
     │  AnthropicProvider.query(params)   ◄── 注入 SDK client、retry policy
     │     │
     │     ▼
     │  SDK 返回 Stream<RawMessageStreamEvent>
     │     │
     │     ▼
     │  SSEParser.consume(stream) ──► AsyncGenerator<ParsedEvent>
     │     │  emit:
     │     │   - 'message_start'
     │     │   - 'content_block_complete' (text / tool_use / thinking)
     │     │   - 'message_delta' (stop_reason / usage)
     │     │   - 'message_stop'
     │     │
     │     ▼
     │  AgentLoop 收集 contentBlocks → 构造 AssistantMessage → push messages
     │     │
     │     ▼
     │  HookSurface.runPostStreamHooks(assistantMessage)
     │     │
     │     ▼
     │  StopReasonHandler.handle(stop_reason):
     │     │── 'end_turn'   → break loop
     │     │── 'tool_use'   → ToolDispatcher.execute(toolUseBlocks, ctx)
     │     │                    → 每个 tool 跑完 emit tool_result block
     │     │                    → 包成 user message → push messages
     │     │── 'max_tokens' → 触发 maxOutputTokens recovery（M2/M3）
     │     │── 'pause_turn' → break + 标记可恢复
     │     │
     │     ▼
     │  UsageTracker.accumulate(usage, model)
     │     │
     │  } // while
     │
     ▼
yield 'result' { is_error, result }
```

## 3. 核心类型

### 3.1 ParsedSSEEvent（SSE 解析层输出）

```typescript
type ParsedSSEEvent =
  | { type: 'message_start'; message: PartialAssistantMessage; usage: Usage }
  | { type: 'content_block_complete'; index: number; block: CompleteContentBlock }
  | { type: 'message_delta'; usage: Usage; stop_reason: StopReason }
  | { type: 'message_stop' }
  | { type: 'error'; error: Error }
```

不暴露内部累积过程的 delta，只暴露完整边界（block 完成时整块 emit）。这样上层不需要重写累积逻辑。

### 3.2 CompleteContentBlock

```typescript
type CompleteContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: object }   // input_json_delta 已累积
  | { type: 'thinking'; thinking: string; signature: string }       // signature 必须保留
```

### 3.3 ToolUseContext

```typescript
interface ToolUseContext {
  abortController: AbortController
  agentId?: AgentId
  options: {
    tools: Tool[]
    isNonInteractiveSession: boolean
    thinkingConfig: ThinkingConfig
  }
  permissions: {
    canUseTool: CanUseToolFn
  }
  // Phase A protocols 透传（让 kernel tools 拿到）
  kernel: {
    skillRegistry: SkillRegistry
    todoState: TodoState
    taskQueue: TaskQueue
    toolRegistry: ToolRegistry
    memory: MemoryStore
  }
  // Hooks
  hooks: HookSurface
}
```

### 3.4 HookSurface

```typescript
interface HookSurface {
  preStream?: (params: RequestParams) => Promise<RequestParams>
  postStream?: (msg: AssistantMessage) => Promise<void>
  preTool?: (toolUse: ToolUseBlock, ctx: ToolUseContext) => Promise<{ allow: boolean; reason?: string }>
  postTool?: (toolResult: ToolResultBlock) => Promise<void>
  onError?: (error: Error, phase: 'stream' | 'tool' | 'serialization') => Promise<void>
}
```

### 3.5 RetryPolicy / CompactionPolicy / BudgetTracker（M2/M3）

```typescript
interface RetryPolicy {
  shouldRetry(error: Error, attempt: number, context: RetryContext): RetryDecision
  delayMs(attempt: number): number
}

interface CompactionPolicy {
  shouldCompact(messages: Message[], usage: Usage): boolean
  compact(messages: Message[]): Promise<{ messages: Message[]; tokensFreed: number }>
}

interface BudgetTracker {
  recordUsage(usage: Usage): void
  shouldStop(): boolean
  remaining(): number | undefined
}
```

## 4. 接口契约

### 4.1 ProviderAdapter（已存在，会扩展）

```typescript
interface ProviderAdapter {
  readonly type: string
  query(params: ProviderQueryParams): AsyncGenerator<ParsedSSEEvent>  // ← 改成发 ParsedSSEEvent 不再发 ProviderMessage
  // M2 新增：
  client(): unknown   // SDK 客户端实例（注入用）
}
```

### 4.2 AgentLoop（核心入口）

```typescript
interface AgentLoopParams {
  messages: Message[]
  systemPrompt: SystemPrompt
  tools: Tool[]
  signal: AbortSignal
  context: ToolUseContext
  provider: ProviderAdapter
  hooks?: HookSurface
  // M2/M3 可选 policy 注入
  retry?: RetryPolicy
  compaction?: CompactionPolicy
  budget?: BudgetTracker
  cache?: CacheControlPolicy
}

class AgentLoop {
  async *run(params: AgentLoopParams): AsyncGenerator<LoopEvent, LoopResult>
}
```

`LoopEvent` 是 yield 给上层的事件（assistant message / tool update / progress / error），`LoopResult` 是 loop 终止时的最终状态（reason / total usage / final messages）。

## 5. 与 Phase A / Phase B 的对接

### 5.1 Phase A（Skill / Todo / TaskQueue / ToolRegistry / Memory）

通过 `ToolUseContext.kernel` 字段传给所有工具。Phase A 的 5 个 protocol 不动，作为 substrate 的"agent 能力底座"。

### 5.2 Phase B（11 个 kernel tools）

通过 `kernel-context.ts` 的 `requireProtocol` helper 从 `ToolUseContext.kernel` 拿到对应 protocol。Batch 9 的 `ToolDispatcher` 必须正确把 `kernel` 字段透传给每个 tool 的 `call()`。

Batch 10 完成后，至少 `TodoWrite` / `TaskCreate` / `ToolSearch` 三个 kernel tool 能跑通端到端 demo（用 ScriptedProvider mock）。

## 6. 关键设计决策

### 6.1 SSE 边界：emit 完整 block，不暴露 delta

**为什么**：上层（AgentLoop）只关心完整 block，不关心累积过程。在 SSEParser 内部累积、对外只 emit 完整 block，可以让上层代码简洁很多，也更容易测。

**代价**：丢掉了"流式 UI"能力（用户看不到逐字打字）。

**对策**：HookSurface 上加一个 `onStreamingDelta` hook（默认 no-op），需要流式 UI 的 product 自己注册。

### 6.2 串行 ToolDispatcher 优先，并发延后

**为什么**：cc 的 StreamingToolExecutor 366 行有大量 corner case（比如 fallback 时的 discard 重建）。先做串行版稳定 multi-turn loop，并发版后置到 M2 末或 M3。

**代价**：M1 跑多 tool_use 会变慢（必须串行等）。

**对策**：M1 demo 只跑单 tool_use 流；并发版独立 batch 做。

### 6.3 用 `@anthropic-ai/sdk` 而不是手写 fetch

**为什么**：cc 那 5269 行里大量是绕开 SDK 的 corner case 处理（partialParse 性能问题、客户端 ID header 等）。如果手写 fetch，要重新踩这些坑。SDK 提供 stream / retry / timeout / 错误标准化，省下大量代码。

**代价**：依赖 SDK 类型，升级时可能要适配。

**对策**：在 `provider/adapters/AnthropicProvider.ts` 内部用 SDK，对外用 engine 自定义类型。SDK 类型不外泄。

### 6.4 RetryPolicy 是默认实现 + 可注入接口（不是全局配置）

**为什么**：retry 是 substrate 必须能力，但具体策略是 product 决策（开发环境激进重试、生产环境保守）。给接口 + 默认实现，product 可以替换。

**代价**：接口有学习成本。

**对策**：默认 policy 在 95% 场景够用（指数退避 + 5 次上限）。

### 6.5 不内置 langfuse / analytics

**为什么**：第一性原理"暴露错误，不代偿"+ "engine 不感知业务"。analytics 是业务关注点。

**对策**：HookSurface 上 `onError` / `postStream` / `postTool` 都暴露，product 自己接 langfuse。

## 7. 设计上的 Open Question（写代码时回头答）

1. **`pause_turn` 处理**：cc 用它来支持 sleep+resume 长任务。M1 是否要支持？我倾向先 break + 留状态，M3 再补 resume。
2. **Connector text**：cc 有 `feature('CONNECTOR_TEXT')` 分支处理 connector_text_delta。这是 cc 内部业务（advisor），engine 不要。直接忽略。
3. **`tombstone` message**：cc 在 fallback 时用 tombstone 撤回旧 thinking 块。M2 做 fallback 时一起做。
4. **fast mode / effortValue**：cc 的延迟模式选项，product 决策。Engine 在 RequestParams 留字段透传，不内置。

## 8. 验收 = M1 完成定义

完成 Batch 7-11 后必须满足：

1. ✅ AnthropicProvider 能跑通：systemPrompt + tools + user message → emit assistant message（含 tool_use）
2. ✅ AgentLoop 能跑通完整一轮：tool_use → ToolDispatcher → tool_result → next turn → end_turn
3. ✅ 至少 3 个 Phase B kernel tools 在 e2e 测试中工作（TodoWrite / TaskCreate / ToolSearch）
4. ✅ 取消信号能在 100ms 内停止 stream + 停止 in-flight tool
5. ✅ 现有 218 个测试不回归
6. ✅ 新增至少 60 个测试（每个 batch 平均 12 个）
7. ✅ Oracle 验证：SSE 解析、message 序列化、错误分类，与 cc 行为一致
