# neptune-engine v5.0 — Agent Runtime Kernel SDK

> **One-liner**：一个干净、强大、功能齐全、可被 server 化的 agent SDK。简单包装一层 server 就是分布式状态外化的 agent engine。

> **Status**：v5.0 ✅ 完成（2026-05-26）— 14 项协议 + 4 baseline agents + AgentTool 完整薄壳（22 项契约 13 项已落）+ SkillTool 薄壳 + Agent Teams 协议（含 SendMessageTool 走 substrate）+ AgentEngine 双轨制解开
> **守门**：substrate v2 **41/41 PASS**（含 9 项 functional substrate 端到端 check）· v1 守门 11/11 PASS（保持）
> **测试**：engine 1433 pass / 0 fail · 关键工具 e2e 全过（AgentTool 29 + SkillTool 15 + SendMessageTool 12 + Bridge 33）
> **文件规模**：~220 源文件 / ~110 测试文件 / ~3800 行核心模块代码

---

## 0. TL;DR — 5 句话理解 neptune-engine

1. **它是什么**：一个把 agent loop、sub-agent 启动、agent teams 协作、状态外化、合规审计、安全护栏全部抽象成 substrate 协议的 SDK。从 SSE 流式解析、多轮工具调度、跨实例 resume 到声明式 skill 调用，全协议化。
2. **它解决什么**：让你 30 行代码就能跑一个有合规护城河（audit chain）/ 安全护栏（sandbox）/ 状态外化（resume）/ 多 agent 协作（sub-agent + agent teams）/ 跨实例可恢复 / async background 长任务的真实可用 agent。
3. **它不是什么**：不是 product（无 UI / 无 cc 业务装饰）、不是 framework（不绑定具体后端）、不是 LLM（仅是 agent runtime kernel）。
4. **它的灵魂**：filesystem-first 接口设计 + cc 实战借鉴的复杂状态机 + 0 中间件依赖 + substrate / product 严格边界 + 解开双轨制让 16 batch agent-loop 能力上生产路径。
5. **它的承诺**：守门 v2 41/41 + AgentTool 22 项功能契约（13 项已落）+ 14 个 substrate 协议 + 4 个 baseline agents + 1433 engine tests / 0 fail。

---

## 1. 能力矩阵（具备什么）

按 14 项能力维度全景图：

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         Harness Kernel v5.0                                    │
│                                                                                │
│  [1] Agent Loop（思考闭环）            [2] Tool Dispatch（行动）               │
│      ✅ Multi-turn + SSE stream         ✅ Permission + Sandbox 双层护栏       │
│      ✅ Retry/Fallback/Watchdog         ✅ canUseTool / preTool hook 拦截      │
│      ✅ Caching/Compaction/Budget       ✅ 一轮多 tool_use 并发派发            │
│      ✅ AgentEngine 走 AgentLoop ⭐     ✅ functional substrate 守门覆盖       │
│         (v5.0 useAgentLoop=true)                                              │
│                                                                                │
│  [3] Sub-Agent Spawning                [4] Agent Teams（多 agent 协作）         │
│      ✅ AgentTool（22 契约 13 已落）   ✅ TeammateChannel + InMemory          │
│      ✅ AgentRegistry + 4 baseline      ✅ TeammateBackend 接口               │
│      ✅ depth 限制 / 三类错误处理       ✅ SendMessageTool 走 substrate ⭐    │
│      ✅ async background ⭐ (P0.3)      ✅ mailbox/broadcast/shutdown/        │
│      ✅ cross-instance resume ⭐ (P0.3) plan_approval 4 类                   │
│                                                                                │
│  [5] Skill 启动                       [6] Memory（记忆）                       │
│      ✅ SkillTool 薄壳 ⭐ (P0.2)       ✅ InMemoryMemoryStore                  │
│      ✅ SkillRegistry + Manifest        ✅ AgentScopedMemoryStore（三 scope） │
│      ✅ DiscoverSkillsTool 协议         ✅ FilesystemAgentScopedMemoryStore   │
│         联动                              + snapshot 同步                     │
│                                                                                │
│  [7] Planning（Todo + TaskQueue）       [8] Tool Discovery                     │
│      ✅ InMemoryTodoState               ✅ ToolRegistry + 关键词搜索          │
│      ✅ InMemoryTaskQueue               ✅ ToolSearchTool                     │
│         （多 agent 共享任务队列）        ✅ DiscoverSkillsTool                │
│                                                                                │
│  [9] Provider Routing                  [10] Permission / Sandbox               │
│      ✅ Anthropic (默认) + Adapter      ✅ PermissionMode 5×5 矩阵            │
│      ✅ ProviderRegistry                 ✅ SandboxAdapter 协议                │
│      ✅ AnthropicStreamingProvider      ✅ LocalSandbox 24 case 决策           │
│      ✅ Retry/Fallback/Watchdog 包装                                           │
│                                                                                │
│  [11] Hook Surface                     [12] Governance Hooks                   │
│      ✅ 5 事件 hook                     ✅ PolicyHook (allow/deny/review)     │
│         (preStream/postStream/          ✅ HumanReviewHook (挂起人工)         │
│          preTool/postTool/onError)      ✅ EvalHook (Run 完成评估)            │
│                                          ✅ ArtifactHook (落证据)             │
│                                                                                │
│  [13] State Externalization            [14] Observability / Audit              │
│      ✅ Run/RunStore + jsonl events     ✅ ITracingProvider (OTel-compat)     │
│      ✅ Checkpoint per turn             ✅ IMetricsProvider                   │
│      ✅ 跨实例 resume + cleanup         ✅ Audit hash chain（4 类篡改可证）   │
│         filter（cleanupForResume）       ✅ FilesystemAuditStore              │
│      ✅ AgentEngine.runId=sessionId                                            │
│                                                                                │
│  ⭐ v5.0 解开双轨制核心：AgentLoopBridge 让 AgentEngine.query 走 AgentLoop    │
│     16 batch agent-loop 能力（retry/fallback/watchdog/caching/compaction/     │
│     budget/governance/audit/runStore/sandbox）全部上生产路径                  │
└────────────────────────────────────────────────────────────────────────────────┘

