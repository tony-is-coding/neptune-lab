# neptune-engine v6.0 — Anthropic-Native Agent Runtime Kernel SDK

> **One-liner**：以 Anthropic Messages 协议作为 lingua franca 的 agent runtime kernel。一刀切清理双轨制后，substrate 表面更小、协议更纯、扩展点更直接。

> **Status**：v6.0 ✅ 完成（2026-05-26）— 单一查询路径 / 单一 Provider 接口 / 字段重构 / 跨 repo 死代码删除 ~2200 行
> **守门**：substrate v2 **42/42 PASS**（含 10 项 functional substrate + examples scripted smoke）· v1 守门 **11/11 PASS**
> **测试**：engine **1306 pass / 0 fail**（v6.0 P0.5.D exports 白名单后基线）· substrate tsc 0 errors
> **文件规模**：193 源文件 / 95 测试文件（v5.0 → v6.0 净删除 ~38 文件 / 死代码 ~2200 行）

---

## 0. TL;DR — 5 句话理解 v6.0 与 v5.0 的关键差异

1. **协议中心化**：v5.0 的「双轨制」（旧 ProviderAdapter + 新 StreamingProviderAdapter）一刀切删除，substrate 现在唯一对外协议是 `StreamingProviderAdapter`，唯一具体实现是 `AnthropicStreamingProvider`，唯一支持的 wire format 是 Anthropic Messages API（含 SSE）。
2. **配置表面更小**：`AgentEngineConfig` 删除了 3 个无效字段（`useAgentLoop` / `provider` / `providerRegistry` / `circuitBreaker`），新增 1 个直接字段（`defaultModel`），表达力 0 损失，迷惑性 API 全部清除。
3. **多 Provider 通过 Anthropic 兼容层支持**：substrate 不识别 vendor 名，只识别 Anthropic Messages/SSE compatible endpoint。Provider 端负责协议兼容，调用方只通过 `AUTH_MODE` / `API_KEY|AUTH_TOKEN` / `BASE_URL+MODEL` 三类正交配置接入。
4. **substrate 唯一查询路径**：`AgentEngine.query → AgentLoop.runWithStore + AgentLoopBridge → SDK QueryEvent`。原 cc-runtime fallback 路径（HeadlessQueryEngine）和 OriginalQueryEngineBridge 全部删除。16 batch agent-loop 能力（retry/fallback/watchdog/caching/compaction/budget/governance/audit/runStore/sandbox）默认上线，无需切换。
5. **examples 双模式 + vendor-neutral smoke 脚本**：sdk-pure / sdk-with-fs-store / sdk-with-server 三件套统一支持 `USE_SCRIPTED_PROVIDER=true`（CI 友好，0 API 消耗）+ 真 API（显式 env 配置任意 anthropic-compatible endpoint）。

---

## 1. 设计哲学（v6.0 的第一性原理）

### 1.1 为什么以 Anthropic 协议作为 lingua franca

substrate 是一个 **Agent Runtime Kernel**——它需要消费 LLM 的流式输出、调度工具、维护多轮上下文。这套调度逻辑天然依赖一个 **wire format**。

候选 wire format：

| 协议 | 含 content blocks | 含 tool_use / tool_result 块 | SSE 事件类型化 | substrate 现状 |
|------|-------------------|--------------------------------|----------------|---------------|
| Anthropic Messages | ✅ | ✅ | ✅ message_start / content_block_delta / message_stop 等 | 原生支持 |
| OpenAI Chat Completions | ❌ string + 单独 tool_calls | ❌ 独立 role: 'tool' message | ❌ 单一 chat.completion.chunk + delta | 需翻译层 |

**事实层判断**：Anthropic 协议本身就是为 agent loop 设计的（content blocks / tool_use / thinking blocks 都是天然的 agent 原语）。OpenAI 协议虽然市场份额大，但需要在 substrate 上加一层翻译，引入额外的状态机（tool_calls 增量字符串累积 / SSE 事件重组）。

**生态层事实**：多个官方 provider、第三方网关、本地协议转换代理都在主动提供 Anthropic-compatible endpoint。市场已经在用脚投票把 Anthropic 协议作为「**事实标准**」往 OpenAI 旁边推。

**v6.0 决策**：substrate 押注 Anthropic 协议作为 lingua franca。第三方 provider 想接入 substrate，就在自己的 endpoint 实现 Anthropic-compatible 即可。我们不在 substrate 内做反向翻译。

### 1.2 为什么删双轨

v5.0 的状态：
- `useAgentLoop=false`（默认）→ `ccRuntime.createQueryEngine` → HeadlessQueryEngine（200 行单轮 stub）
- `useAgentLoop=true` → AgentLoop.runWithStore + AgentLoopBridge（substrate 真实路径）

事实上：
- HeadlessQueryEngine 是单轮 fallback，不支持 multi-turn / tool-call / 任何 16 batch 能力
- v5.0 的所有真实功能都靠 `useAgentLoop=true`
- 双轨制的存在让用户困惑「我到底该选哪条」

v6.0 砍掉 false 分支：唯一路径是 substrate AgentLoop。删除 200 行 HeadlessQueryEngine + ~250 行 useAgentLoop 双轨分支 + ~700 行 OriginalQueryEngineBridge。

### 1.3 为什么删旧 provider 双轨（含 product 6 个 provider stub）

