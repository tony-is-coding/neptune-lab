# Neptune Engine Runtime Kernel — 接口设计草案

日期：2026-05-23
状态：草案 v0.1（待用户审）
战略对齐：[neptune-agentops-platform-strategy.md](./neptune-agentops-platform-strategy.md) §2.4 / §3.4 / §3.3，
                 [neptune-engine-decoupling-handover.md](./neptune-engine-decoupling-handover.md)

---

## 0. 战略结论

`@neptune/engine` 是一个**通用 Agent Runtime Kernel**。它不是 Claude Code 的内核，也不是 Neptune 财务 Solution Pack 的内核。它是任意一个企业级 Agent 应用都应该依赖、并以此为事实标准的 runtime 层。

通用 Agent 应用的核心能力 = **思考 + 行动 + 记忆 + 规划 + 协作 + 扩展 + 工具发现**。这七项必须在 engine 内长出**协议 + 默认实现**两层骨架；任何具体 product 的 UX、登录、远控、特定 transport、特定文档格式都不应该污染这一层。

本草案锁定 7 个 protocol：`Tool` / `Skill` / `TodoState` / `TaskQueue` / `Channel`（多 Agent 通讯）/ `Memory` / `ToolRegistry`。每个 protocol 都按四个维度描述：抽象、默认实现、host adapter 接入点、典型端到端流程。

本草案**不**包含：
- 模型调用（`AgentEngine` / `Provider` 已经有，是稳定面）
- 工具执行循环（`CCRuntime` 已经有，是稳定面）
- 现有工具的具体迁移 PR（按本草案落地后单独走批次）

---

## 1. 第一性原理

把"通用 Agent 应该有的能力"和"product 用户体验"分清楚的判定标准：

| 留 engine（核心抽象） | 搬 product（具体 UX / 物理实现） |
|---|---|
| 模型 ↔ tool 协议（schema、name、input/output） | UI 渲染（Ink / React 弹窗、对话框、命令行 prompt） |
| Skill manifest 数据结构 + 解析格式（markdown frontmatter）* | Skill 文件的存放位置（`.claude/skills/`、plugin 路径） |
| 多 Agent 任务队列协议（create/get/list/update/stop/output） | Cron 调度面板、操作 UI |
| 多 Agent 消息接口（`to`、`payload`、`structured`） | 物理 transport（tmux pane、UDS socket、LAN TCP、Remote Bridge） |
| Todo / Task 状态结构 | 待办 UI 渲染样式 |
| Memory hook（写入、读取、检索接口） | 具体存储后端（SQLite、文件、Postgres） |
| Tool registry / tool search | Marketplace / plugin 分发机制 |
| 文件 I/O 原语（FileRead / FileWrite / FileEdit / Glob / Grep / Bash） | 特定格式编辑器（Jupyter Notebook、Office、PDF）— 各自作为 product 扩展 |

\* SkillFormatter（markdown frontmatter parser）显式定义为 engine 的事实标准之一，**不**搬 product。理由：未来在 engine 上长出来的所有 agent 应用都要遵循这个规范，让 skill 在不同 product 之间可移植。

---

## 2. Engine Runtime 分层视图

```text
┌──────────────────────────────────────────────────────────────────────┐
│                    Product Layer (neptune-engine-product/)            │
│  Claude Code UI、tmux/UDS/LAN/Remote 物理 transport、PR/CR、登录、     │
│  Cron 调度面板、Notebook 编辑器、特定 marketplace、telemetry            │
└──────────────────────────────▲───────────────────────────────────────┘
                                │ 通过 host adapter 接入 engine 协议
┌──────────────────────────────┴───────────────────────────────────────┐
│                Engine Public API (@neptune/engine)                    │
│   AgentEngine / Session / Provider / Tool / Hook                      │
│   ToolRegistry / SkillRegistry / TaskQueue / Channel / Memory / Todo  │
└──────────────────────────────▲───────────────────────────────────────┘
                                │ 内部模块组合
┌──────────────────────────────┴───────────────────────────────────────┐
│            Engine Internals (@neptune/engine + builtin-tools)         │
│   CCRuntime、QueryEngine、Permissions、EventBus、Storage、Observability │
│   原语工具：Bash/FileRead/FileWrite/FileEdit/Glob/Grep/WebFetch/        │
│   WebSearch/Agent/Skill/SendMessage/Sleep/REPL/MCP*                    │
└───────────────────────────────────────────────────────────────────────┘
```

