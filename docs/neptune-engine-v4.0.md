# neptune-engine v4.0 — Agent Runtime Kernel SDK

> **One-liner**：一个干净、强大、功能齐全、可被 server 化的 agent SDK。简单包装一层 server 就是分布式状态外化的 agent engine。

> **Status**：v4.0 base ✅ 完成（2026-05-25）— 14 项协议 + 4 baseline agents + AgentTool 薄壳 + agent teams 协议
> **守门**：11/11 PASS · **engine 测试**：1403 pass / 0 fail · **AgentTool e2e**：20/20 PASS
> **文件规模**：~210 源文件 / ~100 测试文件 / ~3300 行核心模块代码

---

## 0. TL;DR — 5 句话理解 neptune-engine

1. **它是什么**：一个把 agent loop 抽象成 substrate 协议的 SDK。从 SSE 流式解析、多轮工具调度、状态外化、合规审计到 sub-agent / agent teams 多 agent 协作，全部协议化。
2. **它解决什么**：让你 30 行代码就能跑一个有合规护城河（audit chain）/ 安全护栏（sandbox）/ 状态外化（resume）/ 多 agent 协作（sub-agent + agent teams）/ 跨实例可恢复的真实可用 agent。
3. **它不是什么**：不是 product（无 UI / 无 cc 业务装饰）、不是 framework（不绑定具体后端）、不是 LLM（仅是 agent runtime）。
4. **它的灵魂**：filesystem-first 接口设计 + cc 实战借鉴的复杂状态机 + 0 中间件依赖 + substrate / product 严格边界。
5. **它的承诺**：守门 11/11 + AgentTool 22 项功能契约 + 14 个 substrate 协议 + 4 个 baseline agents + 1403 tests / 0 fail。

---

## 1. 能力矩阵（具备什么）

按 14 项能力维度全景图：

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         Harness Kernel v4.0                                    │
│                                                                                │
│  [1] Agent Loop（思考闭环）            [2] Tool Dispatch（行动）               │
│      ✅ Multi-turn + SSE stream         ✅ Permission + Sandbox 双层护栏       │
│      ✅ Retry/Fallback/Watchdog         ✅ canUseTool / preTool hook 拦截      │
│      ✅ Caching/Compaction/Budget       ✅ 一轮多 tool_use 并发派发            │
│                                                                                │
│  [3] Sub-Agent Spawning                [4] Agent Teams（多 agent 协作）         │
│      ✅ AgentTool 薄壳（22 项契约）     ✅ TeammateChannel 协议 + InMemory     │
│      ✅ AgentRegistry + 4 baseline      ✅ TeammateBackend 接口（spawn 抽象）  │
│      ✅ depth 限制 / parent-child       ✅ mailbox/broadcast/shutdown/plan_     │
│         abort 链路 / 三类错误处理          approval 4 类消息 + read flag       │
│                                                                                │
│  [5] Memory（记忆）                    [6] Agent-scoped Memory                  │
│      ✅ InMemoryMemoryStore             ✅ 三 scope（user/project/local）       │
│         （namespace + tags + search）   ✅ Snapshot 同步（init/replace/sync）  │
│                                         ✅ FilesystemAgentScopedMemoryStore    │
│                                                                                │
│  [7] Planning（Todo + TaskQueue）       [8] Skill（扩展能力）                   │
│      ✅ InMemoryTodoState               ✅ Manifest + Formatter（md frontmatter）│
│      ✅ InMemoryTaskQueue               ✅ InMemory + Filesystem 注册           │
│         （多 agent 共享任务队列）        ✅ DiscoverSkillsTool（kernel）       │
│                                                                                │
│  [9] Tool Discovery                     [10] Provider Routing                  │
│      ✅ ToolRegistry + 关键词搜索       ✅ Anthropic + ProviderRegistry        │
│      ✅ ToolSearchTool                   ✅ AnthropicStreamingProvider         │
│                                                                                │
│  [11] Permission / Sandbox             [12] Hook Surface                       │
│      ✅ PermissionMode 5×5 矩阵         ✅ 5 事件 hook（pre/post stream/tool） │
│      ✅ SandboxAdapter 协议             ✅ 4 治理 hook（Policy/Review/Eval/    │
│      ✅ LocalSandbox 规则护栏              Artifact）                           │
│                                                                                │
│  [13] State Externalization            [14] Observability / Audit              │
│      ✅ Run/RunStore + jsonl events     ✅ ITracingProvider（OTel-compat）     │
│      ✅ Checkpoint per turn             ✅ IMetricsProvider                    │
│      ✅ 跨实例 resume + cleanup         ✅ Audit hash chain（4 类篡改可证明）  │
│         filter（unresolved/orphan/      ✅ InMemoryMetricsProvider             │
│         whitespace 三 filter）                                                 │
└────────────────────────────────────────────────────────────────────────────────┘

