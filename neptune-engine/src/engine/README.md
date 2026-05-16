# src/engine/ — 模块地图

engine/ 是 Neptune Engine 的 SDK 核心。所有对外暴露的能力都从这里导出。

## 模块总览

```
engine/
├── AgentEngine.ts        ← 统一入口（静态工厂 + Session + Query）
├── SessionManager.ts     ← Session 注册表（内存 + write-through 持久化）
├── Session.ts            ← 单个 Session 实体（状态机）
├── EngineState.ts        ← 引擎运行时状态（纯数据，零 React）
├── errors.ts             ← EngineError 错误体系（错误码 + 错误链）
│
├── bridge/               ← 桥接层：AgentEngine ↔ Claude Code QueryEngine
├── cc-runtime/           ← CC 运行时抽象（ICCRuntime 接口 + 默认实现）
├── session/              ← Session 上下文（ALS 隔离 + TokenBudget）
├── provider/             ← 多 Provider 适配（7 个 LLM 后端）
├── storage/              ← 存储接口 + 实现（Session/Content/Memory/Backend）
├── permissions/          ← 权限委托体系（3 内置模式 + 自定义）
├── events/               ← EventBus（发布/订阅 + Hook 拦截）
├── tools/                ← Tool 适配器（CoreTool ↔ CC Tool 转换）
├── hooks/                ← Hook 执行核心（零 UI）
├── skill/                ← Skill 加载器（文件系统 → workspace）
├── config/               ← 统一配置系统（IConfigProvider）
├── log/                  ← 日志系统（LogUtil + MDC + Formatter）
├── observability/        ← 可观测性（Tracing + Metrics 接口）
├── analytics/            ← Analytics 接口（SDK 模式 NoOp）
├── context/              ← 上下文卸载（长对话截断策略）
├── compat/               ← 非 Bun 环境兼容层
├── helpers/              ← 便捷工具（collectText, waitForResult）
├── state/                ← CoreAppState 工厂
├── types/                ← 内部类型定义
└── types.ts              ← 共享类型（SessionStatus, EventBusMessage 等）
```

## 模块关系

```
┌─────────────────────────────────────────────────────────────────┐
│                        AgentEngine                               │
│  （统一入口：create / createSession / query / on / destroy）      │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────────┘
       │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼
┌──────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐
│ Session  │ │ Event  │ │Storage │ │Provider│ │ Permission │
│ Manager  │ │  Bus   │ │ Layer  │ │Registry│ │  Delegate  │
└────┬─────┘ └────────┘ └───┬────┘ └───┬────┘ └────────────┘
     │                       │          │
     ▼                       ▼          ▼
┌──────────┐          ┌──────────┐ ┌──────────────────────┐
│ Session  │          │ISession  │ │ ProviderAdapter      │
│ Context  │          │Store     │ │ (Anthropic/OpenAI/   │
│ (ALS)    │          │IContent  │ │  Gemini/Grok/        │
└────┬─────┘          │Store     │ │  Bedrock/Vertex/     │
     │                │IMemory   │ │  Foundry)            │
     ▼                │Store     │ └──────────┬───────────┘
┌──────────┐          └──────────┘            │
│  Bridge  │                                  │
│(QE Config│◄─────────────────────────────────┘
│ Builder) │
└────┬─────┘
     │
     ▼
┌──────────────────────┐
│  CC QueryEngine      │
│  (Claude Code 原始   │
│   Agent Loop)        │
└──────────────────────┘
```

## 核心流程

### 流程 1: 创建引擎

```
AgentEngine.create(config)
  │
  ├─ validateAgentEngineConfig(config)     // 配置校验
  ├─ new EventBus()                        // 创建事件总线
  ├─ new SessionManager({ store })         // 创建 Session 管理器（可选持久化）
  ├─ getGlobalCCRuntime()                  // 获取 CC 运行时
  └─ return new AgentEngine(...)           // 返回引擎实例
```

### 流程 2: 创建 Session

```
engine.createSession({ workspace, systemPrompt, provider })
  │
  ├─ sessionManager.createSession()        // 注册 Session（write-through 到 store）
  ├─ createDefaultSessionContext()         // 创建 ALS 上下文
  ├─ 存储 per-session 覆盖                  // systemPrompt / provider
  ├─ loadSkillsToWorkspace()               // 写入 skill 文件到 workspace
  ├─ eventBus.emit('session:created')      // 生命周期事件
  └─ return sessionId
```

### 流程 3: 执行查询（最核心）

```
engine.query(sessionId, input)  →  AsyncGenerator<QueryEvent>
  │
  ├─ 互斥锁检查（同一 session 不能并发 query）
  ├─ 验证 session 状态（必须 active）
  │
  ├─ 获取/创建 QueryEngine（per-session 缓存，保持多轮上下文）
  │   ├─ 解析 effectiveSystemPrompt（per-session > engine 级）
  │   ├─ 解析 effectiveProvider（per-session > engine 级）
  │   ├─ buildQueryEngineConfig()          // Bridge: 构造 QE 配置
  │   │   ├─ 注入 systemPrompt
  │   │   ├─ 注入 tools（ToolExtension → CC Tool 适配）
  │   │   ├─ 注入 permissions（delegate → canUseTool 函数）
  │   │   ├─ 注入 provider（创建 ProviderAdapter 实例）
  │   │   └─ 注入 initialMessages（会话恢复场景）
  │   └─ ccRuntime.createQueryEngine(config)
  │
  ├─ ccRuntime.runWithCwd(workspace, ...)  // 确保正确的工作目录
  │   └─ runInSessionContextAsync(ctx, ...)  // ALS 隔离
  │       └─ for await (msg of qe.submitMessage(input))
  │           ├─ eventBus.emit(msg.type, msg)  // 事件广播
  │           └─ yield msg                      // 流式返回给调用方
  │
  └─ finally:
      ├─ eventBus.emit('query:complete', { modelUsage })
      └─ 释放互斥锁
```