事实层：
- substrate `provider/adapters/AnthropicProvider.ts` 的 `query()` 整段是 `yield this.unsupportedProductRuntimeProvider()`（永远报错的 stub）
- substrate `provider/adapters/BaseProvider.ts` 提供的 CircuitBreaker / classifyError / executeWithRetry 已被 `agent-loop/budget/CircuitBreaker.ts` + `agent-loop/retry/RetryingProvider.ts` 全量替代
- product 端 `cc-tools/provider/{OpenAI,Bedrock,Vertex,Gemini,Grok,Foundry}Provider.ts` 6 个文件，**全部 query() 只 yield unsupportedProductRuntimeProvider()**——一行真业务都没有

死代码的存在让人误以为 substrate 支持多 provider。v6.0 一刀切：substrate 删除 ~990 行 + product 删除 ~1200 行 = 共 ~2200 行死代码。

---

## 2. 能力矩阵（v6.0 具备什么）

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         Harness Kernel v6.0                                    │
│                                                                                │
│  [1] Agent Loop（思考闭环）⭐ 唯一路径    [2] Tool Dispatch（行动）             │
│      ✅ Multi-turn + SSE stream            ✅ Permission + Sandbox 双层护栏     │
│      ✅ Retry/Fallback/Watchdog (默认)     ✅ canUseTool / preTool hook 拦截    │
│      ✅ Caching/Compaction/Budget          ✅ 一轮多 tool_use 并发派发          │
│      ✅ AgentEngine.query 唯一走 AgentLoop ✅ functional substrate 守门覆盖     │
│         (v6.0 双轨删除)                                                         │
│                                                                                │
│  [3] Sub-Agent Spawning                  [4] Agent Teams（多 agent 协作）       │
│      ✅ AgentTool（22 契约 13 已落）      ✅ TeammateChannel + InMemory         │
│      ✅ AgentRegistry + 4 baseline         ✅ TeammateBackend 接口              │
│      ✅ depth 限制 / 三类错误处理           ✅ SendMessageTool 走 substrate      │
│      ✅ async background ⭐                 ✅ mailbox/broadcast/shutdown/      │
│      ✅ cross-instance resume ⭐              plan_approval 4 类                 │
│                                                                                │
│  [5] Skill 启动                          [6] Memory（记忆）                     │
│      ✅ SkillTool 薄壳                    ✅ InMemoryMemoryStore                │
│      ✅ SkillRegistry + Manifest           ✅ AgentScopedMemoryStore（三 scope）│
│      ✅ DiscoverSkillsTool 协议联动         ✅ FilesystemAgentScopedMemoryStore │
│                                                + snapshot 同步                  │
│                                                                                │
│  [7] Planning（Todo + TaskQueue）          [8] Tool Discovery                   │
│      ✅ InMemoryTodoState                  ✅ ToolRegistry + 关键词搜索         │
│      ✅ InMemoryTaskQueue                   ✅ ToolSearchTool                   │
│         （多 agent 共享任务队列）            ✅ DiscoverSkillsTool              │
│                                                                                │
│  [9] Provider Routing ⭐ v6.0 简化         [10] Permission / Sandbox            │
│      ✅ Anthropic（唯一具体 provider）     ✅ PermissionMode 5×5 矩阵           │
│      ✅ AnthropicStreamingProvider          ✅ SandboxAdapter 协议               │
│      ✅ anthropic-compat endpoint 实证      ✅ LocalSandbox 24 case 决策         │
│      ✅ Retry/Fallback/Watchdog 包装                                            │
│      ❌ 删除：旧 ProviderAdapter / Registry / 6 product stub                    │
│                                                                                │
│  [11] Hook Surface                       [12] Governance Hooks                  │
│      ✅ 5 事件 hook                        ✅ PolicyHook (allow/deny/review)    │
│         (preStream/postStream/             ✅ HumanReviewHook (挂起人工)        │
│          preTool/postTool/onError)          ✅ EvalHook (Run 完成评估)          │
│                                            ✅ ArtifactHook (落证据)             │
│                                                                                │
│  [13] State Externalization              [14] Observability / Audit             │
│      ✅ Run/RunStore + jsonl events       ✅ ITracingProvider (OTel-compat)     │
│      ✅ Checkpoint per turn                ✅ IMetricsProvider                  │
│      ✅ 跨实例 resume + cleanup             ✅ Audit hash chain（4 类篡改可证） │
│         filter（cleanupForResume）          ✅ FilesystemAuditStore              │
│      ✅ AgentEngine.runId=sessionId                                              │
│                                                                                │
│  ⭐ v6.0 协议表面：                                                              │
│     - 唯一 Provider 接口：StreamingProviderAdapter (queryStream → ParsedSSEEvent)│
│     - 唯一 Provider 实现：AnthropicStreamingProvider（覆盖任意 Anthropic         │
│       Messages/SSE compatible endpoint）                                        │
│     - 唯一查询路径：AgentEngine.query → runQueryViaAgentLoop → AgentLoop        │
└────────────────────────────────────────────────────────────────────────────────┘