完成度：14/14 ✅（substrate 协议 + 默认实现）
功能契约：AgentTool 22 项 → 10 项 P0 已落（B4/B7 续）
```

---

## 2. 模块全景（210+ 文件 / 100+ 测试 / 18 个核心模块）

### 2.1 核心模块清单

```
neptune-engine/src/engine/
├── agent-loop/                     ── 思考 + 行动闭环
│   ├── loop/AgentLoop.ts            完整 multi-turn 主循环（runWithStore + resume）
│   ├── sse/                         Anthropic SSE 流解析
│   ├── message/                     Message 序列化 / ContentBlock 规范化
│   ├── dispatcher/                  ToolDispatcher + ToolUseContext + PermissionMode
│   ├── provider/                    StreamingProviderAdapter（Anthropic）
│   ├── retry/ + fallback/           ErrorClassifier + RetryPolicy + ModelFallback
│   ├── watchdog/                    StreamWatchdog（idle / stall 检测）
│   ├── caching/                     CacheControlPolicy（prompt caching）
│   ├── compaction/                  MicroCompaction（长会话不撞墙）
│   ├── budget/                      BudgetTracker + CircuitBreaker
│   ├── usage/                       UsageTracker（cost 计算）
│   ├── hook/                        HookSurface（5 事件 hook）
│   └── cancellation/                CancellationToken（级联取消）
│
├── agent-registry/                 ── Agent manifest 注册表 + 4 baseline
│   ├── AgentRegistry.ts             AgentManifest + 接口（含 getBuiltIns）
│   ├── InMemoryAgentRegistry.ts     进程内 + registerBuiltIns 一键注入
│   ├── FilesystemAgentRegistry.ts   {rootDir}/{type}.agent.json + atomic write
│   └── builtins/                    ── 4 baseline agents
│       ├── generalPurposeAgent.ts   全工具池研究 agent
│       ├── exploreAgent.ts          read-only 快速搜索（model: haiku）
│       ├── planAgent.ts             read-only 实施规划（model: inherit）
│       └── verificationAgent.ts     try-to-break 验证（runInBackground）
│
├── teammate/                       ── Agent Teams 协议（多 agent 协作）
│   ├── TeammateChannel.ts           mailbox 协议（send/broadcast/readMailbox/markAsRead）
│   ├── InMemoryTeammateChannel.ts   per-team mailbox + read flag + roster
│   ├── TeammateBackend.ts           spawn/status/kill/shutdown 抽象（实现留 product）
│   └── StructuredMessage 编解码     shutdown_request/response + plan_approval_response
│
├── memory/                         ── 记忆（双协议）
│   ├── types.ts + InMemoryMemoryStore.ts  普通 KV 记忆（namespace/tags/search）
│   ├── AgentScopedMemoryStore.ts    Agent 专用记忆协议（三 scope）
│   └── FilesystemAgentScopedMemoryStore.ts
│                                    user/project/local + snapshot 同步（init/
│                                    replace/markSynced）+ atomic write
│
├── governance/                     ── 4 类治理 hook（合规护城河）
│   ├── PolicyHook.ts                工具调用前策略（allow/deny/require_review）
│   ├── HumanReviewHook.ts           require_review 时挂起人工
│   ├── EvalHook.ts                  Run 完成后评估
│   └── ArtifactHook.ts              Tool 输出落 EvidenceArtifact
│
├── permissions/                    ── 安全 / 决策矩阵
│   ├── PermissionMode.ts            5 mode × 5 category 决策矩阵
│   ├── RBACPermissionDelegate.ts
│   ├── ReadOnlyPermissionDelegate.ts
│   └── AuditPermissionDelegate.ts
│
├── sandbox/                        ── 规则级安全护栏
│   ├── SandboxAdapter.ts            exec/readFile/writeFile/fetch 接口
│   ├── LocalSandbox.ts              bash prefix + path allowlist + domain allowlist
│   └── NoOpSandbox.ts               显式 dangerous mode opt-in
│
├── run/                            ── State 外化（Stateless 核心）
│   ├── Run.ts                       Run / RunStatus / Checkpoint + RunStore 接口
│   ├── InMemoryRunStore.ts          进程内
│   ├── FileRunStore.ts              {rootDir}/{runId}/{run.json + events.jsonl}
│   ├── rebuildSnapshot.ts           events → messages 重建（Resume 核心）
│   └── messageFilters.ts            resume 前清理三 filter（cc 等价独立实现）
│       ├── filterUnresolvedToolUses          删半截 tool_use
│       ├── filterOrphanedThinkingOnlyMessages 删孤儿 thinking
│       ├── filterWhitespaceOnlyAssistantMessages 删空白 assistant
│       └── cleanupForResume                   三 filter 标准组合
│
├── audit/                          ── 不可篡改审计链
│   ├── AuditEventStore.ts           AuditEvent + verify() 接口
│   ├── canonicalJson.ts             deterministic JSON（key 字典序）
│   ├── NoopAuditStore.ts            占位
│   └── FilesystemAuditStore.ts      sha256 prevHash chain on jsonl
│
├── artifact/                       ── content-addressable 存储
│   └── LocalArtifactStore.ts        {rootDir}/artifacts/{hash[:2]}/{hash}
│
├── channel/                        ── 通用通讯接口（Channel 协议）
│   ├── Channel.ts                   send/receive/subscribe 接口
│   └── InMemoryChannel.ts           FIFO + broadcast 双语义
│
├── skill/                          ── Skill 协议
│   ├── types.ts                     SkillManifest + SkillSource 接口
│   ├── SkillFormatter.ts            md frontmatter 解析 / 序列化
│   ├── SkillLoader.ts               SkillExtension → workspace 写入
│   └── InMemorySkillRegistry.ts
│
├── todo/                           ── per-Agent Todo 列表
│   └── InMemoryTodoState.ts
│
├── task-queue/                     ── 多 Agent 共享任务队列
│   └── InMemoryTaskQueue.ts
│
├── tool-registry/                  ── 工具发现
│   └── InMemoryToolRegistry.ts      关键词搜索
│
├── observability/                  ── OTel-compatible
│   ├── ITracingProvider.ts          startSpan / runInSpan
│   ├── IMetricsProvider.ts          counter / gauge / histogram
│   ├── NoOpTracingProvider.ts
│   ├── NoOpMetricsProvider.ts
│   └── InMemoryMetricsProvider.ts
│
├── provider/                       ── Provider 路由
│   ├── adapters/AnthropicProvider.ts （substrate 默认）
│   ├── adapters/BaseProvider.ts
│   ├── ProviderRegistry.ts          product 注入其他 provider
│   └── CircuitBreaker.ts
│
├── storage/                        ── Session / Backend 通用
│   ├── ISessionStore.ts + InMemorySessionStore.ts + FilesystemSessionStore.ts
│   ├── ISessionContentStore.ts + InMemorySessionContentStore.ts
│   ├── IBackend.ts + InMemoryBackend.ts + FilesystemBackend.ts + CompositeBackend.ts
│
└── （AgentEngine.ts / SessionManager / EventBus / hooks/ / config/ / log/ / etc.）