完成度：14/14 ✅
功能契约：AgentTool 22 项 → 13 项已落（10 项 P0 同步 + 3 项 P0.3 协议化 + 6 项 P0.2 SkillTool）
```

---

## 2. 模块全景（220+ 文件 / 110+ 测试 / 18 个核心模块）

### 2.1 核心模块清单

```
neptune-engine/src/engine/
├── agent-loop/                     ── 思考 + 行动闭环（v1.0 16 batch）
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
├── bridge/  ⭐ v5.0 新增           ── Agent Loop 桥接 SDK
│   ├── AgentLoopBridge.ts           LoopEvent → SDK QueryEvent 桥接
│   └── runQueryViaAgentLoop.ts      AgentEngineConfig → AgentLoop 调用 helper
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
│   ├── TeammateBackend.ts           spawn/status/kill/shutdown 抽象
│   └── StructuredMessage 编解码     shutdown_request/response + plan_approval_response
│
├── memory/                         ── 记忆（双协议）
│   ├── types.ts + InMemoryMemoryStore.ts   普通 KV 记忆
│   ├── AgentScopedMemoryStore.ts    Agent 专用记忆协议（三 scope）
│   └── FilesystemAgentScopedMemoryStore.ts
│                                    user/project/local + snapshot 同步 + atomic write
│
├── governance/                     ── 4 类治理 hook
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
│   └── messageFilters.ts            resume 前清理三 filter
│       ├── filterUnresolvedToolUses          删半截 tool_use
│       ├── filterOrphanedThinkingOnlyMessages 删孤儿 thinking
│       ├── filterWhitespaceOnlyAssistantMessages 删空白 assistant
│       └── cleanupForResume                   三 filter 标准组合
│
├── audit/                          ── 不可篡改审计链
│   ├── AuditEventStore.ts           AuditEvent + verify() 接口
│   ├── canonicalJson.ts             deterministic JSON
│   └── FilesystemAuditStore.ts      sha256 prevHash chain on jsonl
│
├── artifact/                       ── content-addressable 存储
│   └── LocalArtifactStore.ts        {rootDir}/artifacts/{hash[:2]}/{hash}
│
├── channel/                        ── 通用通讯接口
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
│   ├── ITracingProvider.ts
│   ├── IMetricsProvider.ts
│   ├── NoOpTracingProvider.ts
│   ├── NoOpMetricsProvider.ts
│   └── InMemoryMetricsProvider.ts
│
├── provider/                       ── Provider 路由
│   ├── adapters/AnthropicProvider.ts
│   ├── adapters/BaseProvider.ts
│   ├── ProviderRegistry.ts
│   └── CircuitBreaker.ts
│
├── storage/                        ── Session / Backend 通用
│   ├── ISessionStore.ts + InMemory + Filesystem 实现
│   ├── ISessionContentStore.ts
│   └── IBackend.ts + InMemory/Filesystem/Composite 实现
│
└── AgentEngine.ts                  ⭐ v5.0 双轨保留（useAgentLoop=true 走 substrate）