**重要边界**：engine 提供 protocol + 默认实现；product 通过 adapter 注入特化行为。如果 product 想换实现（比如把 SQLite memory 换成 Postgres），engine 协议保持不变。

---

## 3. Protocol §1 — `Skill`（声明式 sub-agent 模板）

### 3.1 抽象

Skill = 一个 agent 在 runtime 注册的"额外能力"，它不是代码，是声明。主 agent 看到一个 `Skill(name, input)` 工具，调用后 runtime 启子 agent 执行。

Skill manifest 的标准格式 = **Markdown + YAML frontmatter**。这是 engine 定义的事实标准。

### 3.2 协议结构（engine 暴露）

```ts
// @neptune/engine/skill.ts
export interface SkillManifest {
  /** 唯一标识，用于 Skill(name) 调用 */
  name: string
  /** 给主 agent 看的能力描述（注入到 main prompt 的 skill list） */
  description: string
  /** 子 agent 的 system prompt（markdown 正文） */
  prompt: string
  /** 子 agent 允许使用的工具白名单；省略 = 继承主 agent 全集 */
  tools?: string[]
  /** 子 agent 显式禁用的工具 */
  disallowedTools?: string[]
  /** 子 agent 用什么模型；'inherit' = 跟主 agent；省略 = engine 默认 */
  model?: 'inherit' | string
  /** 自定义元数据（product 可注入业务字段，engine 不解释） */
  metadata?: Record<string, unknown>
}

export interface SkillRegistry {
  register(manifest: SkillManifest, source: SkillSource): void
  unregister(name: string): void
  find(name: string): SkillManifest | undefined
  list(): readonly SkillManifest[]
  /** 用于审计：这条 manifest 哪来的 */
  source(name: string): SkillSource | undefined
}

/** Skill 来源标识，product 自定义具体来源类型 */
export interface SkillSource {
  kind: string            // e.g. 'user-dir' | 'project-dir' | 'plugin' | 'sdk-injected'
  origin: string          // e.g. file path / plugin id / 'inline'
  loadedAt: string        // ISO timestamp
}
```

### 3.3 Engine 默认实现（事实标准）

`@neptune/engine/skill/SkillFormatter`：

```ts
/** 把一段 markdown 文本（含 YAML frontmatter）解析成 SkillManifest */
export function parseSkillMarkdown(source: string): SkillManifest

/** 把 SkillManifest 序列化回 markdown，用于 round-trip / 编辑器 */
export function serializeSkillToMarkdown(manifest: SkillManifest): string

/** 校验 manifest 字段合法性，返回错误列表或 ok */
export function validateSkillManifest(m: unknown): ValidationResult
```

`@neptune/engine/skill/InMemorySkillRegistry`（默认实现，零依赖）：
- 内存 Map<name, manifest>
- 注册时自动校验 + 调用 SkillFormatter 反序列化
- list() 返回稳定排序，便于 prompt 注入幂等

### 3.4 Product Adapter 接入点

product 负责"哪里有 skill markdown 文件"以及"怎么把它们送进 registry"：

