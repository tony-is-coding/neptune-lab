# neptune-engine v1.0 — Agent Runtime Kernel SDK

> **One-liner**：一个干净、强大、可被 server 化的 agent SDK。简单包装一层 server 就是分布式状态外化的 agent engine。

> **Status**：HARNESS v1.0 ✅ 完成（2026-05）
> **守门**：9/9 PASS · **端到端验收**：18/18 PASS · **测试**：1393 pass / 0 fail
> **文件规模**：193 源文件 / 100 测试文件 / 2697 行核心模块代码

---

## 0. TL;DR — 5 句话理解 neptune-engine

1. **它是什么**：一个把 cc 风格 agent loop 抽象成 substrate 协议的 SDK，可独立 import、可包 server、可分布式部署。
2. **它解决什么**：让你 30 行代码就能跑一个有合规护城河（audit chain）/ 安全护栏（sandbox）/ 状态外化（resume）的真实可用 agent。
3. **它不是什么**：不是 product（无 UI / 无 cc 业务）、不是 framework（不绑定具体后端）、不是 LLM（仅是 agent runtime）。
4. **它的灵魂**：filesystem-first 接口设计 + cc 实战借鉴 + 0 中间件依赖。
5. **它的承诺**：守门 9/9 + 端到端验收 18/18 + 1393 tests / 0 fail。

---

## 1. 能力矩阵（具备什么）

按 12 项能力维度全景图：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Harness Kernel v1.0                         │
│                                                                          │
│  [1] Agent Loop（思考闭环）       [2] Tool Dispatch（行动）              │
│      ✅ Multi-turn + SSE stream    ✅ Permission + Sandbox 双层护栏      │
│      ✅ Retry/Fallback/Watchdog    ✅ canUseTool / preTool hook 拦截     │
│      ✅ Caching/Compaction/Budget                                       │
│                                                                          │
│  [3] Memory（记忆）               [4] Planning（Todo + TaskQueue）       │
│      ✅ InMemory + Filesystem      ✅ InMemoryTodoState                  │
│      ✅ 跨实例 / NFS 友好          ✅ InMemoryTaskQueue                  │
│                                                                          │
│  [5] Skill（扩展能力）            [6] Tool Discovery（工具发现）         │
│      ✅ Manifest + Formatter       ✅ ToolRegistry + 关键词搜索          │
│      ✅ InMemory + Filesystem 注册                                      │
│                                                                          │
│  [7] Multi-Agent Channel          [8] Provider Routing                  │
│      ✅ 接口 + InMemoryChannel      ✅ Anthropic + ProviderRegistry      │
│      （具体后端 product 注入）      （6 unsupported product 注入）       │
│                                                                          │
│  [9] Permission / Sandbox         [10] Hook Surface                     │
│      ✅ PermissionMode 5×5 矩阵    ✅ 5 事件 hook（pre/post stream/tool）│
│      ✅ SandboxAdapter 协议        ✅ 4 治理 hook（Policy/Review/Eval/   │
│      ✅ LocalSandbox 规则护栏          Artifact）                        │
│                                                                          │
│  [11] Observability / Audit       [12] Workspace 独立性                 │
│      ✅ ITracingProvider 接入       ✅ engine 0 数据库依赖                │
│      ✅ IMetricsProvider 接入       ✅ builtin-tools 9 工具反向引用 = 0  │
│      ✅ Audit hash chain（4 类      ✅ shared 7 zod contracts             │
│         篡改可证明）                                                     │
└─────────────────────────────────────────────────────────────────────────┘

完成度：12/12 ✅
```

---

## 2. 模块全景（193 文件 / 100 测试 / 16 个核心模块）

### 2.1 核心模块清单

```
neptune-engine/src/engine/
├── agent-loop/                     ── 思考 + 行动闭环
│   ├── loop/AgentLoop.ts            完整 multi-turn 主循环（runWithStore + resume）
│   ├── sse/                         Anthropic SSE 流解析
│   ├── message/                     Message 序列化 / ContentBlock 规范化
│   ├── dispatcher/                  ToolDispatcher + PermissionMode 集成
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
├── governance/                     ── 4 类治理 hook（合规护城河）
│   ├── PolicyHook.ts                工具调用前策略决策（allow/deny/require_review）
│   ├── HumanReviewHook.ts           require_review 时挂起人工
│   ├── EvalHook.ts                  Run 完成后评估
│   └── ArtifactHook.ts              Tool 输出落 EvidenceArtifact
│
├── permissions/                    ── 安全
│   ├── PermissionMode.ts            5 mode × 5 category 决策矩阵
│   └── （RBAC / Audit / ReadOnly Delegate）
│
├── sandbox/                        ── 规则级安全护栏（cc 实战做法）
│   ├── SandboxAdapter.ts            exec/readFile/writeFile/fetch 接口
│   ├── LocalSandbox.ts              bash prefix + path allowlist + domain allowlist
│   └── NoOpSandbox.ts               显式 dangerous mode opt-in
│
├── run/                            ── State 外化（Stateless 核心）
│   ├── Run.ts                       Run / RunStatus / RunSnapshot / Checkpoint 类型 + RunStore 接口
│   ├── InMemoryRunStore.ts          进程内单实例
│   ├── FileRunStore.ts              {rootDir}/{runId}/{run.json + events.jsonl}
│   └── rebuildSnapshot.ts           从 events 重建 messages（Resume 核心）
│
├── audit/                          ── 不可篡改审计链
│   ├── AuditEventStore.ts           AuditEvent + verify() 接口
│   ├── canonicalJson.ts             deterministic JSON（key 字典序）
│   ├── NoopAuditStore.ts            占位（不持久化）
│   └── FilesystemAuditStore.ts      sha256 hash chain on jsonl
│
├── artifact/                       ── content-addressable 存储
│   └── LocalArtifactStore.ts        {rootDir}/artifacts/{hash[:2]}/{hash}
│
├── channel/                        ── 多 agent 通讯接口
│   ├── Channel.ts                   send/receive/subscribe 接口
│   └── InMemoryChannel.ts           FIFO + broadcast 双语义
│
├── agent-registry/                 ── Agent manifest 注册表
│   ├── AgentRegistry.ts             AgentManifest + 接口
│   ├── InMemoryAgentRegistry.ts
│   └── FilesystemAgentRegistry.ts   每 agent 一个 {type}.agent.json
│
├── storage/                        ── Session/Content/Memory 存储
│   ├── ISessionStore + IMemoryStore + ISessionContentStore   接口
│   ├── InMemory* + Filesystem*      6 个默认实现（双默认）
│   └── （Pg/Redis/SQLite 已迁 product）
│
├── skill/ + todo/ + task-queue/    ── Phase A 五大 protocol
│   └── 全部 InMemory 默认实现
│
├── tool-registry/                  ── 工具注册表 + 关键词搜索
│
├── observability/                  ── OTel-compatible 可观测性
│   ├── Span / Counter / Gauge / Histogram / Timer 类型
│   ├── ITracingProvider + IMetricsProvider 接口
│   └── NoOp + InMemoryMetricsProvider 默认
│
├── log/                            ── 结构化日志（含 MDC）
│
├── utils/                          ── 工具函数（cc 实战借鉴）
│   ├── sanitizePath.ts              alphanum + 200 字符 + djb2 hash
│   ├── atomicWrite.ts               tmp + rename
│   ├── jsonl.ts                     append-only + 末行截断容错
│   └── zodToJsonSchema.ts           Phase B 工具自动转 JSON Schema
│
└── （Session / SessionManager / EventBus / 等）