### 流程 4: Session 暂停与恢复

```
engine.pauseSession(sessionId)
  ├─ 解析 transcript.jsonl → 缓存 messages
  ├─ 删除 QueryEngine（释放资源）
  ├─ sessionManager.pauseSession()         // write-through 到 store
  └─ eventBus.emit('session:paused')

engine.resumeSession(sessionId)
  ├─ sessionManager.resumeSession()        // write-through 到 store
  └─ eventBus.emit('session:resumed')
  // 下次 query() 时，缓存的 messages 作为 initialMessages 传入新 QueryEngine
```

## 关键扩展点

### 存储（Storage）

| 接口                     | 职责             | 内置实现                            |
|------------------------|----------------|---------------------------------|
| `ISessionStore`        | Session 元数据持久化 | InMemory, SQLite, Pg            |
| `ISessionContentStore` | 对话内容追加存储       | InMemory, Pg                    |
| `IMemoryStore`         | 用户级记忆隔离        | InMemory, Redis                 |
| `IBackend<T>`          | 通用 KV 存储       | InMemory, Filesystem, Composite |

注入方式：`AgentEngine.create({ sessionStore, sessionContentStore })`

### Provider

| 接口                 | 职责                                  |
|--------------------|-------------------------------------|
| `ProviderAdapter`  | LLM 调用抽象（query 方法返回 AsyncGenerator） |
| `ProviderRegistry` | Provider 注册表（按 type 查找 adapter）     |

注入方式：`AgentEngine.create({ provider: { type, config } })` 或 per-session 覆盖

### 权限（Permissions）

| 接口                   | 职责                                         |
|----------------------|--------------------------------------------|
| `PermissionDelegate` | 单方法接口：`onToolAccess(tool, input) → 'allow' | 'deny' | 'ask'` |

内置实现：`ReadOnlyPermissionDelegate` / `RBACPermissionDelegate` / `AuditPermissionDelegate`

注入方式：`AgentEngine.create({ extensions: { permissions: { delegate } } })`

### 工具（Tools）

| 接口              | 职责                               |
|-----------------|----------------------------------|
| `ToolExtension` | 自定义工具定义（name + schema + execute） |

注入方式：`AgentEngine.create({ extensions: { tools: [...] } })`

### 事件（Events）

| 方法                           | 说明   |
|------------------------------|------|
| `engine.on(type, handler)`   | 订阅事件 |
| `engine.once(type, handler)` | 订阅一次 |
| `engine.off(type, handler)`  | 取消订阅 |

事件类型：`session:created` / `session:paused` / `session:resumed` / `session:destroyed` / `query:complete` / CC 原始消息类型

## 关键设计决策

| 决策                         | 原因                                           |
|----------------------------|----------------------------------------------|
| QueryEngine per-session 缓存 | 保持多轮对话上下文，避免每次 query 重建                      |
| per-session 互斥锁            | CC QueryEngine 不支持并发 submitMessage           |
| ALS (AsyncLocalStorage) 隔离 | 多 session 并发时，getCwd/getSessionId 等全局调用返回正确值 |
| write-through 持久化          | Session 变更立即同步到 store，store 失败降级为内存模式        |
| Bridge 模式                  | 不修改 CC QueryEngine，只在外层构造配置和适配类型             |
| Provider per-session 覆盖    | 支持多租户场景（不同 session 用不同 API key）              |

## 文件导航

想了解某个具体模块的设计？对应的设计文档在 `docs/feature-design/` 下：

| 模块             | 设计文档                                                                       |
|----------------|----------------------------------------------------------------------------|
| Session        | `docs/feature-design/core-components/session-design.md`                    |
| SessionManager | `docs/feature-design/core-components/session-manager-design.md`            |
| EngineState    | `docs/feature-design/core-components/engine-state-design.md`               |
| EventBus       | `docs/feature-design/core-components/event-bus-design.md`                  |
| CCRuntime      | `docs/feature-design/core-components/cc-runtime-design.md`                 |
| Bootstrap      | `docs/feature-design/core-components/bootstrap-design.md`                  |
| Hook           | `docs/feature-design/core-components/hook-core-design.md`                  |
| QueryEngine    | `docs/feature-design/core-components/query-engine-design.md`               |
| 数据流            | `docs/feature-design/core-components/data-flow-design.md`                  |
| 扩展模型           | `docs/feature-design/core-components/extension-model-design.md`            |
| 上下文压缩          | `docs/feature-design/core-components/context-compactor-design.md`          |
| 序列化协议          | `docs/feature-design/core-components/serialization-protocol-design.md`     |
| Memory/Content | `docs/feature-design/core-components/memory-and-session-content-design.md` |
| Storage        | `docs/feature-design/storage-layer/session-store-design.md`                |
| Log            | `docs/feature-design/global-log-optimizer/log-system-design.md`            |