完成度：14/14 ✅
功能契约：AgentTool 22 项 → 13 项已落（v5.0 同集，v6.0 未新增）
```

---

## 3. 模块全景（193 源文件 / 95 测试 / 18 个核心模块）

### 3.1 顶层模块清单

```
neptune-engine/src/engine/
├── agent-loop/                    ── 思考 + 行动闭环（v1.0 16 batch + v5.0/v6.0 唯一路径）
│   ├── loop/AgentLoop.ts           完整 multi-turn 主循环（runWithStore + resume）
│   ├── sse/                        Anthropic SSE 流解析（SSEParser + ParsedSSEEvent）
│   ├── message/                    Message 序列化 / ContentBlock 规范化
│   ├── dispatcher/                 ToolDispatcher + ToolUseContext + PermissionMode
│   ├── provider/                   StreamingProviderAdapter + AnthropicStreamingProvider
│   ├── retry/ + fallback/          ErrorClassifier + RetryingProvider + ModelFallback
│   ├── watchdog/                   StreamWatchdog（idle / stall 检测）
│   ├── caching/                    CacheControlPolicy（prompt caching breakpoints）
│   ├── compaction/                 MicroCompaction（长会话不撞墙）
│   ├── budget/                     BudgetTracker + CircuitBreaker（与旧 CB 不同实现）
│   ├── usage/                      UsageTracker（per-turn token + cost）
│   ├── hook/                       HookSurface（5 事件）
│   └── cancellation/               AbortController 联动
├── agent-registry/                 ── AgentManifest + 4 baseline agents
├── audit/                          ── Audit hash chain（合规护城河）
├── bridge/                         ── runQueryViaAgentLoop + AgentLoopBridge + extensions
├── cc-runtime/                     ── DefaultCCRuntime（已大幅瘦身，无 createQueryEngine）
├── channel/                        ── 多 agent 通讯协议预留
├── compat/                         ── 非 Bun 环境 feature flag 兼容
├── config/                         ── UnifiedConfig + IConfigProvider
├── context/                        ── 上下文卸载策略
├── events/                         ── EventBus
├── governance/                     ── 4 类 hook (Policy/HumanReview/Eval/Artifact)
├── helpers/                        ── collectText / waitForResult 便捷方法
├── hooks/                          ── HookContext / HookExecutor
├── log/                            ── 日志系统
├── memory/                         ── KV memory + AgentScopedMemoryStore (三 scope)
├── observability/                  ── ITracingProvider / IMetricsProvider
├── permissions/                    ── PermissionDelegate (RBAC / Audit / ReadOnly)
├── provider/                       ── ⭐ v6.0 已瘦身：仅含 AnthropicProviderConfig 类型
├── run/                            ── Run / RunStore / Checkpoint / 跨实例 resume
├── sandbox/                        ── SandboxAdapter + LocalSandbox + NoOpSandbox
├── session/                        ── SessionContext + TokenBudgetState
├── skill/                          ── SkillRegistry + SkillExtension + SkillLoader
├── state/                          ── CoreAppState 工厂
├── storage/                        ── ISessionStore + Filesystem/InMemory backends
├── task-queue/                     ── TaskQueue（多 agent 共享）
├── teammate/                       ── TeammateChannel + TeammateBackend
├── todo/                           ── TodoState (per-Agent)
├── tool-registry/                  ── ToolRegistry + 关键词搜索
├── types/                          ── Message / Tool / QueryEvent / IDs
├── AgentEngine.ts                  ── 引擎入口
└── index.ts                        ── 公共 API 导出（106 项 export）
```

### 3.2 v6.0 删除的模块（与 v5.0 对比）

```
v5.0 → v6.0 删除：
  - cc-runtime/HeadlessQueryEngine.ts (200 行单轮 stub)
  - cc-runtime/CCRuntime.createQueryEngine 接口签名 + 所有实现
  - bridge/OriginalQueryEngineBridge.ts (~700 行 buildQueryEngineConfig 死路径)
  - bridge/__tests__/OriginalQueryEngineBridge.test.ts
  - provider/ProviderAdapter.ts (84 行旧接口)
  - provider/ProviderRegistry.ts (156 行旧注册表)
  - provider/adapters/AnthropicProvider.ts (125 行退化 stub)
  - provider/adapters/BaseProvider.ts (356 行旧抽象基类)
  - provider/CircuitBreaker.ts (旧 CB，已被 agent-loop/budget/CircuitBreaker 替代)
  - provider/types/BaseProviderConfig.ts
  - provider/types/ProviderConfigs.ts 中 6 个非-Anthropic 配置类型
  - bridge/runQueryViaAgentLoop.ts 内的双轨注释（清理）

跨 repo 删除（neptune-engine-product/）：
  - cc-tools/provider/{OpenAI,Bedrock,Vertex,Gemini,Grok,Foundry}Provider.ts (6 文件)
  - cc-tools/provider/__tests__/ 7 个测试文件
  - src/index.ts 13 行 re-export