shared/types/contracts/             ── 7 个稳定 zod schema（跨层协议）
├── Run.ts / ToolInvocation.ts / Artifact.ts / EvidenceArtifact.ts
├── AuditEvent.ts / HumanReview.ts / PolicyDecision.ts
└── 全部 zod .passthrough()，product 可扩展私有字段

packages/                           ── 子包
├── builtin-tools/                   20 个工具（含 11 kernel tools + 9 业务工具）
├── agent-tools/                     工具基础类型（@neptune/engine-tools）
└── mcp-client/                      MCP SDK 集成
```

### 2.2 builtin-tools 工具清单

**Phase B kernel tools（11 个，纯 substrate）**：
- `TodoWriteTool` — 任务列表
- `TaskCreate / Get / List / Update / Stop / Output` — 6 个 Task 管理工具
- `ToolSearchTool` — 工具发现
- `DiscoverSkillsTool` — Skill 发现
- `MemoryWrite / Recall` — 记忆读写

**业务/原语工具（9 个，部分含 product 业务依赖）**：
- `BashTool` — Shell 执行（已 0 反向引用，待接 ctx.sandbox）
- `FileRead / FileWrite / FileEdit` — 文件操作
- `Glob / Grep` — 文件搜索
- `WebFetch / WebSearch` — 网络
- `LSPTool` — LSP 协议

**待剥离工具（6 个，深度耦合 cc）**：
- `AgentTool` — sub-agent 启动（cc query() 主循环耦合，post v1.0 处理）
- `SkillTool` — Skill 调用
- `NotebookEditTool` — Jupyter 业务
- `MCPTool / McpAuthTool / ListMcpResourcesTool / ReadMcpResourceTool` — MCP 业务
- `REPLTool / SendMessageTool / SleepTool` — 业务工具

---

## 3. 7 个核心特性（强大在哪里）

### 3.1 完整 Multi-Turn Agent Loop（cc 同款，无 product 杂质）

```ts
const gen = AgentLoop.run({
  provider: anthropicProvider,
  model: 'claude-sonnet-4-20250514',
  messages: [userMessage],
  context: ctx,
})
for await (const event of gen) {
  // event: stream_request_start | assistant_message | tool_update |
  //        usage_update | governance_decision | error
}
```

**包含 cc 全部能力**：
- SSE 流解析（thinking / tool_use / text 三类 block）
- Multi-turn 主循环（tool_use → tool_result → 续 turn）
- 自动 Retry（429 / 5xx 指数退避 + jitter）
- 自动 Fallback（404 model not found → backup model）
- StreamWatchdog（idle / stall 超时检测）
- Prompt Caching（cache_control 自动打 breakpoint）
- History Compaction（长会话自动压缩 tool_result）
- Budget Tracking + CircuitBreaker（防失控）
- 100ms 内响应 cancel signal

### 3.2 Stateless 状态外化（核心创新）

```ts
// engine A
const store = new FileRunStore('./runs')
const run = await store.create({metadata: {...}})
for await (const event of AgentLoop.runWithStore({
  ...params,
  runStore: store,
  runId: run.id,
})) {
  // events 自动持久化到 ./runs/{runId}/events.jsonl
}