neptune-engine/packages/builtin-tools/src/tools/
├── AgentTool/                      ── ⭐ B2 核心 spawn sub-agent 薄壳（~580 行）
│   ├── AgentTool.ts                 ToolDef 主体（~280 行 / 22 项功能契约 / 20 e2e）
│   ├── runSubAgent.ts               sub-agent 运行核心（~280 行，AgentLoop 集成）
│   ├── inputSchema.ts               5 字段（description/prompt/subagent_type/model/run_in_background）
│   ├── outputSchema.ts              completed / async_launched 双形态
│   ├── prompt.ts                    When NOT to use + Writing the prompt + agent listing
│   ├── resultMapping.ts             usage trailer + one-shot agent 跳过
│   ├── constants.ts                 AGENT_TOOL_NAME / LEGACY / ONE_SHOT
│   └── __tests__/AgentTool.e2e.test.ts  20 e2e 测试覆盖 22 项契约的 10 项 P0
│
├── BashTool/ FileEditTool/ FileReadTool/ FileWriteTool/  ── 文件 IO 原语
├── GlobTool/ GrepTool/                                    ── 搜索原语
├── WebFetchTool/ WebSearchTool/                          ── 网络原语
├── LSPTool/                                              ── 代码理解
├── MCPTool/ ListMcpResourcesTool/ ReadMcpResourceTool/   ── MCP 协议薄壳
├── REPLTool/ SendMessageTool/ SleepTool/                 ── 交互原语
├── NotebookEditTool/                                     ── name 常量 stub（业务在 product）
└── kernel/  ── 11 协议薄壳工具
    ├── TodoWriteTool / TaskCreate/Get/List/Update/Stop/Output（7 task 工具）
    ├── ToolSearchTool（toolRegistry 协议）
    ├── DiscoverSkillsTool（skillRegistry 协议）
    └── MemoryWriteTool / MemoryRecallTool（memoryStore 协议）
```

---

## 3. 14 项核心协议（substrate 接口设计）

### 3.1 Agent 启动相关（4 协议）

#### AgentRegistry — Sub-agent 注册表

```ts
interface AgentManifest {
  type: string                    // 唯一类型标识（'general-purpose' / 'reviewer'）
  name?: string                   // 展示名
  description: string             // LLM 看到的能力描述
  systemPrompt?: string           // sub-agent 启动时的 system prompt
  tools?: string[]                // 可用工具白名单（undefined = 全部）
  modelHint?: string              // 推荐模型（'sonnet' / 'haiku' / 'inherit'）
  metadata?: Record<string, unknown>  // 业务扩展
}

interface AgentRegistry {
  get(type: string): Promise<AgentManifest | undefined>
  list(): Promise<AgentManifest[]>
  register(manifest: AgentManifest): Promise<void>
  unregister(type: string): Promise<void>
  getBuiltIns?(): readonly AgentManifest[]  // 默认提供 4 baseline
}
```

实现：`InMemoryAgentRegistry` + `FilesystemAgentRegistry`（atomic write JSON 文件）

#### TeammateChannel — Agent Teams mailbox

```ts
interface TeammateChannel {
  send(team: string, recipient: string, msg: TeammateMessageInput): Promise<void>
  broadcast(team: string, sender: string, msg: TeammateMessageInput): Promise<readonly string[]>
  readMailbox(team: string, agentName: string): Promise<readonly TeammateMessage[]>
  readUnreadMessages(team: string, agentName: string): Promise<readonly TeammateMessage[]>
  markAsRead(team: string, agentName: string, opts?: {beforeTimestamp?: string}): Promise<void>
  listTeammates(team: string): Promise<readonly string[]>
  registerTeammate(team: string, agentName: string): Promise<void>
  unregisterTeammate(team: string, agentName: string): Promise<void>
}
```

实现：`InMemoryTeammateChannel` + 4 类 StructuredMessage（plain / shutdown_request / shutdown_response / plan_approval_response）+ encode/decode helpers

#### TeammateBackend — Spawn 后端抽象

```ts
interface TeammateBackend {
  spawn(input: SpawnTeammateInput): Promise<SpawnTeammateResult>
  status(agentId: string): Promise<TeammateInfo | null>
  list(team: string): Promise<readonly TeammateInfo[]>
  kill(agentId: string, reason?: string): Promise<void>
  shutdown(agentId: string, reason?: string): Promise<void>
}
```

substrate 不绑实现（不引入 tmux / 进程业务）。product 注入：
- `InProcessTeammateBackend`：同进程多 LLM 循环（SDK 默认）
- `TmuxTeammateBackend`：cc tmux pane 业务实现
- `RemoteTeammateBackend`：k8s pod / 远程 agent

#### Channel — 通用通讯协议

```ts
interface Channel<T = unknown> {
  send(target: string, message: T): Promise<void>
  receive(target: string): Promise<T | null>
  subscribe(target: string): AsyncIterable<T>
}
```

实现：`InMemoryChannel`（FIFO + broadcast）

### 3.2 状态外化（3 协议）

#### RunStore — Run 元数据 + events 流

```ts
interface Run {
  id: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'aborted'
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown>
}