总计：~38 文件 / ~3400 行（含跨 repo）
```

### 3.3 v6.0 新增

```
+ src/engine/bridge/extensions.ts （ToolExtension / PermissionConfig 独立位置）
+ scripts/smoke-real-api.sh （增强版含 HTTP/SSE e2e 验证）
+ scripts/smoke-scripted.sh （CI 用，进守门 D.10）
+ examples/__tests__/examples.smoke.test.ts （3 项 scripted smoke）
+ examples/_provider.ts （三个 example 共享 provider factory）
```

---

## 4. AgentEngineConfig 完整字段表（v6.0）

### 4.1 必填 / 推荐

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `streamingProvider` | `StreamingProviderAdapter` | **是**（运行时校验） | substrate 唯一 LLM 调用入口。常用：`new AnthropicStreamingProvider({apiKey, baseURL?, defaultModel?})` |
| `defaultModel` | `string` | 推荐 | 默认 model ID（如 `'provider-specific-model-id'`）。**substrate 不再硬编码任何默认值**，缺失时由 provider 自报错 |
| `systemPrompt` | `string \| () => Promise<string>` | 否 | 系统提示词。可同步传字符串或异步函数 |

### 4.2 协议注入（按需）

| 字段 | 类型 | 说明 |
|------|------|------|
| `runStore` | `RunStore` | 注入后启用 `runWithStore` + 跨实例 resume + checkpoint |
| `auditStore` | `AuditEventStore` | 注入后所有 LoopEvent 进 audit hash chain |
| `sandbox` | `SandboxAdapter` | 工具调用前置安全护栏（NoOpSandbox / LocalSandbox） |
| `governance` | `GovernanceHooks` | 4 类 hook（Policy / HumanReview / Eval / Artifact） |
| `agentRegistry` | `AgentRegistry` | 注入后 SubAgentTool / AgentTool 可查找 manifest |
| `skillRegistry` | `SkillRegistry` | 注入后 SkillTool 可查找 skill manifest |
| `taskQueue` | `TaskQueue` | 多 agent 共享任务队列 |
| `todoState` | `TodoState` | per-Agent todo 状态 |
| `memoryStore` | `MemoryStore` | KV 记忆 |
| `agentScopedMemoryStore` | `AgentScopedMemoryStore` | Agent 三 scope 持久化记忆 |
| `teammateChannel` | `TeammateChannel` | Agent teams mailbox |
| `teammateBackend` | `TeammateBackend` | Agent teams spawn 后端 |
| `toolRegistry` | `ToolRegistry` | 工具关键词搜索 |
| `cachePolicy` | `CacheControlPolicy` | Anthropic prompt caching breakpoints |
| `compactionPolicy` | `CompactionPolicy` | 长会话压缩 |
| `budgetTracker` | `BudgetTracker` | token 上限保护 |
| `tracingProvider` | `ITracingProvider` | OpenTelemetry 兼容 |
| `metricsProvider` | `IMetricsProvider` | Counter / Gauge / Histogram |
| `sessionStore` | `ISessionStore` | Session 持久化（Filesystem / InMemory / 自定义） |
| `sessionContentStore` | `ISessionContentStore` | Session 内容存储 |

### 4.3 扩展

| 字段 | 类型 | 说明 |
|------|------|------|
| `extensions.tools` | `ToolExtension[]` | 自定义工具（new in `bridge/extensions.ts`） |
| `extensions.skills` | `SkillExtension[]` | 文件系统动态技能 |
| `extensions.permissions` | `PermissionConfig` | 权限配置 |
| `toolsets` | `('core' \| 'filesystem' \| 'web' \| 'git' \| 'development')[]` | 工具集预设 |
| `options.maxTurns` | `number` | 单次 query 最大 turn 数 |
| `options.maxBudgetUsd` | `number` | 单次 query USD 预算 |
| `options.maxMessagesPerSession` | `number` | session 最大消息数（默认 10000） |
| `memoryRoot` | `string` | 用户级记忆隔离根目录 |

### 4.4 v6.0 删除字段（迁移指南）

| 删除字段 | 替代方案 |
|---------|---------|
| `useAgentLoop?: boolean` | **直接删除调用**——substrate 永远走 AgentLoop |
| `provider?: ProviderConfig` (discriminated union) | 用 `streamingProvider` + `defaultModel` 替代 |
| `providerRegistry?: ProviderRegistry` | 直接传 `streamingProvider` 实例 |
| `circuitBreaker?: { ... }` | agent-loop 已自带 CircuitBreaker（`agent-loop/budget/`），未来按需暴露 |

---

## 5. Provider 协议（v6.0 核心）

### 5.1 唯一接口：StreamingProviderAdapter

```typescript
interface StreamingQueryParams {
  model: string
  messages: Message[]
  tools?: Tool[]
  systemPrompt?: string | BetaTextBlockParam[]
  maxTokens?: number
  signal?: AbortSignal
  extra?: Record<string, unknown>
  resolvedTools?: BetaToolUnion[]
}

interface StreamingProviderAdapter {
  readonly type: string
  queryStream(params: StreamingQueryParams): AsyncGenerator<ParsedSSEEvent>
}
```

**职责边界**：
- Provider 只管「发请求 + 收 SSE 流 + 解析为 ParsedSSEEvent」
- 不管 retry / fallback / watchdog / cache（这些归 AgentLoop 在外层做）
- cancellation 通过 `params.signal` 一路传到 fetch 层
- 错误：SDK throw → emit `ParsedSSEEvent.error`（type='error'）

### 5.2 唯一具体实现：AnthropicStreamingProvider

```typescript
class AnthropicStreamingProvider implements StreamingProviderAdapter {
  readonly type = 'anthropic'

  constructor(
    config: AnthropicProviderConfig = {},
    clientFactory: (opts: ClientOptions) => Anthropic = opts => new Anthropic(opts),
  ) { /* ... */ }

  async *queryStream(params: StreamingQueryParams): AsyncGenerator<ParsedSSEEvent> {
    // 1. 解析 apiKey / baseURL（config 优先于 env，但不污染 env）
    // 2. 构造 Anthropic SDK client
    // 3. 用 MessageSerializer 序列化 + 调 client.beta.messages.create({stream: true})
    // 4. SDK 返回的 stream 喂给 SSEParser，emit ParsedSSEEvent
    // 5. SDK throw → emit ParsedSSEEvent.error
  }
}
```

**关键特性**：
- 不继承 `BaseProvider`（旧 product-era 抽象，v6.0 已删）
- 不污染 `process.env`（与 v5.0 旧 AnthropicProvider 通过临时改 env 的实现相反）
- `clientFactory` 可注入，方便测试 mock

### 5.3 多 Provider 通过 Anthropic-compatible endpoint

substrate 不在内部做协议翻译，也不通过 `baseURL.includes(...)` 识别 vendor。它只消费 Anthropic Messages/SSE compatible endpoint；vendor 知识属于配置（env），不是代码分支。

#### 5.3.1 统一接入配置

任意 anthropic-compatible provider 都通过 3 类正交 env 接入：

| 维度 | Env | 说明 |
|------|-----|------|
| 认证模式 | `AUTH_MODE=apikey|bearer` | `apikey` 使用 `x-api-key`；`bearer` 使用 `Authorization: Bearer` |
| 认证值 | `API_KEY` 或 `AUTH_TOKEN` | 也兼容 `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` |
| 端点 + 模型 | `BASE_URL` + `MODEL` | `BASE_URL` 可缺省为 Anthropic 官方；`MODEL` 必须显式提供 |

#### 5.3.2 已实证的 anthropic-compatible 接入路径

| 路径类型 | 实例 | 认证 | 验证方式 |
|----------|------|------|----------|
| Anthropic 官方 | `https://api.anthropic.com` | `x-api-key` | `API_KEY + MODEL` |
| Vendor 官方 anthropic endpoint | provider-provided `/anthropic` endpoint | `x-api-key` | `scripts/probe-anthropic-compat.ts` |
| 本地协议转换代理 | `127.0.0.1:<port>`（OpenAI ↔ Anthropic 翻译） | `x-api-key` | P0.3 true API smoke 3/3 |
| 第三方 Bearer 网关 | gateway endpoint | `Bearer` | `AUTH_MODE=bearer` |