// engine B（完全独立实例 / 不同进程 / 不同机器）
const storeB = new FileRunStore('./runs') // NFS 共享路径
for await (const event of AgentLoop.resume(run.id, {
  provider: ..., runStore: storeB, context: ..., model: ...
})) {
  // 从 events.jsonl 重建 messages 续跑
}
```

**关键机制**：
- jsonl 行级 append-only（POSIX/NFS atomic < 4KB）
- run.json atomic rename（tmp + rename）
- 跨实例 cache miss 时 reload 末行
- Resume 借鉴 cc：snapshot 是从 events 重建的中间产物（不持久化）

### 3.3 合规护城河（Audit Hash Chain）

```ts
const auditStore = new FilesystemAuditStore('./runs')
for await (const event of AgentLoop.runWithStore({
  ..., runStore, runId, auditStore,
})) {
  // 关键事件（assistant_message / tool_result / governance_decision /
  // error）自动 append 到 audit chain
}

// 任意时刻 verify
const result = await auditStore.verify(runId)
// {valid: true} 或 {valid: false, firstBadIndex, reason}
```

**强度**：
- `hash = sha256(prevHash + canonicalJson({index, payload, ts}))`
- canonical JSON：key 字典序排序，跨实例 hash 一致
- 篡改任意中间 event 必检出（4 类场景全测试）：payload 改 / hash 改 / event 删 / 末行改
- 0 外部依赖（仅 node:crypto）

### 3.4 Sandbox 安全护栏（规则级，对齐 cc 实战）

```ts
const sandbox = new LocalSandbox({
  workingDirAllowlist: ['/repo'],
  bashPrefixSafety: true,
  fetchHostAllowlist: ['*.example.com'],
  fetchHostDenylist: ['internal.local'],
  maxFileSize: 10 * 1024 * 1024,
  defaultExecTimeoutMs: 30_000,
})

const ctx = createToolUseContext({sandbox, tools})
```

**护栏内容**：
- `bash prefix safety`：8 类危险命令静态名单（rm -rf /、curl|sh、dd if=/dev/zero、mkfs、chmod -R 777、fork bomb、eval $...）
- `path allowlist`：cwd / readFile / writeFile 必须在 allowlist（防 path traversal）
- `fetch host allowlist`：URL host 必须匹配（支持 `*.example.com` 通配；denylist 优先）
- 协议白名单：仅 http/https
- timeout 强制兜底
- abort signal 100ms 内响应

**与 cc 一致的判断**：不引入容器，规则级护栏已经足够（cc 实战做法）。product 需要更强可注入 Docker / firecracker 实现。

### 3.5 5 mode × 5 category PermissionMode 矩阵

```
              read    mutation   exec    network   dangerous
default   passthrough passthrough pass... pass...   pass...
plan      passthrough deny       deny    pass...   deny
readonly  passthrough deny       deny    deny      deny
dangerous allow       allow      allow   allow     pass...
bypass    allow       allow      allow   allow     allow
```

```ts
const ctx = createToolUseContext({
  ...,
  optionsExtra: {permissionMode: 'plan'}, // LLM 不能改任何东西，只能读
})
```

### 3.6 9 类协议双默认 + 注入式扩展

每个 IO 协议都遵循 `interface + InMemory + Filesystem` 三件套：

| 协议 | engine 默认 | product 可注入 |
|---|---|---|
| RunStore | InMemoryRunStore + FileRunStore | PgRunStore / RedisRunStore / S3RunStore |
| SessionStore | InMemorySessionStore + FilesystemSessionStore | PgSessionStore（已迁出） |
| ContentStore | InMemorySessionContentStore + FilesystemContentStore | PgContentStore（已迁出） |
| MemoryStore | InMemoryMemoryStore + FilesystemMemoryStore | RedisMemoryStore（已迁出） |
| AgentRegistry | InMemoryAgentRegistry + FilesystemAgentRegistry | DB / API |
| AuditEventStore | NoopAuditStore + FilesystemAuditStore | S3 / 区块链 |
| SandboxAdapter | NoOpSandbox + LocalSandbox | Docker / firecracker / unshare |
| Channel | InMemoryChannel | Redis pubsub / NATS / WebSocket |
| ArtifactStore（ArtifactHook 实现） | LocalArtifactStore | S3 / IPFS |

**意味着**：
- 单机开发：本地 ./runs/ 目录就跑
- 多机分布式：NFS 共享 ./runs/ 目录就跑
- 企业生产：product 注入 PG/S3 等任意后端，engine 不动一行代码

### 3.7 OTel-Compatible Observability（不引入 OTel SDK）

```ts
import {InMemoryMetricsProvider} from '@neptune/engine'

const metrics = new InMemoryMetricsProvider()
const tracer = myProductOTelAdapter // 实现 ITracingProvider 接口

for await (const event of AgentLoop.run({
  ...,
  tracingProvider: tracer,
  metricsProvider: metrics,
})) { /* ... */ }

// 自动产生：
// span: 'agent.run' (含 model / runId 属性 + run.completed event +
//        SpanStatus.OK/ERROR + tokens 等属性)
// counter: agent.run.started, agent.run.{reason}
// histogram: agent.run.tokens.input, agent.run.tokens.output
```

**关键**：engine 不 import `@opentelemetry/api`，接口形态对齐 OTel API，product 注入真实 OTel SDK adapter 即可对接 Prometheus / Jaeger / Datadog。

---

## 4. 如何使用（3 种姿势 + 完整生产配置）

### 4.1 姿势一：纯 SDK 调用（in-process，30 行）

```ts
// examples/sdk-pure.ts
import {randomUUID} from 'crypto'
import {AgentLoop} from '@neptune/engine'
import {AnthropicStreamingProvider} from '@neptune/engine/agent-loop/provider/AnthropicStreamingProvider.js'
import {createToolUseContext} from '@neptune/engine/agent-loop/dispatcher/ToolUseContext.js'

const provider = new AnthropicStreamingProvider({apiKey: process.env.ANTHROPIC_API_KEY!})
const ctx = createToolUseContext()