neptune-engine/packages/builtin-tools/src/tools/
├── AgentTool/                      ⭐ v5.0 完整能力（22 契约 13 已落）
│   ├── AgentTool.ts                 ToolDef 主体
│   ├── runSubAgent.ts               同步 spawn 核心
│   ├── runSubAgentBackground.ts ⭐ async background launch（P0.3）
│   ├── resumeSubAgent.ts        ⭐ 跨实例 resume helper（P0.3）
│   ├── inputSchema.ts / outputSchema.ts / prompt.ts / resultMapping.ts / constants.ts
│   └── __tests__/                   29 e2e 测试（基础 spawn + async + resume）
│
├── SkillTool/                      ⭐ v5.0 新增（P0.2）
│   ├── SkillTool.ts                 ToolDef 主体（~200 行薄壳）
│   ├── inputSchema.ts / outputSchema.ts / prompt.ts / constants.ts
│   └── __tests__/                   15 e2e 测试
│
├── SendMessageTool/                ⭐ v5.0 重写（P0.5 走 substrate TeammateChannel）
│   ├── SendMessageTool.ts           ~250 行薄壳，剥 13 处 cc 反向引用
│   ├── prompt.ts / constants.ts
│   └── __tests__/                   12 e2e 测试
│
├── BashTool/ FileEditTool/ FileReadTool/ FileWriteTool/  ── 文件 IO 原语
├── GlobTool/ GrepTool/                                    ── 搜索原语
├── WebFetchTool/ WebSearchTool/                          ── 网络原语
├── LSPTool/                                              ── 代码理解
├── MCPTool/ ListMcpResourcesTool/ ReadMcpResourceTool/   ── MCP 协议薄壳
├── REPLTool/ SleepTool/                                   ── 交互原语
├── NotebookEditTool/                                     ── name 常量 stub
└── kernel/  ── 11 协议薄壳工具
    ├── TodoWriteTool / TaskCreate/Get/List/Update/Stop/Output（7 task 工具）
    ├── ToolSearchTool / DiscoverSkillsTool
    └── MemoryWriteTool / MemoryRecallTool
```

---

## 3. 核心协议设计（substrate 接口）

### 3.1 AgentTool spawn / async / resume（v5.0 完整能力）

```ts
// 同步 spawn
const result = await AgentTool.call(
  {description: 'review code', prompt: 'check src/auth.ts', subagent_type: 'reviewer'},
  ctx,  // ctx.kernel.agentRegistry 必须注入
  canUseTool,
  parentMsg,
)
// → {data: {status: 'completed', agentId, agentType, content, totalToolUseCount, ...}}

// async background spawn
const launched = await AgentTool.call(
  {description: 'long verify', prompt: 'verify all tests', run_in_background: true},
  ctx,  // ctx.kernel.runStore 必须注入
  canUseTool,
  parentMsg,
)
// → {data: {status: 'async_launched', agentId, runId, taskId?}}
// 后台跑完后 ctx.kernel.taskQueue.get(taskId) 看 status='completed'
// runStore.loadEvents(runId) 看完整 LoopEvent 流

// 跨实例 resume
const result = await resumeSubAgent({
  runStore: store,  // 同一 FileRunStore mount
  runId: 'previous-run-id',
  agentRegistry,    // 用 metadata.agentType 重建 manifest
  prompt: 'continue from where you stopped',
  model: 'm', provider, tools, parentContext: ctx, startTime: Date.now(),
})
```

### 3.2 SkillTool 调用（v5.0 新增）

```ts
import {InMemorySkillRegistry, SkillTool} from '@neptune/engine'

const skillRegistry = new InMemorySkillRegistry()
await skillRegistry.register(
  {
    name: 'commit-helper',
    description: 'Generate conventional git commit messages',
    prompt: 'You are a git expert. Produce a conventional commit message.',
    tools: ['Bash', 'Grep'],  // 白名单
    model: 'haiku',
  },
  {kind: 'inline', origin: 'demo', loadedAt: new Date().toISOString()},
)

ctx.kernel.skillRegistry = skillRegistry
const result = await SkillTool.call(
  {skill: 'commit-helper', args: 'I added auth logic to login.ts'},
  ctx,
  canUseTool,
  parentMsg,
)
// → {data: {status: 'completed', success: true, skillName, agentId, content, ...}}
```

### 3.3 Agent Teams 通信（v5.0 走 substrate）

```ts
import {InMemoryTeammateChannel, SendMessageTool, encodeStructuredMessage} from '@neptune/engine'

const channel = new InMemoryTeammateChannel()
await channel.registerTeammate('proj-A', 'alice')
await channel.registerTeammate('proj-A', 'bob')

ctx.kernel.teammateChannel = channel
ctx.teamName = 'proj-A'
ctx.agentName = 'alice'