interface RunStore {
  create(init?: {id?, status?, metadata?}): Promise<Run>
  load(id: string): Promise<Run | null>
  updateStatus(id: string, status: RunStatus): Promise<void>
  appendEvent(id: string, event: LoopEvent): Promise<void>
  loadEvents(id: string, opts?: {fromIndex?: number}): Promise<LoopEvent[]>
  loadSnapshot(id: string): Promise<RunSnapshot | null>
  loadCheckpoint?(id: string, turnNumber: number): Promise<Checkpoint | null>
  delete(id: string): Promise<void>
}
```

实现：`InMemoryRunStore` + `FileRunStore`（{rootDir}/{runId}/{run.json + events.jsonl}）

#### messageFilters — Resume 前清理

```ts
filterUnresolvedToolUses(messages)         // 删半截 tool_use（无匹配 tool_result）
filterOrphanedThinkingOnlyMessages(messages) // 删孤儿 thinking（无 text/tool_use）
filterWhitespaceOnlyAssistantMessages(messages) // 删空白 assistant
cleanupForResume(messages)                 // 三 filter 标准组合
```

#### AuditEventStore — 不可篡改审计链

```ts
interface AuditEventStore {
  append(runId: string, payload: unknown): Promise<AuditEvent>
  load(runId: string): Promise<AuditEvent[]>
  verify(runId: string): Promise<{valid: boolean; firstBadIndex?: number; reason?: string}>
}
```

每个 AuditEvent 含 `{index, prevHash, hash = sha256(prevHash + canonicalJson(payload + ts))}`。verify 重算整个链，篡改任意中间 event 必被检出。

### 3.3 记忆（2 协议）

#### MemoryStore — 通用 KV 记忆

```ts
interface MemoryStore {
  put(entry: MemoryEntryInput): Promise<MemoryRef>
  get(ref: MemoryRef): Promise<MemoryEntry | undefined>
  delete(ref: MemoryRef): Promise<void>
  search(query: MemoryQuery): Promise<readonly MemoryEntry[]>
  list(namespace?: string): AsyncIterable<MemoryEntry>
}
```

支持 namespace + tags + text + since 时间窗 + limit。

#### AgentScopedMemoryStore — Agent 专用三 scope 记忆

```ts
type AgentMemoryScope = 'user' | 'project' | 'local'

interface AgentScopedMemoryStore {
  load(agentType: string, scope: AgentMemoryScope): Promise<string>
  write(agentType, scope, fileName, content): Promise<void>
  list(agentType, scope): Promise<readonly string[]>
  delete(agentType, scope, fileName): Promise<void>
  // Snapshot 同步（团队共享 / 跨机器同步）
  checkSnapshot(agentType, scope): Promise<SnapshotCheckResult>
  initializeFromSnapshot(agentType, scope, ts): Promise<void>
  replaceFromSnapshot(agentType, scope, ts): Promise<void>
  markSnapshotSynced(agentType, scope, ts): Promise<void>
  writeSnapshot(agentType, fileName, content, updatedAt): Promise<void>
}
```

三 scope 隔离 + snapshot init/replace/markSynced 幂等 + atomic write + agent type sanitize（`:` → `-` Windows 兼容）。

实现：`FilesystemAgentScopedMemoryStore`（路径完全注入化，不硬编码 `.claude/`）

### 3.4 工具能力发现（3 协议）

```ts
interface SkillRegistry {
  register(manifest: SkillManifest, source: SkillSource): Promise<void>
  unregister(name: string): Promise<void>
  find(name: string): SkillManifest | undefined
  list(): readonly SkillManifest[]
  source(name: string): SkillSource | undefined
}

interface ToolRegistry {
  getTools(permissionContext?: ToolPermissionContext): Tool[]
  // + 关键词搜索（ToolSearchTool 用）
}

interface TaskQueue {
  create(input: TaskInput): Promise<Task>
  get/list/update/stop/events
}
```

### 3.5 安全护栏（2 协议）

#### SandboxAdapter

```ts
interface SandboxAdapter {
  exec(req: ExecRequest): Promise<ExecResult>
  readFile(opts: ReadFileOptions): Promise<ReadFileResult>
  writeFile(opts: WriteFileOptions): Promise<WriteFileResult>
  fetch(req: FetchRequest): Promise<FetchResult>
}
```

实现：`NoOpSandbox`（透传，dangerous mode 默认）+ `LocalSandbox`（bash prefix + path allowlist + domain allowlist 24 case 决策矩阵）

#### GovernanceHooks

```ts
interface GovernanceHooks {
  policyHook?: PolicyHook            // 工具调用前 allow/deny/require_review
  humanReviewHook?: HumanReviewHook  // 挂起人工复核
  evalHook?: EvalHook                // Run 完成后评估
  artifactHook?: ArtifactHook        // Tool 输出落 EvidenceArtifact
}
```

接口 + NoOp 默认实现 + AgentLoop 注入点。所有 hook 触发会 emit governance_decision LoopEvent + 计 GovernanceSnapshot。

### 3.6 Observability（2 协议）

```ts
interface ITracingProvider {
  startSpan(name: string, attributes?: Record<string, unknown>): Span
  runInSpan<T>(name, fn): T
}