const userMessage = {
  type: 'user' as const,
  uuid: randomUUID(),
  message: {role: 'user' as const, content: 'Hello!'},
}

for await (const event of AgentLoop.run({
  provider,
  model: 'claude-sonnet-4-20250514',
  messages: [userMessage],
  context: ctx,
})) {
  if (event.type === 'assistant_message') console.log(event.message)
}
```

### 4.2 姿势二：SDK + Filesystem Store + Resume（80 行）

```ts
// examples/sdk-with-fs-store.ts
import {AgentLoop, FileRunStore} from '@neptune/engine'

const store = new FileRunStore('./runs')

// 第一次跑：创建新 run
const run = await store.create({metadata: {label: 'demo'}})
for await (const event of AgentLoop.runWithStore({
  ..., runStore: store, runId: run.id,
})) { console.log(event.type) }

// 第二次跑：用 --resume <runId>
if (process.argv.includes('--resume')) {
  const runId = process.argv[3]!
  for await (const event of AgentLoop.resume(runId, {
    provider, model, context, runStore: store,
  })) { /* ... */ }
}
```

文件结构：
```
./runs/
└── {runId}/
    ├── run.json        ← Run metadata（status / createdAt / updatedAt / metadata）
    └── events.jsonl    ← LoopEvent append-only log
```

### 4.3 姿势三：SDK + HTTP Server（包一层就分布式，150 行）

```ts
// examples/sdk-with-server.ts
import {createServer} from 'node:http'
import {AgentLoop, FileRunStore} from '@neptune/engine'

const store = new FileRunStore('./runs')

createServer(async (req, res) => {
  // POST /runs { prompt } → 创建 run，后台异步跑
  if (req.method === 'POST' && req.url === '/runs') {
    const {prompt} = JSON.parse(await readBody(req))
    const run = await store.create({metadata: {prompt}})
    void runInBackground(run.id, prompt)  // fire-and-forget
    return sendJson(res, {runId: run.id})
  }
  // GET /runs/:id/events → SSE 流
  if (req.method === 'GET' && req.url?.match(/^\/runs\/[^/]+\/events$/)) {
    res.writeHead(200, {'Content-Type': 'text/event-stream'})
    let cursor = 0
    const interval = setInterval(async () => {
      const events = await store.loadEvents(runId, {fromIndex: cursor})
      for (const e of events) res.write(`data: ${JSON.stringify(e)}\n\n`)
      cursor += events.length
      const run = await store.load(runId)
      if (run?.status === 'completed') { clearInterval(interval); res.end() }
    }, 250)
  }
}).listen(3000)
```

**多机分布式**：把 `./runs` 挂成 NFS，多个 server 实例共享同一目录就完成横向扩展。

### 4.4 完整生产级配置示例

```ts
import {
  AgentLoop,
  FileRunStore,
  FilesystemAuditStore,
  LocalSandbox,
  LocalArtifactStore,
  // governance hooks
  type GovernanceHooks,
  // observability
  InMemoryMetricsProvider,
} from '@neptune/engine'

// 1. State 外化
const runStore = new FileRunStore('/data/runs')

// 2. 合规审计链
const auditStore = new FilesystemAuditStore('/data/runs')

// 3. 安全护栏
const sandbox = new LocalSandbox({
  workingDirAllowlist: ['/workspace'],
  bashPrefixSafety: true,
  fetchHostAllowlist: ['*.api.example.com'],
  defaultExecTimeoutMs: 30_000,
})

// 4. 治理 hook（合规护城河）
const governance: GovernanceHooks = {
  policyHook: createMyDbPolicyHook({rulesTable: 'policy_rules'}),
  humanReviewHook: createSlackReviewHook({channel: '#audit'}),
  evalHook: createLangfuseEvalHook(),
  artifactHook: new LocalArtifactStore('/data/artifacts'),
}

// 5. Observability
const metrics = new InMemoryMetricsProvider()  // 或 product 提供的 OTel adapter

// 6. ToolUseContext
const ctx = createToolUseContext({
  tools: [...kernelTools, ...customTools],
  sandbox,
  optionsExtra: {permissionMode: 'plan'}, // 默认 plan mode（更安全）
  kernel: {
    skillRegistry: new InMemorySkillRegistry(),
    todoState: new InMemoryTodoState(),
    taskQueue: new InMemoryTaskQueue(),
    toolRegistry: new InMemoryToolRegistry(),
    memoryStore: new FilesystemMemoryStore('/data/memory'),
    agentRegistry: new FilesystemAgentRegistry('/data/agents'),
  },
})

// 7. 创建 run + 跑
const run = await runStore.create({metadata: {userId: '...'}})
for await (const event of AgentLoop.runWithStore({
  provider: anthropic,
  model: 'claude-sonnet-4-20250514',
  messages: [userMessage],
  context: ctx,
  runStore,
  runId: run.id,
  auditStore,
  governance,
  metricsProvider: metrics,
  // 附加：Caching / Compaction / Budget
  cachePolicy: new DefaultCachePolicy(),
  compactionPolicy: new MicroCompaction({tokenThreshold: 100_000}),
  budgetTracker: new DefaultBudgetTracker({tokenLimit: 200_000}),
})) {
  // 转发到 SSE / WebSocket / queue
}
```

---

## 5. 设计原则（为什么这么强大）

### 5.1 第一性原理：harness ≠ product ≠ framework

```
harness    = "提供决策点 + 执行点的 substrate"
product    = "在 substrate 上注入业务规则"
framework  = "强制业务遵循一套 opinion"