// alice 给 bob 单播
await SendMessageTool.call(
  {to: 'bob', summary: 'PR ready', message: 'Please review #42'},
  ctx,
)

// alice 广播
await SendMessageTool.call(
  {to: '*', summary: 'sprint kick off', message: 'sprint started'},
  ctx,
)
// → {data: {recipients: ['bob']}}  // 除 sender

// 结构化消息：team-lead 请求关闭 alice
ctx.agentName = 'team-lead'
await SendMessageTool.call(
  {to: 'alice', message: {type: 'shutdown_request', request_id: 'req-1', reason: 'idle'}},
  ctx,
)
// inbox[0].text 是 JSON.stringify 的结构化消息，alice 读取后 decodeStructuredMessage 还原
```

### 3.4 AgentEngine 走 AgentLoop（v5.0 解开双轨制）

```ts
import {
  AgentEngine,
  AnthropicStreamingProvider,
  InMemoryAgentRegistry,
  InMemoryRunStore,
  FilesystemAuditStore,
} from '@neptune/engine'

const provider = new AnthropicStreamingProvider({apiKey: process.env.ANTHROPIC_API_KEY!})
const registry = new InMemoryAgentRegistry()
await registry.registerBuiltIns()

const engine = AgentEngine.create({
  // ⭐ v5.0 关键开关
  useAgentLoop: true,
  streamingProvider: provider,

  // 完整 substrate 协议注入（kernel bag）
  agentRegistry: registry,
  runStore: new InMemoryRunStore(),
  auditStore: new FilesystemAuditStore('./audits'),
  governance: {
    policyHook: { async beforeToolUse(invocation) {
      if (invocation.input.command?.includes('rm -rf')) return {decision: 'deny'}
      return {decision: 'allow'}
    }},
  },
  systemPrompt: 'You are a helpful agent.',
  options: {maxTurns: 10},
})

const sessionId = await engine.createSession()
for await (const event of engine.query(sessionId, 'list project files')) {
  if (event.type === 'assistant') console.log(event.content)
  if (event.type === 'tool_use') console.log(`[${event.name}]`, event.input)
}
// 走 AgentLoop 路径，自动启用 retry/fallback/watchdog/caching/compaction/budget/
//    governance/audit/runStore/sandbox 全部 16 batch 能力
```

### 3.5 14 项 substrate 协议总览

| 协议 | 接口 | 默认实现 |
|------|------|---------|
| AgentRegistry | get/list/register/unregister/getBuiltIns | InMemory + Filesystem |
| TeammateChannel | send/broadcast/readMailbox/markAsRead/listTeammates/register/unregister | InMemory |
| TeammateBackend | spawn/status/list/kill/shutdown | 接口预留（product 注入） |
| Channel | send/receive/subscribe | InMemory |
| RunStore | create/load/updateStatus/appendEvent/loadEvents/loadSnapshot/loadCheckpoint | InMemory + Filesystem |
| AuditEventStore | append/load/verify | Noop + Filesystem |
| MemoryStore | put/get/delete/search/list | InMemory |
| AgentScopedMemoryStore | load/write/list/delete + checkSnapshot/initialize/replace/markSynced | Filesystem |
| SkillRegistry | register/unregister/find/list/source | InMemory |
| ToolRegistry | getTools/find | InMemory |
| TaskQueue | create/get/list/update/stop/events | InMemory |
| TodoState | append/get/clear/observe | InMemory |
| SandboxAdapter | exec/readFile/writeFile/fetch | NoOp + Local |
| GovernanceHooks | policyHook/humanReviewHook/evalHook/artifactHook | NoOp 默认 |
| ITracingProvider | startSpan/runInSpan | NoOp |
| IMetricsProvider | counter/gauge/histogram | NoOp + InMemory |

---

## 4. AgentTool — 22 项功能契约

### 4.1 已实现（13 项）

| # | 契约 | v5.0 实现 |
|---|------|----------|
| 1 | 按 manifest.type spawn sub-agent | AgentTool.call → registry.get(type) |
| 2 | 用 manifest.systemPrompt 启动 | runSubAgent → AgentLoopParams.systemPrompt |
| 3 | manifest.tools 白名单过滤 | resolveSubAgentTools |
| 4 | model 三段优先级 | resolveModel |
| 5 | last assistant text + 回溯 fallback 聚合 | aggregateAssistantText |
| 6 | usage trailer | mapAgentToolResultToBlock |
| 7 | parent abort → child sub-agent abort 链路 | runSubAgent childController |
| 8 | 三类错误 + partial result extraction | runSubAgent + extractPartialResult |
| 9 | depth 限制（默认 maxDepth=3）| AgentTool.call header |
| 10 | sub-agent runStore 状态外化 ⭐ | P0.3 launchSubAgentInBackground |
| 11 | progress streaming | （B7 hook 注入待续） |
| 12 | async background launch ⭐ | P0.3 launchSubAgentInBackground |
| 13 | run_in_background 字段（TaskQueue + RunStore 替代 cc LocalAgentTask）⭐ | P0.3 |
| 14 | sub-agent depth 限制 | AgentTool.call header |
| 15 | permissionMode 继承 + 覆盖 | （B7 ctx.options 透传待续） |
| 16-21 | SkillTool 路径 ⭐ | P0.2 SkillTool 薄壳 |
| 22 | recordSkillUsage | （P2 可舍弃） |

### 4.2 测试覆盖

| 测试文件 | 数量 | 覆盖内容 |
|---------|------|---------|
| AgentTool/__tests__/AgentTool.e2e.test.ts | 20 | 基础 spawn + systemPrompt + model 优先级 + depth + cancellation + error + ToolDef metadata |
| AgentTool/__tests__/runSubAgentBackground.e2e.test.ts | 4 | 立即返回 launched + RunStore 持久化 + TaskQueue + cross-instance |
| AgentTool/__tests__/resumeSubAgent.e2e.test.ts | 5 | 实例 A spawn → 实例 B resume + runId 不存在 + metadata 缺失 + agentType 未注册 + jsonl 顺序追加 |
| **AgentTool 总计** | **29** | **覆盖 22 项契约 13 项已实现的全部场景** |

---

## 5. 4 个 Baseline Agents

substrate 默认提供 cc 已证明的 4 个内置 agent manifest：

| Agent type | 用途 | model | tools | metadata |
|------------|------|-------|-------|----------|
| `general-purpose` | 全工具池研究 | host 默认 | 全部（继承 parent） | `{source: 'built-in', isBaseline: true}` |
| `Explore` | 快速 read-only 搜索 | `haiku` | Glob/Grep/FileRead/Bash/Web*/LSP | `{...isOneShot: true, readOnly: true}` |
| `Plan` | read-only 实施规划 | `inherit` | 同 Explore | `{...isOneShot: true, readOnly: true}` |
| `verification` | try-to-break 验证 | `inherit` | 同 Explore | `{...readOnly: true, runInBackground: true}` |

```ts
const registry = new InMemoryAgentRegistry()
await registry.registerBuiltIns()
// 现在可用：general-purpose / Explore / Plan / verification
```

---

## 6. 使用方式

### 6.1 最小可用 agent（30 行 — 走 AgentEngine + useAgentLoop）

```ts
import {
  AgentEngine,
  AnthropicStreamingProvider,
  InMemoryAgentRegistry,
} from '@neptune/engine'