这张表不是 vendor 排名，也不是默认推荐。它表达的是 substrate 的边界：只要 endpoint 对 Anthropic Messages API 与 SSE 事件兼容，substrate 就不需要知道背后是谁。

#### 5.3.3 Provider contract

provider endpoint 至少需要满足：

- 接收 Anthropic Messages 形态的 `system` / `messages` / `tools` / `tool_choice` / `stream` 参数
- 支持 content blocks 数组形式，尤其 `text` / `tool_use` / `tool_result`
- 返回 Anthropic SSE 事件序列，至少覆盖 `message_start` / `content_block_delta` / `message_stop`
- 对不支持的扩展字段给出稳定行为：显式报错或安全忽略，但不能改变基础协议语义

#### 5.3.4 代码层显式配置示例

```ts
const provider = new AnthropicStreamingProvider({
  apiKey: process.env.API_KEY,
  baseURL: process.env.BASE_URL,
  defaultModel: process.env.MODEL,
})
```

如果目标网关要求 Bearer token，则改用 `authToken`，不要同时注入 `apiKey` 与 `authToken`：

```ts
const provider = new AnthropicStreamingProvider({
  authToken: process.env.AUTH_TOKEN,
  baseURL: process.env.BASE_URL,
  defaultModel: process.env.MODEL,
})
```

---

## 6. 查询执行流（v6.0 唯一路径）

```
caller code
  │
  └─→ AgentEngine.query(sessionId, "hello")
        │
        ├─→ 0. 互斥锁（activeQueries.set）
        ├─→ 1. session 校验（active / not destroyed / not paused）
        ├─→ 2. streamingProvider 校验（缺失抛 CONFIGURATION_ERROR）
        ├─→ 3. systemPrompt 解析（per-session 优先 → engine 级 → undefined）
        ├─→ 4. 历史消息（resume 场景从 sessionMessages cache 取）
        ├─→ 5. AbortController 注册 + 联动 caller signal
        ├─→ 6. 动态 import runQueryViaAgentLoop
        └─→ 7. runQueryViaAgentLoop({input, model, provider, ...kernelBag})
              │
              ├─→ 7a. 构造初始 messages（history + 新 user message）
              ├─→ 7b. 构造 ToolUseContext（注入 kernel bag + provider + sandbox）
              ├─→ 7c. 联动 caller signal 到 ctx.abortController
              ├─→ 7d. 构造 AgentLoopParams
              └─→ 7e. AgentLoop.runWithStore(loopParams) (注入 runStore 时)
                    或 AgentLoop.run(loopParams) (无 runStore)
                    │
                    └─→ AgentLoop 主循环
                          ├─→ MessageSerializer.toRequestParams → SDK params
                          ├─→ provider.queryStream(serialized) → ParsedSSEEvent[]
                          │     │
                          │     └─→ AnthropicStreamingProvider.queryStream
                          │           ├─→ Anthropic SDK.beta.messages.create({stream: true})
                          │           └─→ SSEParser.consume(stream) → ParsedSSEEvent[]
                          │
                          ├─→ ToolDispatcher.dispatch(tool_use[]) → tool_result[]
                          ├─→ Hook execution (pre/post stream/tool/error)
                          ├─→ Cache / Compaction / Budget tracking
                          ├─→ Audit hash chain append (注入 auditStore 时)
                          └─→ Run state checkpoint (注入 runStore 时)
                          │
                          └─→ LoopEvent[]（assistant_message / tool_use / tool_result / etc.）
              │
              └─→ bridgeAgentLoopToSDK(loopGen) → SDK QueryEvent[]
        │
        └─→ for-await consume QueryEvent[]
              │
              └─→ caller 消费（assistant / tool_use / tool_result / system / error）
```

**关键事实**：
- v6.0 没有 `useAgentLoop=false` 分支，没有 HeadlessQueryEngine fallback
- 16 batch agent-loop 能力（retry / fallback / watchdog / caching / compaction / budget / governance / audit / runStore / sandbox）默认全部上线，**注入对应 store / policy 即生效**

---

## 7. Examples（scripted + vendor-neutral real API）

### 7.1 三件套结构

```
neptune-engine/examples/
├── _provider.ts                    ── 共享 provider factory（三类正交 env）
├── sdk-pure.ts                     ── in-process LLM call，无 store
├── sdk-with-fs-store.ts            ── + FileRunStore 状态外化 + resume
└── sdk-with-server.ts              ── + 极简 HTTP server + SSE 转发（生产场景核心模式）
```

### 7.2 双模式