neptune-engine 是 harness：
- 不知道你具体跑什么 agent（只提供 AgentLoop 决策框架）
- 不知道你用什么 LLM（只提供 ProviderAdapter 接口）
- 不知道你怎么持久化（只提供 RunStore 接口）
- 不知道你怎么沙箱（只提供 SandboxAdapter 接口）
- 不知道你怎么治理（只提供 4 类 governance hook）
- 不知道你怎么观测（只提供 ITracingProvider / IMetricsProvider）
```

### 5.2 filesystem-first ≠ filesystem-only

不是"必须用 filesystem"，是"filesystem 是开箱即用的默认"。

- 单机：本地 ./runs 就跑
- 分布式：NFS 共享 ./runs 就跑
- 高级：注入 PgRunStore，engine 不动一行代码

**关键洞察**：很多分布式 agent 系统的失败 = 强制绑定 PG/Redis 等中间件 = 开发体验差 + 部署复杂度高。filesystem-first 让 80% 场景不需要中间件就能跑。

### 5.3 借鉴 cc 实战，不重新发明轮子

| 维度 | cc 实战做法 | neptune-engine 借鉴 |
|---|---|---|
| 持久化格式 | `~/.claude/projects/{cwd}/{sessionId}.jsonl` | `{rootDir}/{runId}/events.jsonl` |
| Resume | `compact_boundary` 行作为 checkpoint | `stream_request_start` 作为 turn boundary |
| 路径安全 | `sanitizePath` + 200 字符 + djb2 hash | 完全复用 |
| 崩溃容错 | 行级 atomic + 末行 truncate skip | 完全复用 |
| Sandbox | bash prefix safety + path allowlist | 完全复用（cc 没有容器） |
| Audit | jsonl 行级不可改 | 在此之上叠加 hash chain（升级） |

### 5.4 secure-by-default

- LocalSandbox 默认开启 bash prefix safety
- workingDirAllowlist 强制要求显式列出
- fetch 默认拒绝非 http(s) 协议
- PermissionMode 默认 'default'，product 应在 production 切到 'plan' / 'readonly'

### 5.5 OTel-Compatible 但 0 SDK 依赖

`@opentelemetry/api` 不在 deps —— engine 接口形态对齐 OTel API，product 注入真实 SDK 即可。这让 engine 包大小不爆炸，同时保留对接 Prometheus / Jaeger / Datadog / Honeycomb 的能力。

### 5.6 hash chain 不可篡改

不只是 jsonl append-only（任何文件被 root 都能改），而是 sha256 chain：

```
e[0].hash = sha256(GENESIS + canonicalJson({0, payload, ts}))
e[1].hash = sha256(e[0].hash + canonicalJson({1, payload, ts}))
e[i].hash = sha256(e[i-1].hash + canonicalJson({i, payload, ts}))
```

任意中间 event 改 1 字节 → recomputed hash ≠ stored hash → 必检出 + 返回 firstBadIndex。

### 5.7 接口 + InMemory + Filesystem 三件套

每个 IO 协议都遵循"接口 + 双默认"：

```
class InterfaceX { ... }                  // 协议
class InMemoryX implements InterfaceX     // 测试 / 单进程
class FilesystemX implements InterfaceX   // 单机 + NFS 分布式
class PgX / S3X / RedisX implements InterfaceX  // product 注入
```

意味着：写 InterfaceX 用例的代码 = 默认能跑（不需要 product 提供任何东西）。

---

## 6. Architecture（最终图）

```
┌────────────────────────────────────────────────────────────────────┐
│                  External SDK Consumer                              │
│   (in-process / + FileRunStore / + http SSE server)                 │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│  @neptune/engine (harness v1.0)                                     │
│                                                                     │
│  Core (强壮)                                                         │
│  ├─ AgentLoop                                                        │
│  │   ├─ run() / runWithStore() / resume(fromCheckpoint?)             │
│  │   ├─ M1: SSE 解析 / Multi-turn / ToolDispatcher                   │
│  │   ├─ M2: Retry / Fallback / Watchdog / Cancellation                │
│  │   └─ M3: Caching / Compaction / Budget / CircuitBreaker            │
│  ├─ ToolDispatcher + Sandbox protocol                                 │
│  ├─ HookSurface (5 event hook) + GovernanceHooks (4 类)              │
│  └─ PermissionMode 5×5 决策矩阵                                       │
│                                                                     │
│  Protocols + 双默认实现                                              │
│  ├─ RunStore: InMemoryRunStore + FileRunStore + Checkpoint           │
│  ├─ SessionStore / ContentStore / MemoryStore                        │
│  ├─ AgentRegistry / SkillRegistry                                    │
│  ├─ SandboxAdapter: NoOpSandbox + LocalSandbox                       │
│  ├─ AuditEventStore: NoopAuditStore + FilesystemAuditStore           │
│  ├─ ArtifactStore: LocalArtifactStore                                │
│  ├─ Tracer / Metrics: NoOp + InMemoryMetricsProvider                 │
│  └─ Channel: 接口 + InMemoryChannel                                  │
│                                                                     │
│  shared/types/contracts/  (跨层稳定 zod schema)                      │
│  ├─ Run / ToolInvocation / Artifact / EvidenceArtifact                │
│  └─ AuditEvent / HumanReview / PolicyDecision                        │
│                                                                     │
│  Dependencies: @anthropic-ai/sdk + zod + crypto                     │
│  (No DB, no Redis, no React, no OTel SDK)                           │
└────────────────────────────────────────────────────────────────────┘
                             ▲
                             │ 注入