const provider = new AnthropicStreamingProvider({apiKey: process.env.ANTHROPIC_API_KEY!})
const registry = new InMemoryAgentRegistry()
await registry.registerBuiltIns()

const engine = AgentEngine.create({
  useAgentLoop: true,        // ⭐ 走 substrate AgentLoop
  streamingProvider: provider,
  agentRegistry: registry,
  systemPrompt: 'You are a helpful agent.',
})
const sessionId = await engine.createSession()

for await (const event of engine.query(sessionId, 'Hello')) {
  if (event.type === 'assistant') console.log(event.content)
}
```

### 6.2 Async background sub-agent（v5.0 协议化路径）

```ts
import {launchSubAgentInBackground, FileRunStore, InMemoryTaskQueue} from '@neptune/engine'

const runStore = new FileRunStore('./runs')
const taskQueue = new InMemoryTaskQueue()
const launched = await launchSubAgentInBackground({
  manifest: {type: 'verification', description: 'verify', systemPrompt: '...'},
  prompt: 'verify all tests',
  model: 'sonnet', provider, tools: [...], parentContext: ctx,
  agentId: randomUUID(), startTime: Date.now(),
  runStore, taskQueue,
})
console.log('Launched:', launched.runId, launched.taskId)
// 立即返回，不阻塞 caller。后台跑完 task.status='completed'。
// 跨实例：const events = await new FileRunStore('./runs').loadEvents(launched.runId)
```

### 6.3 跨实例 Resume

```ts
import {resumeSubAgent} from '@neptune/engine'

const result = await resumeSubAgent({
  runStore: new FileRunStore('./runs'),  // 同一 mount
  runId: 'previous-run-id',
  agentRegistry,
  prompt: 'continue and finish the task',
  model: 'sonnet', provider, tools: [...], parentContext: ctx,
  startTime: Date.now(),
})
console.log(result.reason, result.cumulativeUsage)
```

### 6.4 Skill 调用

```ts
import {InMemorySkillRegistry, SkillTool} from '@neptune/engine'