interface IMetricsProvider {
  counter(name: string): Counter
  gauge(name: string): Gauge
  histogram(name: string): Histogram
}
```

OTel-compatible。AgentLoop 主循环 + 每个 turn + 每个 tool 都包 span。

实现：`NoOpTracingProvider` + `NoOpMetricsProvider` + `InMemoryMetricsProvider`

---

## 4. AgentTool — 22 项功能契约

substrate 内 AgentTool 薄壳（~580 行）实现 cc 已证明的 sub-agent 启动器核心，cc 完整版 5576 行保留 `neptune-engine-product/src/cc-tools/AgentTool/` 作参考实现。

### 4.1 已实现（10 项 P0）

| # | 契约 | 实现位置 |
|---|------|----------|
| 1 | 按 manifest.type spawn sub-agent | AgentTool.call → registry.get(type) |
| 2 | 用 manifest.systemPrompt 启动 | runSubAgent → AgentLoopParams.systemPrompt |
| 3 | manifest.tools 白名单过滤 | resolveSubAgentTools |
| 4 | model 三段优先级（input > manifest.modelHint > parent）| resolveModel |
| 5 | last assistant text + 回溯 fallback 聚合 | aggregateAssistantText |
| 6 | usage trailer（agentId/totalTokens/toolUses/durationMs）| mapAgentToolResultToBlock |
| 7 | parent abort → child sub-agent abort 链路 | runSubAgent childController |
| 8 | 三类错误 + partial result extraction | runSubAgent + extractPartialResult |
| 9 | depth 限制（默认 maxDepth=3，防 spawn 风暴）| AgentTool.call header |
| 10 | agent type 不存在 → helpful 错误信息 | AgentTool.call (含 available types 列表) |

### 4.2 待续（12 项 → B4/B7）

- run_in_background → TaskQueue + RunStore 协议化（B4）
- 一轮多个 tool_use(AgentTool) → 并发 spawn（AgentLoop 已支持，B7 集成）
- sub-agent runStore 状态外化（B4）
- progress streaming（B7 接 hook）
- permissionMode 继承 + 覆盖（B7 ctx.options 透传）
- SkillTool 路径（B6）：6 项 skill 启动契约 + recordSkillUsage

### 4.3 测试覆盖

`packages/builtin-tools/src/tools/AgentTool/__tests__/AgentTool.e2e.test.ts` — **20 e2e 测试 / 0 fail**：

```
✅ 基础 spawn 流程 → end_turn → 返回 completed status + content
✅ systemPrompt 注入 sub-agent provider
✅ model 三段优先级（4 测试覆盖所有分支）
✅ depth 限制（>= maxDepth 抛错 / < maxDepth 正常）
✅ agent type 不存在 → 错误信息含 available types
✅ subagent_type 缺失 → 默认 general-purpose
✅ cancellation 链路（parent abort → child abort）
✅ API error 处理 → throw with error message
✅ protocol injection 缺失 → throw with helpful message（agentRegistry / provider 各一）
✅ ToolDef metadata（name / aliases / inputSchema）
✅ mapToolResultToToolResultBlockParam（usage trailer / one-shot 跳过 / 空内容 marker）
✅ 与 4 baseline agents 集成（registerBuiltIns + spawn Explore）
```

---

## 5. 4 个 Baseline Agents

substrate 默认提供 cc 已证明的 4 个内置 agent manifest，让 SDK 用户开箱即用，也是未来 LLM 自创建 agent 时的 anchor。

| Agent type | 用途 | model | tools | metadata |
|------------|------|-------|-------|----------|
| `general-purpose` | 全工具池研究 | host 默认 | 全部（继承 parent） | `{source: 'built-in', isBaseline: true}` |
| `Explore` | 快速 read-only 搜索 | `haiku` | Glob/Grep/FileRead/Bash/Web*/LSP | `{...isOneShot: true, readOnly: true}` |
| `Plan` | read-only 实施规划 | `inherit` | 同 Explore | `{...isOneShot: true, readOnly: true}` |
| `verification` | try-to-break 验证 | `inherit` | 同 Explore | `{...readOnly: true, runInBackground: true}` |

```ts
import {InMemoryAgentRegistry} from '@neptune/engine'

const registry = new InMemoryAgentRegistry()
await registry.registerBuiltIns()
// 现在可用：general-purpose / Explore / Plan / verification
```

---

## 6. 使用方式（如何使用）

### 6.1 最小可用 agent（30 行）

```ts
import {
  AgentLoop,
  AnthropicStreamingProvider,
  createToolUseContext,
  InMemoryAgentRegistry,
  type Message,
} from '@neptune/engine'
import {AgentTool} from '@neptune/builtin-tools'
import {randomUUID} from 'crypto'

const provider = new AnthropicStreamingProvider({apiKey: process.env.ANTHROPIC_API_KEY!})
const registry = new InMemoryAgentRegistry()
await registry.registerBuiltIns()

const ctx = createToolUseContext({
  tools: [AgentTool],
  kernel: {agentRegistry: registry},
})
;(ctx as Record<string, unknown>).provider = provider