┌────────────────────────────┴───────────────────────────────────────┐
│  @neptune/engine-product (业务层)                                   │
│  ├─ PgRunStore / RedisMemoryStore / S3ArtifactStore                  │
│  ├─ LangfuseEvalHook / SlackReviewHook / DbPolicyHook                │
│  ├─ OTelTracer / PrometheusMetrics                                   │
│  ├─ cc agent-adapter（如需 cc 业务）                                  │
│  └─ 6 个 unsupported Provider adapter（按需 register）               │
└────────────────────────────────────────────────────────────────────┘

事件流向：
─────────────────────────────────────────────────────────────────────
LoopEvent: stream_request_start → assistant_message → tool_update →
            usage_update → governance_decision → error

每个 event 同时（自动）：
1. yield 给 caller（实时消费）
2. RunStore.appendEvent → events.jsonl
3. AuditEventStore.append → audit.jsonl（仅敏感事件，含 hash chain）
4. ITracingProvider span attribute 更新
5. IMetricsProvider counter / histogram 累加
─────────────────────────────────────────────────────────────────────
```

---

## 7. 当前欠缺点（核心待办，按优先级）

### 🔴 P0 — 影响"敢拿出去给金融客户"的兑现度

#### P0.1 — AgentTool / SkillTool 业务剥离

**现状**：
- `packages/builtin-tools/src/tools/AgentTool/` 下有 12 个文件含 50+ 处 `from 'src/...'` 反向引用 cc product
- `packages/builtin-tools/src/tools/SkillTool/` 下有 11 处反向引用
- 这些工具深度耦合 cc 的 `query()` 主循环、agent context、teammate 业务、telemetry 等

**影响**：当前作为可选 product-tools 工具，不阻塞 substrate 分发；但 product 想用 sub-agent 能力时必须连带引入大量 cc 业务代码。

**方案**（约 3 天）：
1. 落 `AgentRegistry` 协议（已完成）
2. 把 cc 业务文件迁到 `neptune-engine-product/src/agent-adapter/`
3. AgentTool 主体改用 `ctx.kernel.agentRegistry.get(type)` 注入

#### P0.2 — BashTool / FileWriteTool / WebFetchTool 接入 ctx.sandbox

**现状**：Sandbox 协议已就位（S3.3），但 BashTool 等仍直接用 Node `child_process.exec` / `fs.writeFile` / `fetch`，未通过 `ctx.sandbox`。

**影响**：sandbox 配置不强制；用户即使注入了 LocalSandbox，工具仍可能绕过。

**方案**（约 1 天）：
1. 改 BashTool 调用 `ctx.sandbox?.exec(...)`，无 sandbox fallback NoOpSandbox + emit warning
2. 改 FileWriteTool / FileEditTool 调用 `ctx.sandbox?.writeFile(...)`
3. 改 WebFetchTool 调用 `ctx.sandbox?.fetch(...)`

### 🟠 P1 — 完善生产可用性

#### P1.1 — 6 个 unsupported Provider 文件迁移

**现状**：engine 默认 ProviderRegistry 只注册 `anthropic`（已完成 S5.1），但 OpenAI/Bedrock/Vertex/Gemini/Grok/Foundry 6 个 stub 文件仍在 `engine/provider/adapters/`。

**影响**：包大小不爆炸（6 个文件总共 343 行），但违反"engine 不感知具体 provider"承诺。

**方案**（约 1 天）：
1. `git mv` 6 个 stub 文件到 `neptune-engine-product/src/provider/`
2. product 启动时显式 `registry.register('openai', new OpenAIProvider())` 等
3. 守门脚本加 check #10：engine/provider/adapters/ 仅含 Anthropic + Base

#### P1.2 — Provider 真实实现（可选）

如果 product 不满足于 unsupported stub，需要为 OpenAI/Bedrock/Vertex 真实实现 SSE 流转 ParsedSSEEvent 适配器。每个 1-2 天。

#### P1.3 — Run 的 Soft Delete + Retention Policy

**现状**：FileRunStore.delete 是硬删除；没有 retention（运行完的 run 永久占盘）。

**方案**（约 0.5 天）：
1. Run.status 加 'archived' 状态
2. RunStore 加 `archive(id)` / `cleanup(olderThan: Date)` 可选方法
3. FilesystemRunStore 实现 archive = mv 到 `{rootDir}/.archived/`

### 🟡 P2 — 开发者体验 / 文档

#### P2.1 — 完整的 SDK 类型 .d.ts 收敛

**现状**：engine 通过 `exports.*` wildcard 暴露所有 src/engine/ 子路径。这让 product 可以深路径 import，但也意味着 SDK 表面积太大。

**方案**（约 1 天）：
1. 收敛 `engine/index.ts` 顶层 export（只暴露稳定公共 API）
2. 把内部模块通过 `export * as agentLoop from './agent-loop/index.js'` 等命名空间隐藏
3. 写 SDK API 兼容性承诺（semver minor 不破坏）

#### P2.2 — 端到端文档（getting-started / API Reference）

**现状**：仅有 STAGE-DONE.md 阶段报告 + 本说明书。缺：
- Getting Started 教程（new user 30 分钟跑通）
- API Reference（每个 export 一段 JSDoc）
- Cookbook（治理 hook / Sandbox / 分布式部署 等场景）

**方案**（约 2 天）：用 typedoc 生成 API Reference，手写 cookbook。

#### P2.3 — Channel 实现（Redis pubsub）

**现状**：Channel 只有 InMemoryChannel，跨进程多 agent 通讯空缺。

**方案**（用户已表态先不动；可后置）：
- product 实现 RedisChannel / NATSChannel 注入
- 或 engine 提供 `FileBackedChannel`（跨进程文件队列，0 中间件）

### 🟢 P3 — 长期演进

#### P3.1 — 真正的容器 sandbox（Docker / firecracker）

**现状**：LocalSandbox 是规则级护栏，对真正恶意 code 仍不够。

**方案**（product 责任）：实现 `DockerSandbox implements SandboxAdapter`，把 exec 包到容器里跑。

#### P3.2 — Audit chain 跨 Run 索引

**现状**：每个 Run 一个 audit.jsonl，跨 Run 查询慢。

**方案**：可选 `MerkleTreeAuditStore` 后端，每 N 个 event 生成一个 merkle root 写到独立索引。

#### P3.3 — Multi-tenant / 配额系统

**现状**：BudgetTracker 是 single-run，多用户场景需要 product 自己 wrap。

**方案**：substrate 不内置 multi-tenant（product 关注），但提供 `TenantBudgetTracker` 接口让 product 注入。

---

## 8. 端到端验收 (HARNESS v1.0 18/18 PASS)

`bash neptune-engine/scripts/verify-harness-v1.sh`：

```
── Gate A: 干净度 ──────────────────────────────────────────────
  [Gate 1] A.1 engine 0 数据库 SDK 依赖              ✅ PASS
  [Gate 2] A.2 builtin-tools 9 工具反向引用 = 0       ✅ PASS
  [Gate 3] A.3 守门脚本 9/9 PASS                      ✅ PASS