```bash
# 模式 1：CI 友好（0 API 消耗）
USE_SCRIPTED_PROVIDER=true bun run examples/sdk-pure.ts
USE_SCRIPTED_PROVIDER=true bun run examples/sdk-with-fs-store.ts
USE_SCRIPTED_PROVIDER=true EXIT_AFTER_LISTEN=true bun run examples/sdk-with-server.ts

# 模式 2：真 API（任意 anthropic-compatible endpoint）
API_KEY=... BASE_URL=https://your-provider/anthropic MODEL=provider-model \
  bash scripts/smoke-real-api.sh

# 模式 3：真 API（Anthropic 官方 env 兼容）
ANTHROPIC_API_KEY=<api-key> MODEL=provider-model \
  bash scripts/smoke-real-api.sh

# 模式 4：真 API（Bearer 网关）
AUTH_MODE=bearer AUTH_TOKEN=... BASE_URL=https://your-gateway/v1 MODEL=provider-model \
  bash scripts/smoke-real-api.sh
```

### 7.3 _provider.ts factory 规则

```ts
// 1. USE_SCRIPTED_PROVIDER=true → ScriptedProvider（mock，3 turn 预设文本）
// 2. AUTH_MODE=apikey → API_KEY 或 ANTHROPIC_API_KEY → x-api-key
// 3. AUTH_MODE=bearer → AUTH_TOKEN 或 ANTHROPIC_AUTH_TOKEN → Bearer
// 4. BASE_URL 或 ANTHROPIC_BASE_URL → endpoint（不做 vendor 名识别）
// 5. MODEL 必填，缺失 process.exit(1) + 清晰提示
```

### 7.4 examples scripted smoke 守门

scripts/smoke-scripted.sh + examples/__tests__/examples.smoke.test.ts 跑三个 example 的 USE_SCRIPTED_PROVIDER=true 模式：

| 测试 | 验证 |
|------|------|
| sdk-pure.ts smoke | exit 0 + stdout 含 [assistant] |
| sdk-with-fs-store.ts smoke | exit 0 + 创建 runs/<id>/run.json + events 持久化 |
| sdk-with-server.ts smoke | exit 0 + 启动后 [server] listening + EXIT_AFTER_LISTEN=true 退出 |

进守门 v2 D.10。

---

## 8. v5.0 → v6.0 迁移指南

### 8.1 SDK 用户

| v5.0 调用 | v6.0 等价 |
|-----------|-----------|
| `AgentEngine.create({useAgentLoop: true, streamingProvider, ...})` | `AgentEngine.create({streamingProvider, ...})` （删除 useAgentLoop 字段） |
| `AgentEngine.create({useAgentLoop: false, provider: {type: 'anthropic', config: {...}}})` | `AgentEngine.create({streamingProvider: new AnthropicStreamingProvider({apiKey, defaultModel})})` （旧 cc-runtime 路径不再支持） |
| `AgentEngine.create({provider: {type: 'anthropic', config: {model: 'X'}}})` | `AgentEngine.create({defaultModel: 'X', streamingProvider: ...})` |
| `import {AnthropicProvider} from '@neptune/engine'` | `import {AnthropicStreamingProvider} from '@neptune/engine'` |
| `import {ProviderRegistry} from '@neptune/engine'` | （删除——直接 new StreamingProviderAdapter 实例） |
| `import {ToolExtension} from '@neptune/engine/bridge/OriginalQueryEngineBridge'` | `import {ToolExtension} from '@neptune/engine'` （已 re-export） |

### 8.2 product 用户（neptune-engine-product）

product 端 6 个 provider stub 已删（OpenAIProvider / BedrockProvider / VertexProvider / GeminiProvider / GrokProvider / FoundryProvider）。已知 product 路径破裂点：

- `neptune-engine-product/src/QueryEngine.ts` 引用 ProviderAdapter（已删）
- `neptune-engine-product/src/storage/PgSessionStore.ts` 引用 ProviderConfig（已删）
- `neptune-engine-product/src/storage/__tests__/{PgSessionStore,SessionSnapshotRecovery}.test.ts`
- `neptune-ai/server/src/services/engine-factory.ts` 引用 createHeadlessCCRuntime（v6.0 P0.2.B 已删）

修复方向：product 端如需多 provider 支持，应当让 provider 端实现 anthropic-compatible endpoint，或在 product 自己的 host runtime 层做协议翻译。**substrate 不再承担多 provider 翻译职责**。

---

## 9. 守门体系

### 9.1 守门 v1（11 项 — workspace independence）

```
1. neptune-engine 0 反向引用 product
2. neptune-engine 0 反向引用 ai
3. neptune-engine tsc 通过
4. tsconfig 不含 product 路径映射
5. CCRuntime / Bridge 模块自包含
6. mcp-client tsc 通过
7. builtin-tools tsc 通过
8. neptune-engine/package.json 不含 PG/Redis/SQLite 依赖
9. engine/storage 下不含 Pg/Redis/SQLite 实现文件
10. packages/*/src 0 反向引用（substrate 自闭环硬底线）
11. engine/provider/adapters 仅含 Anthropic + Base    ⚠️ v6.0 P0.2.C 后此 check 自动 PASS（adapters 目录已删）
```

### 9.2 守门 v2（42 项 — substrate 完整性，含 functional substrate）