```ts
// neptune-engine-product/src/skills/SkillLoader.ts (示例)
class FilesystemSkillLoader {
  constructor(
    private registry: SkillRegistry,
    private dirs: string[]   // ['~/.claude/skills', '<repo>/.claude/skills', ...]
  ) {}

  async loadAll(): Promise<void> {
    for (const dir of this.dirs) {
      for (const file of await glob(`${dir}/*.md`)) {
        const text = await readFile(file)
        const manifest = parseSkillMarkdown(text)
        this.registry.register(manifest, {
          kind: 'filesystem', origin: file, loadedAt: new Date().toISOString()
        })
      }
    }
  }
}
```

product 也可以写 `MarketplaceSkillLoader` / `PluginSkillLoader` 等，engine 不关心。

### 3.5 端到端流程

1. product 启动时 `FilesystemSkillLoader.loadAll()`，把 N 份 markdown 注册进 `SkillRegistry`
2. engine `AgentEngine.createSession` 时把 registry 注入 `ToolUseContext`
3. main agent 的 prompt 由 engine 里的 `SkillTool.prompt()` 拼装：枚举 registry.list() 注入到 system prompt 里 "Available skills: ..."
4. model 输出 `Skill({skill: "code-reviewer", input: "..."})`
5. engine `SkillTool.call()` → 查 registry.find("code-reviewer") → 用 manifest.prompt 当 system prompt + manifest.tools 当工具白名单 + manifest.model → 启动 sub-agent（复用现有 `runAgent`）
6. sub-agent 结果回流到 main agent

### 3.6 迁移路径（影响现有代码）

- **留 engine**：`SkillTool.ts` 主体 + `parseFrontmatter` 等价能力（搬到 `@neptune/engine/skill/SkillFormatter`）
- **搬 product**：`recordSkillUsage`（telemetry）、`pluginIdentifier` / `marketplace` 相关、`getCommands` 中跟 plugin 相关的部分
- **改造**：`SkillTool` 通过 `ctx.skillRegistry` 获取 manifest，不再直接读文件

---

## 4. Protocol §2 — `Channel`（多 Agent 通讯接口）

> 用户已表态：SendMessageTool 当前实现先不动，保留在 engine。本节是**面向未来**的接口草案，落地节奏由用户后续决定。

### 4.1 抽象

多 Agent 协作的**最小可观察事实**：一个 agent 给另一个 agent / 一组 agent / 广播发了一条消息。
engine 不定义"用什么物理通道送"。tmux / UDS / LAN / Remote bridge 都是 product transport。

### 4.2 协议结构

```ts
export interface Channel {
  /** 发消息：返回 messageId，用于 trace 和 reply 关联 */
  send(msg: ChannelMessage): Promise<string>
  /** 订阅：当前 agent 的 inbox 流（async iterator） */
  inbox(agentId: AgentId, signal?: AbortSignal): AsyncIterable<ChannelMessage>
  /** 列出可达 peer（拓扑发现） */
  listPeers(filter?: PeerFilter): Promise<readonly Peer[]>
}

export interface ChannelMessage {
  id: string
  from: AgentId
  to: AgentId | 'broadcast' | { group: string }
  payload: { text?: string; structured?: unknown }
  /** 业务消息类型，agent 之间约定（engine 不解释） */
  kind?: string                    // 'plan_review_request' / 'shutdown' / 'task_handoff' / ...
  timestamp: string
  inReplyTo?: string               // messageId
}
```

### 4.3 Engine 默认实现

`InProcessChannel`：所有 agent 跑在同一进程时（SDK / 单机部署），用内存 EventBus 路由消息。零外部依赖。

### 4.4 Product Adapter

`TmuxPaneChannel` / `UdsChannel` / `LanTcpChannel` / `RemoteBridgeChannel` 都是 product 实现 `Channel` 接口的具体 transport。Claude Code 现存的 SendMessageTool 实现属于 transport-aware 的 product 适配版，未来作为 product adapter 注入即可。

### 4.5 重要：本节当前不落地

按用户要求保持现状。本节只是把未来切口画出来。

---

## 5. Protocol §3 — `TaskQueue`（多 Agent 任务队列）

### 5.1 抽象

多 Agent 协作时，最朴素的协调方式是共享一个任务列表："我建任务，你领任务，他汇报结果"。这是 engine 核心。

TaskQueue 的对象是 Agent 间的 `Task`（不是 todo，不是 schedule）。

### 5.2 协议结构

```ts
export interface TaskQueue {
  create(input: TaskInput): Promise<Task>
  get(id: string): Promise<Task | undefined>
  list(filter?: TaskFilter): Promise<readonly Task[]>
  update(id: string, patch: TaskPatch): Promise<Task>
  stop(id: string, reason?: string): Promise<void>
  /** 当 task 状态变化时触发；用于 agent 订阅"我领的任务有更新" */
  events(filter?: TaskFilter, signal?: AbortSignal): AsyncIterable<TaskEvent>
}