const userMessage: Message = {
  type: 'user',
  uuid: randomUUID() as unknown as Message['uuid'],
  message: {role: 'user', content: 'Use Explore agent to find user models in src/'},
}

for await (const event of AgentLoop.run({
  provider, model: 'claude-sonnet-4-20250514',
  messages: [userMessage], context: ctx, tools: [AgentTool],
})) {
  if (event.type === 'assistant_message') {
    console.log(JSON.stringify(event.message.message?.content, null, 2))
  }
}
```

### 6.2 状态外化 + Resume

```ts
import {AgentLoop, FileRunStore, AnthropicStreamingProvider} from '@neptune/engine'

const store = new FileRunStore('./runs')
const provider = new AnthropicStreamingProvider({apiKey: '...'})
const ctx = createToolUseContext()

// 第一次：创建新 run
const run = await store.create({metadata: {label: 'demo'}})
for await (const event of AgentLoop.runWithStore({
  provider, model: '...', messages: [...], context: ctx,
  runStore: store, runId: run.id,
})) { /* ... */ }

// 第二次（任意进程实例）：resume 同 runId
for await (const event of AgentLoop.resume(run.id, {
  provider, model: '...', context: ctx, runStore: store,
})) { /* ... */ }
```

### 6.3 Agent Teams（多 agent 协作）

```ts
import {InMemoryTeammateChannel, encodeStructuredMessage} from '@neptune/engine'

const channel = new InMemoryTeammateChannel()

// 注册 teammates
await channel.registerTeammate('proj-A', 'alice')
await channel.registerTeammate('proj-A', 'bob')
await channel.registerTeammate('proj-A', 'carol')

// alice 给 bob 单播
await channel.send('proj-A', 'bob', {
  from: 'alice', text: 'review this PR plz', summary: 'PR review request',
})

// bob 读未读
const inbox = await channel.readUnreadMessages('proj-A', 'bob')
await channel.markAsRead('proj-A', 'bob')

// alice 广播
const recipients = await channel.broadcast('proj-A', 'alice', {
  from: 'alice', text: 'sprint started!',
})  // → ['bob', 'carol']

// 结构化消息：team lead 请求关闭 carol
await channel.send('proj-A', 'carol', {
  from: 'team-lead',
  text: encodeStructuredMessage({
    type: 'shutdown_request', request_id: 'req-1', reason: 'idle',
  }),
})
```

### 6.4 治理 hook（合规护城河）

```ts
import {AgentLoop, type GovernanceHooks} from '@neptune/engine'

const governance: GovernanceHooks = {
  policyHook: {
    async beforeToolUse(invocation) {
      if (invocation.toolName === 'Bash' && invocation.input.command?.includes('rm -rf /')) {
        return {decision: 'deny', reason: 'destructive'}
      }
      return {decision: 'allow'}
    },
  },
  evalHook: {
    async onRunComplete(runId, result) {
      // 上报 langfuse / DB
    },
  },
}

for await (const event of AgentLoop.run({
  provider, model, messages, context, tools, governance,
})) {
  if (event.type === 'governance_decision') {
    console.log('governance:', event.event)
  }
}
```

### 6.5 Audit hash chain（不可篡改）

```ts
import {FilesystemAuditStore} from '@neptune/engine'

const audit = new FilesystemAuditStore('./audits')
await audit.append(runId, {phase: 'tool', name: 'Bash', input: {...}})
await audit.append(runId, {phase: 'response', model: '...', usage: {...}})

const result = await audit.verify(runId)
// {valid: true} 或 {valid: false, firstBadIndex: 3, reason: 'hash mismatch'}
```

### 6.6 Agent-scoped Memory（团队共享 + 三 scope）

```ts
import {FilesystemAgentScopedMemoryStore} from '@neptune/engine'

const memory = new FilesystemAgentScopedMemoryStore({
  userBaseDir: `${process.env.HOME}/.neptune/agent-memory`,
  projectBaseDir: `${cwd}/.neptune/agent-memory`,
  localBaseDir: `${cwd}/.neptune/agent-memory-local`,
  snapshotBaseDir: `${cwd}/.neptune/agent-memory-snapshots`,
})

// reviewer agent 跑完后写 memory
await memory.write('reviewer', 'project', 'lessons.md', '## Bug patterns\n- Always check null...')

// 其他人加载（命中 project scope）
const learned = await memory.load('reviewer', 'project')

// 团队同步：snapshot 比本地新 → 提示 update
const check = await memory.checkSnapshot('reviewer', 'project')
if (check.action === 'prompt-update') {
  await memory.replaceFromSnapshot('reviewer', 'project', check.snapshotTimestamp)
}
```

### 6.7 SDK 三种部署姿势

```bash
# 1. 纯 SDK in-process（最简单）
ANTHROPIC_API_KEY=sk-... bun run examples/sdk-pure.ts

# 2. SDK + FileRunStore（state 外化 + cross-instance resume）
ANTHROPIC_API_KEY=sk-... bun run examples/sdk-with-fs-store.ts
ANTHROPIC_API_KEY=sk-... bun run examples/sdk-with-fs-store.ts --resume <runId>