── Gate B: Harness 强化 ────────────────────────────────────────
  [Gate 4] B.1 Sandbox 模块就位                       ✅ PASS
  [Gate 5] B.2 AuditEventStore 模块就位               ✅ PASS
  [Gate 6] B.3 Run / RunStore 协议就位                ✅ PASS
  [Gate 7] B.4 Channel 协议就位                       ✅ PASS
  [Gate 8] B.5 Observability 接口就位                 ✅ PASS
  [Gate 9] B.6 ArtifactStore 就位                     ✅ PASS
  [Gate 10] B.7 AgentRegistry 协议就位                ✅ PASS

── Gate C: Stateless ───────────────────────────────────────────
  [Gate 11] C.1 跨实例 resume 测试通过                ✅ PASS
  [Gate 12] C.2 RunStore Filesystem 实现可用          ✅ PASS

── Gate D: SDK ─────────────────────────────────────────────────
  [Gate 13] D.1 sdk-pure example 可加载               ✅ PASS
  [Gate 14] D.2 sdk-with-fs-store example 可加载       ✅ PASS
  [Gate 15] D.3 sdk-with-server example 可加载         ✅ PASS

── Gate E: 量化 ────────────────────────────────────────────────
  [Gate 16] E.1 engine baseline 测试 ≥ 1300 pass     ✅ PASS
  [Gate 17] E.2 engine tsc 0 错                       ✅ PASS
  [Gate 18] E.3 examples 文件齐全（3 个）             ✅ PASS

✅ HARNESS v1.0: ALL GREEN (18/18)
```

---

## 9. 6 个 Stage 演进史

| Stage | 主题 | 关键交付 | 增量测试 |
|---|---|---|---|
| Stage 1 | builtin-tools 死结 | 9 核心工具反向引用清零 + cc-shim 5 utils + 守门 7/7 | — |
| Stage 2 | 契约 + 治理 | shared 7 contracts + 4 governance hooks + PermissionMode 5×5 | +75 |
| Stage 3 | 干净 + Stateless | Storage 双默认 / AgentRegistry / Sandbox / Run+RunStore + Resume | +83 |
| Stage 4 | 合规护城河 | Audit hash chain / Channel / Checkpoint / LocalArtifactStore | +55 |
| Stage 5 | Provider 收口 | engine 默认仅 Anthropic + zod→JSON Schema | +16 |
| Stage 6 | Observability + 收官 | AgentLoop 集成 ITracingProvider/IMetricsProvider + verify-harness-v1.sh | +4 |

**累计交付**：守门 7/7 → 9/9，baseline 1184 → 1393 pass / 0 fail，新增模块 12+ 个，新增协议 9 类，新增治理 hook 4 类，端到端验收 18/18。

---

## 10. 量化总览（一页看清）

| 维度 | 数值 |
|---|---|
| 源文件数 | 193 |
| 测试文件数 | 100 |
| 守门 check | **9/9 PASS** |
| 端到端 Gate | **18/18 PASS** |
| baseline tests | **1393 pass / 0 fail** |
| engine 数据库 SDK 依赖 | **0** |
| engine 总核心依赖 | **3**（@anthropic-ai/sdk + zod + crypto） |
| 核心模块数 | 16 |
| 协议 + 双默认实现 | **9 类** |
| 治理 hook | **4 类** |
| Sandbox 决策矩阵 | **24 测试** |
| 跨实例 resume 测试 | **5 集成测试通过** |
| Audit 篡改检出 | **4 类场景全检出** |
| SDK examples | **3 种姿势** |
| LoopEvent 类型 | 6（stream_request_start / assistant_message / tool_update / usage_update / governance_decision / error） |
| RunStatus 状态 | 6（pending/running/paused/completed/failed/aborted） |
| PermissionMode 模式 | 5（default/plan/readonly/dangerous/bypass） |
| ToolCategory 分类 | 5（read/mutation/exec/network/dangerous） |

---

## 11. 给老板的一页总结

```
neptune-engine v1.0 = 干净、强大、可被 server 化的 agent SDK

✅ 强大：
   • Agent Loop 完整核心（思考 + 行动 + 鲁棒 + 效率）
   • 4 类治理 hook（Policy / HumanReview / Eval / Artifact）
   • Sandbox 安全护栏（规则级，对齐 cc 实战）
   • Audit hash chain（不可篡改证据）
   • Multi-turn + Multi-agent + Resume 全套