```
Gate A 干净度（13 项）保留 v2.0 + 新增反向引用 / 调试残留
Gate B 协议契约（10 项）替代 v1 [-f file.ts] 文件存在 check，跑各模块测试套
Gate C 工具调度（5 项）一轮多 tool_use / Permission / Hook
Gate D 端到端功能（10 项）红线 #5 关键 - functional substrate 真验证
  D.1 ScriptedProvider AgentLoop 完整 turn
  D.2 AgentTool e2e: spawn sub-agent → result 回填
  D.3 SkillTool e2e: invoke skill → sub-agent → result
  D.4 TeammateChannel e2e
  D.5 SendMessageTool e2e
  D.6 跨实例 resume e2e
  D.7 Async background launch e2e
  D.8 AgentEngine.query substrate 集成 e2e ⭐ v6.0 重命名
  D.9 AgentLoopBridge LoopEvent → SDK QueryEvent
  D.10 examples scripted smoke ⭐ v6.0 新增
Gate E 量化基线（4 项）
  E.1 engine 测试不退化（v6.0 baseline 1352）
  E.2 builtin-tools 关键工具测试不退化
  E.3 SDK examples 文件齐全（3 个）
  E.4 守门套娃 - v1 守门也通过
```

**v6.0 守门状态**：v1 11/11 + v2 42/42 全 PASS。

---

## 10. 测试基线

### 10.1 数据

| 指标 | v5.0 | v6.0 | delta | 解释 |
|------|------|------|-------|------|
| engine 测试 pass | 1433 | 1352 | -81 | 删除 ~76 项旧 provider stub 测试 + 旧 OriginalQueryEngineBridge 测试，合理 |
| engine 测试 fail | 0 | 0 | 0 | 守门 |
| substrate tsc errors | 0 | 0 | 0 | 守门 |
| 守门 v1 | 11/11 | 11/11 | 0 | |
| 守门 v2 | 41/41 | 42/42 | +1 | 新增 D.10 examples smoke |
| 源文件 | ~220 | 193 | -27 | 删除死代码 |
| 测试文件 | ~110 | 95 | -15 | 删除 stub 测试 |
| 旧 provider 双轨代码 | ~990 行 | 0 | -990 | 一刀切 |
| product 6 provider stub | ~340 行 | 0 | -340 | 跨 repo 一并删 |
| product 6 测试 | ~600 行 | 0 | -600 | 跨 repo 一并删 |
| OriginalQueryEngineBridge | ~700 行 | 0 | -700 | 一刀切 |
| HeadlessQueryEngine | 200 行 | 0 | -200 | 一刀切 |
| **死代码总删除** | - | - | **~3400 行** | |

### 10.2 删除的功能契约（实证为空）

按红线 #5 验证：删除后是否有原本能做但现在不能做的事？

| 操作 | v5.0 | v6.0 | 影响 |
|------|------|------|------|
| 通过 streamingProvider 注入 Anthropic 真 API | ✅ | ✅ | 无变化 |
| 通过 streamingProvider 注入 ScriptedProvider mock | ✅ | ✅ | 无变化 |
| RetryingProvider / FallbackProvider / WatchdogProvider 包装 | ✅ | ✅ | 无变化 |
| 通过 `provider: {type: 'anthropic', config: {...}}` 取 model 字段 | ✅ | ✅ (改用 `defaultModel: '...'`) | API 表达更直接 |
| 通过 `providerRegistry` 注册自定义 ProviderAdapter | ❌（实际从未生效） | ❌ 字段删除 | 0 真实损失 |
| 通过 `circuitBreaker: {...}` 配置熔断 | ❌（实际从未生效） | ❌ 字段删除 | 0 真实损失 |
| 调用 `getGlobalProviderRegistry()` | ❌（仅 dead test 路径） | ❌ 函数删除 | 0 真实损失 |

**实证：原本能做现在不能做的 = ∅**

---

## 11. 协议表面（对外 public API）

### 11.1 v6.0 substrate 对外 export 清单

`engine/index.ts` 共 106 项 export，组织为：

| 区块 | 主要 export |
|------|-------------|
| 引擎入口 | `AgentEngine` / `AgentEngineConfig` / `QueryOptions` / `EngineStats` |
| Session | `Session` / `SessionStatus` / `SessionConfig` / `SessionInfo` / `SessionMetadata` / `SessionSnapshot` |
| Storage | `ISessionStore` / `InMemorySessionStore` / `FilesystemSessionStore` |
| Errors | `EngineError` / `EngineErrorCode` / `EngineErrorCodeType` |
| Events | `EventBus` / `EngineEventMap` / `EngineEventType` |
| **Provider 协议** | `StreamingProviderAdapter` / `StreamingQueryParams` / `AnthropicStreamingProvider` / `AnthropicProviderConfig` |
| AgentLoop | `AgentLoop` / `AgentLoopParams` / `LoopEvent` / `LoopResult` |
| ToolUse | `ToolUseContext` / `createToolUseContext` / `CanUseToolFn` |
| ToolDispatch | `ToolDispatcher` / `ToolUpdate` / `ToolResultBlock` / `ToolUseBlock` |
| Message types | `Message` / `AssistantMessage` / `UserMessage` / `Tool` / `Tools` |
| AgentRegistry | `AgentManifest` / `AgentRegistry` / `InMemoryAgentRegistry` / `FilesystemAgentRegistry` |
| Sandbox | `SandboxAdapter` / `NoOpSandbox` / `LocalSandbox` |
| Run/State | `Run` / `RunStore` / `Checkpoint` / `InMemoryRunStore` / `FileRunStore` |
| Teammate | `TeammateChannel` / `TeammateBackend` / `TeammateMessage` / `InMemoryTeammateChannel` |
| Audit | `AuditEvent` / `AuditEventStore` / `FilesystemAuditStore` / `NoopAuditStore` |
| Channel | `Channel` / `InMemoryChannel` |
| Skill | `SkillManifest` / `RegisteredSkill` / `parseSkillMarkdown` / `serializeSkillToMarkdown` |
| Todo | `TodoItem` / `TodoStatus` / `InMemoryTodoState` |
| TaskQueue | `Task` / `TaskStatus` / `InMemoryTaskQueue` |
| Hook | `HookContext` / `HookResult` / `HookExecutor` / `createHookCore` |
| Permission | `PermissionDelegate` / `RBACPermissionDelegate` / `AuditPermissionDelegate` / `ReadOnlyPermissionDelegate` |
| Backend | `IBackend` / `InMemoryBackend` / `FilesystemBackend` / `CompositeBackend` |
| Observability | `ITracingProvider` / `IMetricsProvider` / `NoOpTracingProvider` / `NoOpMetricsProvider` / `InMemoryMetricsProvider` |
| Bridge extensions | `ToolExtension` / `PermissionConfig` |
| QueryEvent | `QueryEvent` / `AssistantTextEvent` / `ToolUseEvent` / `isAssistantTextEvent` / `isToolUseEvent` |
| Helpers | `collectText` / `waitForResult` / `waitForResultWithTimeout` |
| Compat | `isEnabled` / `isEnabledSync` / `FeatureOverride` |
| Config | `IConfigProvider` / `UnifiedConfig` / `normalizeConfig` |
| Log | `LogUtil` / `MDC` / `StandardLogFormatter` / `JsonLogFormatter` / `FileLogStore` |