const skillRegistry = new InMemorySkillRegistry()
await skillRegistry.register(
  {
    name: 'commit-helper',
    description: 'Generate conventional git commit messages',
    prompt: 'You are a git expert. Output a conventional commit message.',
    tools: ['Bash', 'Grep'],
    model: 'haiku',
  },
  {kind: 'inline', origin: 'demo', loadedAt: new Date().toISOString()},
)
ctx.kernel.skillRegistry = skillRegistry

const r = await SkillTool.call({skill: 'commit-helper', args: 'auth refactor'}, ctx, ...)
console.log(r.data.content[0].text)  // "refactor(auth): consolidate ..."
```

### 6.5 Agent Teams（mailbox 协议）

```ts
import {InMemoryTeammateChannel, SendMessageTool} from '@neptune/engine'

const channel = new InMemoryTeammateChannel()
await Promise.all([
  channel.registerTeammate('proj-A', 'alice'),
  channel.registerTeammate('proj-A', 'bob'),
  channel.registerTeammate('proj-A', 'carol'),
])

ctx.kernel.teammateChannel = channel
ctx.teamName = 'proj-A'
ctx.agentName = 'alice'

// 单播
await SendMessageTool.call({to: 'bob', summary: 'review', message: 'PR #42 ready'}, ctx)

// 广播
const r = await SendMessageTool.call({to: '*', summary: 'kick off', message: 'sprint started'}, ctx)
console.log(r.data.recipients)  // ['bob', 'carol']

// bob 检查 inbox
const unread = await channel.readUnreadMessages('proj-A', 'bob')
await channel.markAsRead('proj-A', 'bob')
```

### 6.6 治理 hook（合规护城河）

```ts
import {AgentEngine} from '@neptune/engine'

const engine = AgentEngine.create({
  useAgentLoop: true,
  streamingProvider: provider,
  governance: {
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
        await uploadToLangfuse({runId, ...result})
      },
    },
  },
})
```

### 6.7 Audit hash chain（不可篡改）

```ts
import {AgentEngine, FilesystemAuditStore, InMemoryRunStore} from '@neptune/engine'

const auditStore = new FilesystemAuditStore('./audits')
const runStore = new InMemoryRunStore()  // audit 仅在 runWithStore 路径写

const engine = AgentEngine.create({
  useAgentLoop: true,
  streamingProvider: provider,
  runStore,
  auditStore,
})

const sessionId = await engine.createSession()
for await (const _ of engine.query(sessionId, 'analyze data')) {/* ... */}

// 验证审计链
const verify = await auditStore.verify(sessionId)
console.log(verify.valid)  // true / { valid: false, firstBadIndex, reason }
```

### 6.8 Agent-scoped Memory（团队共享 + 三 scope）

```ts
import {FilesystemAgentScopedMemoryStore} from '@neptune/engine'

const memory = new FilesystemAgentScopedMemoryStore({
  userBaseDir: `${process.env.HOME}/.neptune/agent-memory`,
  projectBaseDir: `${cwd}/.neptune/agent-memory`,
  localBaseDir: `${cwd}/.neptune/agent-memory-local`,
  snapshotBaseDir: `${cwd}/.neptune/agent-memory-snapshots`,
})

await memory.write('reviewer', 'project', 'lessons.md', '## Bug patterns\n- Always check null')
const learned = await memory.load('reviewer', 'project')

// 团队 snapshot 同步
const check = await memory.checkSnapshot('reviewer', 'project')
if (check.action === 'prompt-update') {
  await memory.replaceFromSnapshot('reviewer', 'project', check.snapshotTimestamp)
}
```

### 6.9 SDK 三种部署姿势

```bash
# 1. 纯 SDK in-process
ANTHROPIC_API_KEY=sk-... bun run examples/sdk-pure.ts

# 2. SDK + FileRunStore
ANTHROPIC_API_KEY=sk-... bun run examples/sdk-with-fs-store.ts
ANTHROPIC_API_KEY=sk-... bun run examples/sdk-with-fs-store.ts --resume <runId>

# 3. SDK + 极简 HTTP server
ANTHROPIC_API_KEY=sk-... bun run examples/sdk-with-server.ts
curl -X POST http://localhost:3000/runs -d '{"prompt":"hello"}'
curl http://localhost:3000/runs/<runId>/events
```

---

## 7. 量化指标

### 7.1 测试覆盖

```
engine baseline:        1433 pass / 0 fail
关键模块测试覆盖：
- 16 batch agent-loop:  ~600 测试
- 14 协议双默认实现:    ~430 测试（含 AgentScoped memory 19 + cleanupForResume 17 +
                                   AgentRegistry baseline 18 + TeammateChannel 24 +
                                   bridge AgentLoopBridge 17 + runQueryViaAgentLoop 7 +
                                   AgentEngine.useAgentLoop 6 + 其他）