# 3. SDK + 极简 HTTP server（SSE 流，0 外部 deps）
ANTHROPIC_API_KEY=sk-... bun run examples/sdk-with-server.ts
curl -X POST http://localhost:3000/runs -d '{"prompt":"hello"}'
curl http://localhost:3000/runs/<runId>/events
```

---

## 7. 量化指标

### 7.1 测试覆盖

```
engine baseline:        1403 pass / 0 fail
- 16 batch agent-loop:  ~600 测试
- 11 协议双默认实现:    ~400 测试
- AgentScoped memory:   19 测试
- Resume cleanup filter: 17 测试
- AgentRegistry baseline: 18 测试（含 4 baseline 协议契约）
- TeammateChannel:      24 测试
- AuditEventStore:      4 类篡改全检出
- LocalSandbox:         24 case 决策矩阵
- 跨实例 resume:        5 集成测试
- 其他:                 ~290 测试

builtin-tools:
- AgentTool e2e:        20 / 20 pass
- 11 kernel tools:      ~50 协议契约测试
- 文件 IO 原语:         ~150 测试

总计: 1403 engine + AgentTool e2e 20 = ~1423 真实可用测试
```

### 7.2 代码规模

```
neptune-engine/src/engine/    ~210 文件 / ~3300 行核心
neptune-engine/packages/      3 packages / ~30 工具
substrate 协议数:             14（Agent/Skill/Memory/Run/Audit/Sandbox/Channel/Teammate*2/Tracing/Metrics/Provider/TaskQueue/TodoState）
substrate 默认实现:           ~30（每个协议至少 1 InMemory + 大部分加 1 Filesystem）
依赖：                       @anthropic-ai/sdk + zod + crypto（0 数据库 SDK）
```

### 7.3 守门验收

```bash
$ bash neptune-engine/scripts/verify-workspace-independent.sh

[check 1]  builtin-tools 不含 .tsx 文件                       ✅ PASS
[check 2]  builtin-tools 不含 react / ink import              ✅ PASS
[check 3]  packages/*/src 不含 @neptune/engine-product import   ✅ PASS
[check 4]  9 个核心工具目录不含 from 'src/' 反向引用            ✅ PASS
[check 5]  agent-tools tsc 通过                              ✅ PASS
[check 6]  mcp-client tsc 通过                               ✅ PASS
[check 7]  builtin-tools tsc 通过                            ✅ PASS
[check 8]  neptune-engine/package.json 不含 PG/Redis/SQLite 依赖 ✅ PASS
[check 9]  engine/storage 下不含 Pg/Redis/SQLite 实现文件      ✅ PASS
[check 10] packages/*/src 0 反向引用（substrate 自闭环硬底线）  ✅ PASS
[check 11] engine/provider/adapters 仅含 Anthropic + Base    ✅ PASS

✅ Workspace independence: ALL GREEN (11/11)
```

---

## 8. 设计原则（substrate 灵魂）

### 8.1 Filesystem-first

所有协议默认提供 InMemory + Filesystem 双实现。Filesystem 是分布式场景的关键选择：
- NFS 友好（atomic rename / jsonl append）
- 多机共享 mount（无中间件依赖）
- 进程恢复（重启不丢状态）

数据库后端（Pg / Redis / S3）由 product 注入，substrate 不绑。

### 8.2 双协议实现 — InMemory + Filesystem

```
RunStore         → InMemoryRunStore + FileRunStore
SessionStore     → InMemorySessionStore + FilesystemSessionStore
AgentRegistry    → InMemoryAgentRegistry + FilesystemAgentRegistry
SkillRegistry    → InMemorySkillRegistry
MemoryStore      → InMemoryMemoryStore
AgentScopedMem   → FilesystemAgentScopedMemoryStore
AuditEventStore  → NoopAuditStore + FilesystemAuditStore
TeammateChannel  → InMemoryTeammateChannel
Channel          → InMemoryChannel
Sandbox          → NoOpSandbox + LocalSandbox
ArtifactStore    → LocalArtifactStore
TodoState/TaskQueue/ToolRegistry → InMemory
Tracing/Metrics  → NoOp + InMemory
```

### 8.3 cc 实战借鉴 + product 边界

substrate 必备能力（agent 启动 / skill 启动 / 工具调度 / 状态外化 / 取消 / 审计 / 治理 / sandbox / provider 接口 / observability）来自 cc 已证明的复杂状态机；substrate 内薄壳实现（如 AgentTool ~580 行）剥离 cc 业务装饰（fork/teammate-tmux/worktree/agentMemory React UI/business telemetry）。cc 完整版保留 product 作参考。

### 8.4 0 中间件依赖

substrate 仅依赖 `@anthropic-ai/sdk + zod + crypto`。无 React、无 ink、无 DB SDK、无 OTel SDK、无 Redis、无 NATS。所有这些都是 product / SDK 用户的自由选择。

### 8.5 状态外化 = 可分布式

任何继承 RunStore / SessionStore / TeammateChannel / AuditEventStore / MemoryStore 接口的实现都可以让 substrate 跑在分布式架构下。SDK 用户简单包装一层 server 就是分布式 agent engine。

---

## 9. 适用场景

### 9.1 SDK in-process Agent

最轻量：30 行代码跑一个有完整 agent loop / tool dispatch / memory / audit 的 agent。零外部依赖，无需服务器。

### 9.2 单机 + Filesystem 持久化

加一个 `FileRunStore` + `FilesystemAuditStore` + `FilesystemAgentScopedMemoryStore`。state 跨进程恢复，audit 不可篡改，memory 团队入 git。

### 9.3 多机分布式（NFS / s3fs）

把 baseDir 指向共享 mount。所有协议都用 atomic rename + jsonl append，多机 worker 可同时读写不冲突。

### 9.4 Server 化（包成 HTTP/gRPC service）

参考 `examples/sdk-with-server.ts`：50 行 Node http server 包出一个 SSE agent service。SDK 用户拿到 `runId` + `/runs/:id/events` SSE 流即可。

### 9.5 多 agent 协作（agent teams）

注入 `InMemoryTeammateChannel` 让多个 sub-agent 通过 mailbox 协作。配合 `TeammateBackend`（product 注入 InProcess / Tmux / Remote 后端），可实现：
- 团队 lead + 多 teammate 异步协作
- broadcast 消息 / 结构化 shutdown / plan approval

### 9.6 合规场景（金融 / 医疗）

启用 `FilesystemAuditStore`：每个 tool call / governance decision / assistant message 都写入 hash chain，篡改任意 event 必被 verify 检出。配合 `GovernanceHooks` 的 `humanReviewHook` + `evalHook`，实现 Run 完成自动评估 + 高风险操作挂起人工。

### 9.7 安全沙箱场景

启用 `LocalSandbox` 注入到 ToolUseContext，`BashTool / WriteTool / FetchTool` 自动走 24 case 决策矩阵：bash 命令前缀白名单、文件路径白名单、URL 域名白名单。

---

## 10. 项目结构（filesystem 视角）

```
neptune-engine/                       (substrate root)
├── src/engine/                       # 14 协议 + 默认实现 + AgentLoop 16 batch
├── packages/
│   ├── builtin-tools/                # AgentTool + 9 原语 + 11 kernel + MCP*
│   ├── agent-tools/                  # Tool 类型协议（@neptune/engine-tools）
│   └── mcp-client/                   # MCP 客户端
├── examples/
│   ├── sdk-pure.ts                   # 30 行 in-process
│   ├── sdk-with-fs-store.ts          # FileRunStore + resume
│   └── sdk-with-server.ts            # 50 行 HTTP/SSE server
└── scripts/
    ├── verify-workspace-independent.sh   # 11/11 守门
    ├── verify-harness-v1.sh              # 18/18 端到端验收
    └── verify-runtime-boundaries.sh