### 11.2 v6.0 删除的 export

```diff
- export type {ProviderAdapter, ProviderQueryParams, ProviderMessage}
- export {ProviderRegistry, getGlobalProviderRegistry}
- export type {OpenAIProviderConfig, GeminiProviderConfig, GrokProviderConfig,
-              BedrockProviderConfig, VertexProviderConfig, FoundryProviderConfig}
- export type {ProviderConfig, ProviderType}
- export {createHeadlessCCRuntime}
- export type {QueryEngineConfig, QueryEngineWrapper}
- export {AnthropicProvider} (旧 BaseProvider 子类)
- export type {BaseProviderConfig, RetryConfig}
- export {CircuitBreaker, CircuitBreakerConfig, CircuitBreakerState}
- export {buildQueryEngineConfig, buildQueryEngineConfigFromOptions, initializeRuntime}
- export type {BridgeOptions}
```

总计：~22 项 public export 移除。**substrate 表面更小**。

---

## 12. 路线图前瞻（v7.0 候选）

v6.0 已完成 substrate 一刀切清理。可选下一步：

### 12.1 高优先级（基于实战验证可能必需）

- **Anthropic-compatible Provider 矩阵扩展**：当前 substrate 已用 anthropic SDK + 本地协议转换代理完成 true API smoke 3/3。下一步应建立 provider conformance matrix，按协议能力验证，而不是按 vendor 名称写分支。
- **Smoke 矩阵化**：当前 smoke 一次跑 3 个 example，未来扩展到 tool_use / multi-turn / async background / cross-instance resume 等真 API smoke。
- **product 端死代码联合修复**：QueryEngine.ts / PgSessionStore.ts 等 4 处引用断点。

### 12.2 中优先级（substrate 增强）

- **OpenAI-compatible Provider（可选第二条路径）**：调研显示 OpenAI 协议与 Anthropic 不兼容（content blocks vs tool_calls / SSE 结构差异）。如果未来要支持纯 OpenAI / 部分 Gemini 模型，需要写 SSE 翻译层 + tool_calls 累积。**但用户应当优先要求 provider 端实现 anthropic-compatible**。
- **MessageSerializer 多 provider 翻译策略**：当前序列化器写死 Anthropic 格式，所有 anthropic-compatible endpoint 都通用。如果引入 OpenAI，需要拆策略。
- **ProviderRouter（model capability → provider 路由）**：当前每个 AgentEngine 实例绑定一个 streamingProvider。未来考虑 per-call 路由，例如用 `low-cost-model` 跑 sub-agent、用 `high-capability-model` 跑 main agent；路由依据应是能力/成本/延迟标签，而不是 vendor 字符串特判。

### 12.3 长期（生态）

- **MCP 协议第一公民**：当前 MCP 通过 product/mcp-client 接入，未来可考虑 substrate 直接支持 MCP-style tool registration。
- **Skill 市场标准化**：当前 SkillExtension 是文件系统协议，未来考虑标准化 manifest schema 与社区共享。

---

## 13. 写在最后

v6.0 不是「新功能版本」，而是**「协议清晰化版本」**。

v5.0 已经把 14 项协议落到位，但留下了双轨制（旧 ProviderAdapter / 新 StreamingProviderAdapter / cc-runtime fallback / OriginalQueryEngineBridge），让 substrate 表面看起来「支持很多东西，实际很多是 stub」。这种「假绿」会误导 SDK 用户，也违反工程纪律。

v6.0 一刀切删除所有 stub 代码（~3400 行），让 substrate 表面**只包含真实可用的能力**：
- 唯一查询路径（AgentEngine.query → AgentLoop）
- 唯一 Provider 接口（StreamingProviderAdapter）
- 唯一 Provider 实现（AnthropicStreamingProvider）
- 唯一 wire format（Anthropic Messages API）

**多 provider 的支持依赖 provider 端实现 anthropic-compatible endpoint**——这是更可持续的路径。substrate 的边界是协议消费与执行闭环，不是 vendor 路由表。

substrate 的承诺：**给你一个干净、强大、协议明确的 agent runtime kernel**。剩下的事——实现 provider 兼容、做 product 业务装饰、跑生产环境——交给生态。

---

*文档编写：2026-05-26*
*v6.0 commit: `56f8abb` (P0.2.C+D 一刀切完成后)*
*守门 v1 11/11 + v2 42/42 + 测试 1352/0 PASS*