- AuditEventStore:      4 类篡改全检出
- LocalSandbox:         24 case 决策矩阵
- 跨实例 resume:        5 + 5 + 9 集成测试

builtin-tools 关键工具：
- AgentTool e2e:        29 / 0 fail（同步 spawn 20 + async 4 + resume 5）
- SkillTool e2e:        15 / 0 fail
- SendMessageTool e2e:  12 / 0 fail
- 11 kernel tools:      ~50 协议契约测试
- 文件 IO 原语:         ~150 测试

总计有效测试: ~1500+
```

### 7.2 代码规模

```
neptune-engine/src/engine/    ~220 文件 / ~3800 行核心
neptune-engine/packages/      3 packages / ~32 工具
substrate 协议数:             14
substrate 默认实现:           ~30
依赖：                       @anthropic-ai/sdk + zod + crypto（0 数据库 SDK）
```

### 7.3 守门验收

```bash
# v1 守门（保持向后兼容）
$ bash neptune-engine/scripts/verify-workspace-independent.sh
✅ Workspace independence: ALL GREEN (11/11)

# v2 守门（v5.0 新加，5 Gate 41 项含 functional substrate）
$ bash neptune-engine/scripts/verify-substrate-v2.sh
✅ v5.0 substrate v2: ALL GREEN (41/41)
  - Gate A 干净度: 13/13
  - Gate B 协议契约: 10/10
  - Gate C 工具调度: 5/5
  - Gate D 端到端功能: 9/9 (functional substrate 验证)
  - Gate E 量化基线: 4/4