export interface Task {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled' | 'failed'
  owner?: AgentId             // 被领走时设
  createdBy: AgentId
  blockedBy: string[]         // task ids
  dependsOn: string[]         // task ids
  output?: TaskOutput         // 完成后 agent 汇报的产物
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface TaskOutput {
  summary: string
  artifacts?: Array<{ kind: string; ref: string }>  // 引用 artifact store 中的对象
}
```

### 5.3 Engine 默认实现

`InMemoryTaskQueue`：内存 Map + EventEmitter。SDK / 单进程足够用。

### 5.4 Product Adapter

product 想要持久化（重启不丢任务）、跨进程共享、Cron 调度等，写 `SqliteTaskQueue` / `PostgresTaskQueue` / `RedisTaskQueue` 接进 engine。`ScheduleCronTool`（已搬 product）作为 TaskQueue 上的"定时新建任务"扩展。

### 5.5 迁移路径（影响现有代码）

之前已搬到 `neptune-engine-product/src/product-tools/task-*` 的 6 个工具（TaskCreate / TaskGet / TaskList / TaskOutput / TaskStop / TaskUpdate）需要回到 engine。

具体做法（**不立即执行**，等本草案审通过）：
1. engine 新建 `@neptune/engine/task-queue/`，落地协议 + InMemoryTaskQueue
2. engine `builtin-tools/src/tools/Task*Tool/` 重建，所有工具都通过 `ctx.taskQueue` 调用，不再直接 import product 的 `tasks/framework`
3. product 端现存的 `task-*` 目录降级为可选 adapter（持久化版本），不强制依赖
4. 工具实现搬回 engine 时，product UI 渲染逻辑（如 TaskListTool 的 React 组件）剥离到 product adapter

---

## 6. Protocol §4 — `TodoState`（单 Agent 内规划）

### 5.1 抽象

TodoState 和 TaskQueue 是两个东西：
- **TaskQueue**：跨 agent，"我把这步派给 teammate B"
- **TodoState**：单 agent，"我自己今天分 5 步做完这个长任务"

TodoState 是 agent 自管的任务清单，让 model 把多步推理过程显式化、可观察、可被中断后恢复。这也是 engine 核心。

### 6.2 协议结构

```ts
export interface TodoState {
  /** 替换当前 session 的整个 todo list（model 总是发完整版） */
  replace(items: TodoItem[]): void
  /** 读取（用于 prompt 注入） */
  current(): readonly TodoItem[]
  /** 订阅变化（用于 UI / observability hook） */
  events(signal?: AbortSignal): AsyncIterable<TodoEvent>
}

export interface TodoItem {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  /** 可选：这条 todo 关联到 TaskQueue 中的哪个 task */
  linkedTaskId?: string
}
```

### 6.3 Engine 默认实现

`InMemoryTodoState`：每个 session 一份。session 销毁时丢弃。

### 6.4 Product Adapter

product 可以提供持久化版本（重启恢复 todo）、UI 实时渲染、跨 agent 可见性等。

### 6.5 迁移路径

`TodoWriteTool` 已搬到 product，需要回到 engine。同 §5.5 节奏。

---

## 7. Protocol §5 — `Memory`（持久化记忆）

### 7.1 抽象

Memory = agent 在多 session 之间共享的事实/偏好/历史。和"消息历史"不同：消息历史是单 session 内的字面对话，memory 是被 agent **主动选择**保留下来的、跨 session 的有限事实。

engine 核心暴露 memory 写入、读取、检索接口。具体存储（vector DB / SQLite / 文件）是 product adapter。

### 7.2 协议结构

```ts
export interface MemoryStore {
  /** 写入一条记忆事实 */
  put(entry: MemoryEntry): Promise<MemoryRef>
  /** 按 id 读取 */
  get(ref: MemoryRef): Promise<MemoryEntry | undefined>
  /** 删除 */
  delete(ref: MemoryRef): Promise<void>
  /** 检索（关键词 / 语义 / 时间窗口；具体实现自由） */
  search(query: MemoryQuery): Promise<readonly MemoryEntry[]>
  /** 列出所有 namespace 下的记忆（用于审计 / cleanup） */
  list(namespace?: string): AsyncIterable<MemoryEntry>
}

export interface MemoryEntry {
  ref: MemoryRef
  namespace: string             // e.g. project / user / agent identity
  content: string               // 自然语言事实
  tags?: string[]
  importance?: number           // 0-1，product 可用于驱逐策略
  createdAt: string
  expiresAt?: string
  source?: { sessionId?: string; toolUseId?: string; reason?: string }
}

export type MemoryRef = string  // 不透明 id
export interface MemoryQuery {
  namespace?: string
  text?: string                 // 关键词或自然语言
  tags?: string[]
  since?: string                // ISO time
  limit?: number
}
```

### 7.3 Engine 默认实现

`InMemoryMemoryStore`：默认零依赖实现，关键词包含匹配。够 SDK / 演示用。

### 7.4 Product Adapter

`SqliteMemoryStore` / `VectorMemoryStore`（接 OpenAI embeddings 或本地模型）/ `RemoteMemoryStore`（接企业知识库 API）。

### 7.5 当前状态

engine 还没有 Memory 抽象。本草案是**新增**。落地时新建 `@neptune/engine/memory/`。

可考虑同时提供两个 builtin tool：`MemoryWriteTool(content, tags?)` 和 `MemoryRecallTool(query)`，让 model 显式控制记忆写入和召回 — 这是模仿 Claude / ChatGPT 那个 `memory` 概念的最小协议化实现。

---

## 8. Protocol §6 — `ToolRegistry`（工具注册与发现）

### 8.1 抽象

agent 知道自己有哪些工具，能搜索某个能力。这是 runtime 核心。

ToolRegistry 提供"列出工具"和"搜索工具"两件事。

### 8.2 协议结构

```ts
export interface ToolRegistry {
  register(tool: Tool): void
  unregister(name: string): void
  get(name: string): Tool | undefined
  list(filter?: ToolFilter): readonly Tool[]
  search(query: string, limit?: number): readonly ToolSearchResult[]
}

export interface ToolFilter {
  /** 只列 enabled 的（按 ctx 调 isEnabled） */
  enabledOnly?: boolean
  /** 名字前缀过滤（mcp__server__、product__、...） */
  namePrefix?: string
  /** 排除某些工具 */
  excludeNames?: string[]
}

export interface ToolSearchResult {
  tool: Tool
  score: number         // 0-1，相关度
  matchedOn: 'name' | 'searchHint' | 'description'
}
```

### 8.3 Engine 默认实现

`InMemoryToolRegistry`：维护 Map<name, Tool>。`search()` 用 `tool.searchHint`（已存在）+ name + description 做关键词匹配，给一个简单的相关度打分。

### 8.4 Product Adapter

product 不需要重写 ToolRegistry，但可以在初始化时注入额外 tool（plugin tools / mcp tools / 客户自定义工具）。

### 8.5 迁移路径

`ToolSearchTool` 已搬 product，需要回到 engine。变成 `ctx.toolRegistry.search()` 的薄壳。

---

## 9. Protocol §7 — `Tool`（已存在，本节只对齐）

`Tool` interface 已经存在于 `@neptune/engine-tools/types.ts`（`CoreTool`）和 `@neptune/builtin-tools/tool.ts`（含 UI 字段的扩展）。

本草案**不**修改 Tool interface。但要明确：
- `CoreTool`（agent-tools）= engine 核心，不含 React/Ink 字段
- 扩展 Tool（builtin-tools）= 含 host UI 字段，由 product 渲染时使用
- 任何新 protocol（Skill / TaskQueue / Channel / Memory）的相关 builtin tool 都基于 `CoreTool` 构建

---

## 10. 实施路线（不立即执行，待用户审）

按"接口先行、实现搬迁后置、新增 protocol 后续"原则：

### 10.1 Phase A — 协议定义（不动现有代码）
- A1: `@neptune/engine/skill/` 新建：`SkillManifest` / `SkillFormatter` / `SkillRegistry` + `InMemorySkillRegistry`
- A2: `@neptune/engine/task-queue/` 新建：`TaskQueue` / `Task` 等 + `InMemoryTaskQueue`
- A3: `@neptune/engine/todo/` 新建：`TodoState` + `InMemoryTodoState`
- A4: `@neptune/engine/tool-registry/` 新建：`ToolRegistry` + `InMemoryToolRegistry`
- A5: `@neptune/engine/memory/` 新建：`MemoryStore` + `InMemoryMemoryStore`

每个文件附带类型 + 单元测试。这一阶段**不**触碰现有 builtin tool 实现。

### 10.2 Phase B — 现有工具回迁 + 改造
- B1: `Task*Tool` × 6 + `TodoWriteTool` 从 product 回到 engine `builtin-tools`，重写为通过 `ctx.taskQueue` / `ctx.todoState` 工作
- B2: `ToolSearchTool` 从 product 回到 engine，重写为通过 `ctx.toolRegistry`
- B3: `DiscoverSkillsTool` / `ListPeersTool` 从 product 回到 engine，重写为通过 `ctx.skillRegistry` / `ctx.channel`
- B4: `SkillTool` 改造：从直接读 markdown 文件改为通过 `ctx.skillRegistry`；`parseFrontmatter` 用 engine 的 `SkillFormatter`
- B5: 删 `TeamCreateTool` / `TeamDeleteTool` 在 builtin-tools 的痕迹，让 team 概念变成 TaskQueue / Channel 上的薄壳

### 10.3 Phase C — Memory protocol 新增（产品需求驱动）
- C1: 新增 `MemoryWriteTool` + `MemoryRecallTool`
- C2: product 实现一个 `SqliteMemoryStore` 作为参考 adapter

### 10.4 Phase D — Channel 落地（用户拍板后再做）
- 用户已表态先不动 SendMessageTool。此项暂列。

每一个 Phase 走"5-10 个文件 / batch + 立即闭环验证"节奏，每批走 verify-runtime-boundaries.sh + targeted tests + commit + 同步 develop。

---

## 11. 不会做的事（防屎上雕花）

- **不**抽 LSPTool 出 engine（它是 dev-time 通用能力 — 任何写代码的 agent 都需要 IDE 集成）
- **不**抽 MCP 系列工具出 engine（MCP 是 model context protocol 标准，engine 必须支持）
- **不**抽 BashTool / FileEdit / FileRead / FileWrite / Glob / Grep / WebFetch / WebSearch 出 engine（基础原语）
- **不**强制每个 protocol 都做 Postgres / Redis / Vector 等"重型"参考实现 — InMemory 实现先达到 SDK 可用即可
- **不**因为 builtin-tools 内部还有反向 `src/...` import 就紧急清理 — 先按 Phase A/B 长出新接口，旧 import 自然被替代

---

## 12. 待用户拍板的问题

1. **Memory protocol 是否纳入第一阶段**：如果 Neptune 财务 Solution Pack 短期内不需要"跨 session memory"，可以延后到 Phase C 或更晚。
2. **InMemoryTaskQueue 是否真够用**：财务月结关账场景里 task 是否需要跨重启持久化？如果是，Phase A2 的默认实现需要从一开始就考虑落盘（推荐用 SQLite，依赖 engine 已有 drizzle-orm）。
3. **Skill 注入时机**：`SkillRegistry` 是 per-session 还是 global？per-session 更安全（不同 session 可以加载不同 skill 集），global 更省事。我倾向 per-session。
4. **Phase A 的 TS 接口落地后，是否要发一份 v0.2 草案给用户审才进 Phase B**：我倾向是。