✅ 干净：
   • engine package.json 0 数据库 SDK
   • builtin-tools 9 核心工具反向引用 = 0
   • 守门 9/9 + 端到端 18/18 全绿

✅ Stateless：
   • FileRunStore + 跨实例 resume，NFS 即可分布式
   • 9 类协议双默认（InMemory + Filesystem），0 中间件依赖

✅ 合规：
   • Audit hash chain 篡改可证（sha256 + canonical JSON）
   • PolicyDecision → ToolInvocation → EvidenceArtifact → HumanReview 链条闭环
   • PermissionMode 5×5 决策矩阵

✅ SDK：
   • 3 种姿势（纯调用 / + fs store / + http server）
   • OTel-compatible 接口（不引入 SDK）
   • zod→JSON 自动转 Phase B 工具 schema

简单包装一层 server 就是分布式状态外化的 agent engine。

下一步核心待办（按优先级）：
🔴 P0.1: AgentTool / SkillTool 业务剥离（约 3 天）
🔴 P0.2: 工具接入 ctx.sandbox（约 1 天）
🟠 P1.1: 6 个 unsupported Provider 文件迁出（约 1 天）
🟢 P3.1: 真正的容器 sandbox（product 责任）
```

---

## 附录 A — 关键 import 速查

```ts
// 核心 AgentLoop
import {AgentLoop} from '@neptune/engine'
import {AnthropicStreamingProvider} from '@neptune/engine/agent-loop/provider/AnthropicStreamingProvider.js'
import {createToolUseContext} from '@neptune/engine/agent-loop/dispatcher/ToolUseContext.js'

// State 外化
import {InMemoryRunStore, FileRunStore, type RunStore, type Checkpoint} from '@neptune/engine'

// 合规审计
import {FilesystemAuditStore, NoopAuditStore, type AuditEventStore, type VerifyResult} from '@neptune/engine'

// Sandbox
import {LocalSandbox, NoOpSandbox, type SandboxAdapter, type LocalSandboxConfig} from '@neptune/engine'

// Governance hooks
import type {GovernanceHooks, PolicyHook, HumanReviewHook, EvalHook, ArtifactHook} from '@neptune/engine'

// Storage
import {InMemorySessionStore, FilesystemSessionStore, FilesystemContentStore, FilesystemMemoryStore} from '@neptune/engine'

// Registry
import {InMemoryAgentRegistry, FilesystemAgentRegistry, type AgentManifest, type AgentRegistry} from '@neptune/engine'

// Artifact
import {LocalArtifactStore} from '@neptune/engine'

// Observability
import {NoOpTracingProvider, NoOpMetricsProvider, InMemoryMetricsProvider, type ITracingProvider, type IMetricsProvider} from '@neptune/engine'

// Channel
import {InMemoryChannel, type Channel} from '@neptune/engine'

// Caching / Compaction / Budget
import {DefaultCachePolicy, NoOpCachePolicy} from '@neptune/engine/agent-loop/caching/CacheControlPolicy.js'
import {MicroCompaction, NoOpCompactionPolicy} from '@neptune/engine/agent-loop/compaction/CompactionPolicy.js'
import {DefaultBudgetTracker, NoOpBudgetTracker} from '@neptune/engine/agent-loop/budget/BudgetTracker.js'

// Hook
import {HookSurface} from '@neptune/engine/agent-loop/hook/HookSurface.js'

// Utils
import {sanitizePath, atomicWrite, appendJsonl, readJsonlLines, zodToJsonSchema} from '@neptune/engine'

// Contracts (跨层稳定 schema)
import type {Run, ToolInvocation, Artifact, EvidenceArtifact, AuditEvent, HumanReview, PolicyDecision} from '@shared/contracts'
```

## 附录 B — 文件路径速查

```
neptune-engine/
├── src/engine/                     ← 全部 substrate 代码
│   ├── agent-loop/                  Agent loop 核心
│   ├── governance/                  4 类治理 hook
│   ├── permissions/                 PermissionMode 5×5
│   ├── sandbox/                     Sandbox 安全护栏
│   ├── run/                         Run + RunStore（state 外化）
│   ├── audit/                       AuditEventStore（hash chain）
│   ├── artifact/                    LocalArtifactStore
│   ├── channel/                     Channel 多 agent 通讯
│   ├── agent-registry/              Agent manifest 注册
│   ├── storage/                     SessionStore / ContentStore / MemoryStore
│   ├── observability/               OTel-compatible 接口
│   ├── skill/ + todo/ + task-queue/ Phase A 五大 protocol
│   ├── tool-registry/               工具注册 + 关键词搜索
│   ├── log/                         结构化日志（含 MDC）
│   ├── utils/                       工具函数（sanitizePath / atomicWrite / jsonl / zodToJsonSchema）
│   └── index.ts                     SDK 顶层 export
├── packages/                        子包
│   ├── builtin-tools/               20 个工具（含 11 kernel + 9 业务）
│   ├── agent-tools/                 工具基础类型
│   └── mcp-client/                  MCP SDK 集成
├── examples/                        3 个 SDK examples
│   ├── sdk-pure.ts
│   ├── sdk-with-fs-store.ts
│   └── sdk-with-server.ts
├── scripts/
│   ├── verify-workspace-independent.sh   守门 9/9
│   └── verify-harness-v1.sh              端到端 18/18
└── package.json                    deps: @anthropic-ai/sdk + zod
```

---

**文档版本**：v1.0
**最后更新**：2026-05-25
**对应 commit**：`c99aac6` (HARNESS-V1)