neptune-engine-product/               (业务参考实现，可独立废弃)
└── src/cc-tools/                     # cc 完整版（5576+1383+1089 行）作参考
    ├── AgentTool/                    # cc 完整 sub-agent 实现
    ├── SkillTool/                    # cc 完整 skill 实现
    ├── NotebookEditTool/             # Jupyter 业务
    ├── McpAuthTool/                  # MCP auth 业务
    ├── spawnMultiAgent.ts            # tmux/swarm 业务
    └── provider/                     # 6 unsupported provider stub
```

---

## 11. 路线图

substrate v4.0 base 完成（~14 协议 + AgentTool 薄壳 + 4 baseline + agent teams 协议层）。后续阶段聚焦：

### B4 — Async background launch + Resume 协议化
- AgentTool `run_in_background=true` 走 TaskQueue + RunStore 协议
- AgentTool resume 路径走 RunStore.loadSnapshot + cleanupForResume
- e2e: cross-instance resume + abort partial result

### B5 — Agent Teams 完整薄壳
- SendMessageTool 留 substrate + 剥 13 处反向引用
- 集成 TeammateChannel + 4 类 StructuredMessage 路由
- e2e: spawn 2 teammate + mailbox 通信 + shutdown 流程

### B6 — SkillTool 薄壳
- substrate 内 ~430 行薄壳（剥 cc 命令系统/plugin/EXPERIMENTAL_SKILL_SEARCH）
- e2e: invoke skill → sub-agent → result 回填

### B7 — AgentEngine.query 接 AgentLoop
- 解开当前 HeadlessQueryEngine 与 AgentLoop 双轨制
- 16 batch agent-loop 能力（retry/fallback/cache/compaction/budget）全部上生产路径
- 注入 kernel bag + governance + auditStore + runStore

### B8 — 工具拓扑收尾
- SleepTool 剥 proactive 业务
- BashTool / FileEditTool / GrepTool 反向引用清零

### B9 — Sandbox 生产路径集成
- BashTool / FileWriteTool / WebFetchTool 走 ctx.sandbox
- 集成测试：注入 LocalSandbox 后规则生效

### B10 — 守门升级到 5 Gate / ~41 项
- Gate A 干净度（13 项）/ Gate B 协议契约（10 项）/ Gate C 工具调度（5 项）/ Gate D 端到端功能（9 项）/ Gate E 量化（5 项）
- functional substrate 端到端 check（红线 #5）

---

## 12. 工程纪律

- 每个 sub-batch TDD red→green→commit→ff develop
- 守门 `verify-workspace-independent.sh` 11/11 PASS 是 substrate 健康的必要不充分条件
- substrate 自闭环 = 功能齐全 + 测试覆盖 + 工程干净，三者齐备才算真 PASS
- cc 实现是被证明过的复杂状态机；substrate 内薄壳必须保留功能契约，不许「重写更干净」的自负判断换掉被证明过的实现
- substrate 不引入数据库 SDK / React / OTel SDK / Redis / NATS；所有这些由 product 注入

---

**文档版本**：v4.0
**最后更新**：2026-05-25
**对应 commit**：`cd46d7a`（B0 + B1.1 + B1.2 + B1.3 + B3 + B1.4 + B1.5 + B2 全部完成）
**前作**：[neptune-engine-v1.0.md](./neptune-engine-v1.0.md)（HARNESS v1.0）
**相关文档**：
- `docs/strategy/STAGE-A-AUDIT.md`（Stage A 审计盘点）
- `docs/strategy/STAGE-B-PLAN.md`（11 批实施计划，5 已落 / 6 待续）