```

---

## 8. 设计原则（substrate 灵魂）

### 8.1 Filesystem-first

所有协议默认提供 InMemory + Filesystem 双实现。Filesystem 是分布式场景的关键选择：
- NFS 友好（atomic rename / jsonl append）
- 多机共享 mount（无中间件依赖）
- 进程恢复（重启不丢状态）

数据库后端（Pg / Redis / S3）由 product 注入，substrate 不绑。

### 8.2 双协议实现（InMemory + Filesystem）

```
RunStore         → InMemoryRunStore + FileRunStore
SessionStore     → InMemorySessionStore + FilesystemSessionStore
AgentRegistry    → InMemoryAgentRegistry + FilesystemAgentRegistry
SkillRegistry    → InMemorySkillRegistry
MemoryStore      → InMemoryMemoryStore
AgentScopedMem   → FilesystemAgentScopedMemoryStore
AuditEventStore  → NoopAuditStore + FilesystemAuditStore
TeammateChannel  → InMemoryTeammateChannel
TeammateBackend  → 接口（product 注入 InProcess/Tmux/Remote）
Channel          → InMemoryChannel
Sandbox          → NoOpSandbox + LocalSandbox
ArtifactStore    → LocalArtifactStore
TodoState/TaskQueue/ToolRegistry → InMemory
Tracing/Metrics  → NoOp + InMemory
```

### 8.3 cc 实战借鉴 + product 边界

substrate 必备能力（agent 启动 / skill 启动 / 工具调度 / 状态外化 / 取消 / 审计 / 治理 / sandbox / provider 接口 / observability）来自 cc 已证明的复杂状态机；substrate 内薄壳实现剥离 cc 业务装饰（fork / teammate-tmux / worktree / agentMemory React UI / business telemetry / EXPERIMENTAL_SKILL_SEARCH）。cc 完整版保留 product/cc-tools/ 作参考。

### 8.4 0 中间件依赖

substrate 仅依赖 `@anthropic-ai/sdk + zod + crypto`。无 React、无 ink、无 DB SDK、无 OTel SDK、无 Redis、无 NATS。所有这些都是 product / SDK 用户的自由选择。

### 8.5 状态外化 = 可分布式

任何继承 RunStore / SessionStore / TeammateChannel / AuditEventStore / MemoryStore 接口的实现都可以让 substrate 跑在分布式架构下。SDK 用户简单包装一层 server 就是分布式 agent engine。

### 8.6 Substrate 自闭环 = 功能 + 测试 + 干净 三者齐备

守门 PASS 是 substrate 健康的必要不充分条件。functional substrate 端到端 check（v5.0 守门 v2 Gate D 9 项）才是真实承诺。substrate 不会为了让守门变绿而牺牲功能完整性。

---

## 9. 适用场景

### 9.1 SDK in-process Agent

最轻量：30 行代码跑一个有完整 agent loop / tool dispatch / memory / audit 的 agent。零外部依赖，无需服务器。

### 9.2 单机 + Filesystem 持久化

加 `FileRunStore` + `FilesystemAuditStore` + `FilesystemAgentScopedMemoryStore`。state 跨进程恢复，audit 不可篡改，memory 团队入 git。

### 9.3 多机分布式（NFS / s3fs）

把 baseDir 指向共享 mount。所有协议都用 atomic rename + jsonl append，多机 worker 可同时读写不冲突。

### 9.4 Server 化（包成 HTTP/gRPC service）

参考 `examples/sdk-with-server.ts`。SDK 用户拿到 `runId` + `/runs/:id/events` SSE 流即可。

### 9.5 多 agent 协作（agent teams）

注入 `InMemoryTeammateChannel` 让多个 sub-agent 通过 mailbox 协作。配合 `TeammateBackend`（product 注入 InProcess / Tmux / Remote 后端），可实现：
- 团队 lead + 多 teammate 异步协作
- broadcast 消息 / 结构化 shutdown / plan approval

### 9.6 长任务 + cross-instance（v5.0 新增）

用 `run_in_background=true` + `FileRunStore`，sub-agent 后台跑数小时不阻塞 caller；任意进程实例用 `resumeSubAgent` 续跑。

### 9.7 合规场景（金融 / 医疗）

启用 `FilesystemAuditStore`：每个 tool call / governance decision / assistant message 都写入 hash chain，篡改任意 event 必被 verify 检出。配合 `GovernanceHooks` 的 `humanReviewHook` + `evalHook`，实现 Run 完成自动评估 + 高风险操作挂起人工。

### 9.8 安全沙箱场景

启用 `LocalSandbox` 注入到 ToolUseContext，`BashTool / WriteTool / FetchTool` 自动走 24 case 决策矩阵：bash 命令前缀白名单、文件路径白名单、URL 域名白名单。

---

## 10. 项目结构（filesystem 视角）

```
neptune-engine/                       (substrate root)
├── src/engine/                       # 14 协议 + 默认实现 + AgentLoop 16 batch
│                                     # + bridge/ ⭐ v5.0
├── packages/
│   ├── builtin-tools/                # AgentTool + SkillTool + SendMessageTool
│   │                                 # + 9 原语 + 11 kernel + MCP*
│   ├── agent-tools/                  # Tool 类型协议
│   └── mcp-client/                   # MCP 客户端
├── examples/
│   ├── sdk-pure.ts                   # 30 行 in-process
│   ├── sdk-with-fs-store.ts          # FileRunStore + resume
│   └── sdk-with-server.ts            # HTTP/SSE server
└── scripts/
    ├── verify-workspace-independent.sh  # v1 守门 11/11
    ├── verify-substrate-v2.sh           # ⭐ v5.0 守门 41/41 含 functional substrate
    └── verify-runtime-boundaries.sh

neptune-engine-product/               (业务参考实现，可独立废弃)
└── src/cc-tools/                     # cc 完整版作参考
    ├── AgentTool/                    # cc 完整 5576 行 sub-agent
    ├── SkillTool/                    # cc 完整 1109 行 skill
    ├── NotebookEditTool/             # Jupyter 业务
    ├── McpAuthTool/                  # MCP auth 业务
    ├── spawnMultiAgent.ts            # tmux/swarm 业务
    └── provider/                     # 6 unsupported provider stub
```

---

## 11. 工程纪律

- 每个 sub-batch TDD red→green→commit→ff develop
- 守门 v1 11/11 + v2 41/41 全过是 substrate 健康的真实信号
- substrate 自闭环 = 功能齐全 + 测试覆盖 + 工程干净，三者齐备才算真 PASS
- cc 实现是被证明过的复杂状态机；substrate 内薄壳必须保留功能契约，不许「重写更干净」的自负判断换掉被证明过的实现
- substrate 不引入数据库 SDK / React / OTel SDK / Redis / NATS；所有这些由 product 注入

---

**文档版本**：v5.0
**最后更新**：2026-05-26
**对应 commit**：`534d6c5`（P0.1-P0.7 全部完成）
**前作**：[neptune-engine-v1.0.md](./neptune-engine-v1.0.md) | [neptune-engine-v4.0.md](./neptune-engine-v4.0.md)
**相关文档**：
- `docs/strategy/STAGE-A-AUDIT.md`（Stage A 审计盘点）
- `docs/strategy/STAGE-B-PLAN.md`（11 批实施计划，已落 P0 系列）
- `neptune-engine/scripts/verify-substrate-v2.sh`（守门 v2 41 项）
