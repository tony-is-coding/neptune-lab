# Agent Engine SDK — 架构与规范

> 本文档是 SDK 的纲领性文件，定义了定位、架构原则、目标架构和研发规约。
> 详细功能设计见 `docs/feature-design/`，执行路线图见 `docs/okr-roadmap.md`。

---

## 一、项目定位

### 核心定义

将 Claude Code 的核心 Agent 能力从 CLI 宿主中解耦，沉淀为通用 **Agent Engine SDK**，使其可以嵌入任意应用。

### 三条底线原则

| # | 原则 | 说明 |
|---|------|------|
| 1 | **包装不替代** | 框架的核心是扩展 Claude Code，不是从头构建。Agent Loop / Query Engine 核心不改。 |
| 2 | **最小改动现有代码** | 优先包裹和外扩，核心 agent loop 尽量不变。 |
| 3 | **渐进式推进** | 每个版本做到位再继续，不设硬性截止时间。 |

### 用户与场景

| 用户类型 | 核心场景 |
|----------|---------|
| **SDK 集成者** | 嵌入 Agent 到 Express/Koa/Electron 应用，随宿主进程启动 |
| **平台开发者** | 基于 SDK 构建上层平台（多租户、任务调度、权限管理） |
| **CLI 维护者** | 维护现有 CLI（基于 SDK 的上层宿主） |
| **DevOps/SRE** | 使用 SDK 构建自动化流水线、监控 Agent 执行 |

### 终极目标

`claude-code/` 目录只包含 SDK 核心代码。外部项目通过 workspace 引用即可使用 Agent 能力。SDK 做到可独立发布、零 UI 依赖、多 Session 并发。

---

## 二、架构原则

### 2.1 强制原则

| # | 原则 | 说明 | 违反后果 |
|---|------|------|---------|
| A1 | **包装不替代** | Agent Loop / Query Engine / Tool System 核心不改，只做外包装 | 一票否决 |
| A2 | **核心状态零 React** | engine/ 零 React 依赖，可在服务端/CI 独立运行 | 阻塞发布 |
| A3 | **事件完全透传** | 不自建事件模型，直接转发 CC 原始 Message | 数据丢失 |
| A4 | **归纳而非发明** | 基于现有代码归纳分层，不重新发明已有设计 | 过度设计 |
| A5 | **状态外化** | SDK 不持有跨 query 的进程内状态，通过可插拔 StorageProvider 外化 | 无法分布 |
| A6 | **Provider 模式** | 框架定义"做什么"（测量/存储/格式），Provider 实现"怎么做" | 耦合 |

### 2.2 建议原则

| # | 原则 | 说明 |
|---|------|------|
| G1 | **目录扁平** | 按模块平铺，不做深度层级嵌套 |
| G2 | **接口开放，实现可插拔** | 框架定义接口，用户注入自定义实现 |
| G3 | **会话是一等公民** | Session 有独立的完整存储通道（元信息 + 内容分开） |
| G4 | **实体与驱动分离** | 存储实体（Session/Memory）和存储驱动（InMemory/SQLite/PG）是独立维度 |
| G5 | **权限委托不硬编码** | 权限行为通过 PermissionDelegate 注入，由宿主决定策略 |

### 2.3 关键架构决策记录

以下决策经深入讨论确认，后续实现以此为准：

| 决策 | 选择 | 理由 | 替代方案（否决） |
|------|------|------|----------------|
| 分布式策略 | **状态外化**，SDK 本身无状态 | SDK 做到无状态，宿主系统自行决定分布式方案 | SDK 内建分布式协调（过度设计） |
| 可观测性 | **Provider 模式**：框架定义 trace/metrics，Provider 导出 | 宿主已有 OTLP/Prometheus，SDK 提供接入点 | SDK 自建 ITracer/IMeter 接口（重复造轮子） |
| 存储架构 | **实体与驱动分离**：不同存储实体有不同接口 | Session 和 Memory 是不同生命周期、不同隔离模型 | 统一 IStorageBackend（过度抽象） |
| 目录组织 | **扁平化 + 按模块目录**，不做层级重组 | 当前 engine/ 按模块分目录已清晰，重组风险高 | 按 7 层重组目录（高风险零收益） |
| 架构与 OKR | **分离**：架构文档描述目标态，OKR 描述执行路径 | 架构变更慢，OKR 变更快，混在一起导致文档失焦 | 合并到一个文档（已证实行不通） |

---

## 三、目标架构

### 3.1 架构全景图

```
┌──────────────────────────────────────────────────────────────────┐
│                     ▲ 框架外 — 开发者应用 ▲                       │
│                                                                    │
│   Web App · Desktop App · CLI · 任务系统 · CI/CD                  │
│                          │ SDK API                                │
├──────────────────────────┼───────────────────────────────────────┤
│                          ▼                                        │
│                                                                    │
│  ┌── L1 编排层 ─────────────────────────────────────────────┐    │
│  │  会话编排 · Query 路由 · 权限管控 · 多租户                 │    │
│  │  AgentEngine · EngineFacade · SessionManager · Session    │    │
│  └──────────────────────────────────────────────────────────┘    │
│                          │                                        │
│  ┌── L2 大脑层 ─────────────────────────────────────────────┐    │
│  │  Agent Loop · 上下文构建 · 记忆注入 · Token 预算           │    │
│  │  QueryEngine(CC 原始) · query.ts(CC 原始) · bridge/       │    │
│  │  SessionContext · TokenBudgetManager · TranscriptParser   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                          │                                        │
│  ┌── L3 双手层 ─────────────────────────────────────────────┐    │
│  │  Tools · Skills · MCP · Sandbox                            │    │
│  │  ToolAdapter · SkillLoader · tools.ts · services/mcp/     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                          │                                        │
│  ┌── L4 扩展层 ─────────────────────────────────────────────┐    │
│  │  Hook · Plugin · 事件过滤                                  │    │
│  │  HookContext · HookCore · EventBus                         │    │
│  └──────────────────────────────────────────────────────────┘    │
│                          │                                        │
│  ┌── L5 模型层 ─────────────────────────────────────────────┐    │
│  │  LLM Provider · 熔断 · 重试 · Token 计费                  │    │
│  │  ProviderAdapter · ProviderRegistry · CircuitBreaker       │    │
│  │  adapters/（7 个 Provider 实现）                           │    │
│  └──────────────────────────────────────────────────────────┘    │
│                          │                                        │
│  ┌── L6 基础设施层 ─────────────────────────────────────────┐    │
│  │  TracingProvider · MetricsProvider · Logger · Config       │    │
│  │  log/（EngineLogger · LogProvider · MDC · JsonLogFormat）  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                          │                                        │
│  ┌── L7 存储层 ─────────────────────────────────────────────┐    │
│  │  SessionStore · MemoryStore · Backend<T>                   │    │
│  │  实体：ISessionStore · IMemoryStore · ISessionContentStore │    │
│  │  驱动：InMemory · Filesystem · SQLite · PG/Redis(用户)     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 层级定义

| 层 | 名称 | 为什么独立 | 变更频率 | 核心文件 |
|----|------|-----------|---------|---------|
| L1 | 编排层 | 会话管理是企业级应用核心关注点，与执行解耦 | 高 | AgentEngine.ts · EngineFacade.ts · SessionManager.ts |
| L2 | 大脑层 | Agent Loop 是系统核心，变更代价最高，必须隔离保护 | 极低 | QueryEngine.ts · query.ts(CC 原始) · bridge/ |
| L3 | 双手层 | Agent 与外部世界交互手段，按需独立扩展 | 中 | tools.ts · ToolAdapter.ts · services/mcp/ |
| L4 | 扩展层 | 用户自定义注入点，不与核心耦合 | 低 | HookContext.ts · EventBus.ts |
| L5 | 模型层 | LLM Provider 可替换，切换不影响上层 | 低 | ProviderAdapter.ts · adapters/ |
| L6 | 基础设施层 | 横切关注点，所有层都可能需要 | 低 | log/ · TracingProvider(待建) |
| L7 | 存储层 | 最底层依赖，上层所有状态最终落到这里 | 极低 | storage/ · ISessionStore · IBackend |

**层级组织规则**：SDK 整体在 `claude-code/` 目录下，模块间可互相引用。分层的目标是目录归属清晰、关注点分离，不是强制禁止引用。

### 3.3 存储层设计

存储层区分**存储实体**（存什么）和**存储驱动**（怎么存）：

```
存储实体（定义数据结构和生命周期）    存储驱动（实现后端能力）
├── ISessionStore（会话元信息）     ├── InMemoryBackend（开发调试）
├── ISessionContentStore（内容）    ├── FilesystemBackend（单实例）
├── IMemoryStore（用户级记忆）      ├── SQLiteSessionStore（轻量生产）
└── IBackend<T>（通用 KV）          └── 用户自定义：PG/Redis/OSS...
```

**会话是一等公民**：Session 的元信息（轻量结构化）和内容（追加型 transcript）分开存储。

**记忆是用户隔离的**：记忆存储按用户维度（`memoryRoot/{userId}/`），与 Session 存储是不同接口和不同生命周期。

### 3.4 可观测性设计

采用 **Provider 模式**：框架定义关键 trace 和 metrics 的埋点，Provider 决定导出到哪。

| Provider | 框架内建的测量点 | 默认实现 | 用户可注入 |
|----------|----------------|---------|-----------|
| **TracingProvider** | query 生命周期、tool_call、provider 调用 | NoOpTracingProvider（零开销） | OTLP · Console · Datadog |
| **MetricsProvider** | token 用量、延迟、并发数、费用 | InMemoryMetricsProvider | OTLP · Prometheus |
| **LogProvider** | 日志输出 | ConsoleLogProvider | ✅ 已实现（FileLogStore · JsonLogFormatter） |
| **ConfigProvider** | 配置归一化 | — | 待实现 |

**关键原则**：SDK 内部的 trace/metrics 是**内禀的**——SDK 知道一个 query 从开始到结束应该有哪些关键节点。Provider 只是决定这些数据发给谁。

### 3.5 状态外化

SDK 的 7 个进程内 Map（sessions、sessionMetadata、activeQueries 等）需要迁移到可插拔的 StorageProvider，使 SDK 做到无状态：

- 基于 SDK 构建的系统能多实例部署
- 存储引擎可选：开发用 InMemory，生产用 PG/Redis
- 实例重启后可从存储恢复状态

---

## 四、现有代码归属

### 4.1 已实现模块（按层级）

#### L1 编排层

| 文件 | 行数 | 职责 |
|------|------|------|
| engine/AgentEngine.ts | 909 | SDK 统一入口 |
| engine/EngineFacade.ts | 196 | Session 管理门面 |
| engine/SessionManager.ts | 160 | Session 注册表 |
| engine/Session.ts | 117 | Session 纯数据实体 |
| engine/types.ts | 87 | Session 类型定义 |
| engine/errors.ts | 53 | EngineError 统一错误码 |
| engine/index.ts | 204 | 公共 API 导出 |
| engine/EngineState.ts | 422 | 核心运行时状态（零 React） |

#### L2 大脑层

| 文件 | 行数 | 职责 |
|------|------|------|
| src/QueryEngine.ts | ~1320 | CC 原始对话状态管理器（不改） |
| src/query.ts | ~1773 | CC 原始 Agent Loop（不改） |
| engine/bridge/ | 263 | 桥接 AgentEngine → CC QueryEngine |
| engine/session/ | 760 | SessionContext + TokenBudget + TranscriptParser |
| engine/cc-runtime/ | 503 | CC 运行时抽象 |
| engine/bootstrap/ | 718 | 引擎初始化 |
| engine/helpers/ | 303 | collectText + waitForResult |
| engine/context/ | 139 | OffloadStrategy 上下文卸载 |

#### L3 双手层

| 文件 | 职责 |
|------|------|
| src/tools.ts (392行) | 工具注册表（55+ 工具） |
| src/Tool.ts (815行) | Tool 类型定义 |
| engine/tools/ToolAdapter.ts | CoreTool/Tool 互转 |
| engine/skill/SkillLoader.ts | SkillExtension 加载 |
| src/services/mcp/ (~50文件) | MCP 协议 |
| src/utils/swarm/ (~13文件) | Swarm 多 Agent 编排 |

#### L4 扩展层

| 文件 | 职责 |
|------|------|
| engine/hooks/HookContext.ts | Hook 核心上下文 |
| engine/hooks/HookCore.ts | Hook 执行 |
| engine/events/EventBus.ts | 发布/订阅 + Hook 拦截 |

#### L5 模型层

| 文件 | 职责 |
|------|------|
| engine/provider/ProviderAdapter.ts | Provider 统一接口 |
| engine/provider/ProviderRegistry.ts | Provider 注册表 |
| engine/provider/CircuitBreaker.ts | 熔断器 |
| engine/provider/adapters/*.ts | 7 个 Provider 实现 |

#### L6 基础设施层

| 文件 | 职责 | 状态 |
|------|------|------|
| engine/log/*（13文件） | 日志系统（Logger · Provider · Store · Formatter · MDC） | ✅ 完整 |
| TracingProvider | 链路追踪 | ❌ 待建 |
| MetricsProvider | 指标采集 | ❌ 待建 |
| ConfigProvider | 配置归一化 | ❌ 待建 |

#### L7 存储层

| 文件 | 职责 | 状态 |
|------|------|------|
| engine/storage/ISessionStore.ts | Session 持久化接口 | ✅ 已实现 |
| engine/storage/IBackend.ts | 通用 KV 存储接口 | ✅ 已实现 |
| engine/storage/InMemorySessionStore.ts | 内存 Session | ✅ 已实现 |
| engine/storage/SQLiteSessionStore.ts | SQLite Session | ✅ 已实现 |
| engine/storage/InMemoryBackend.ts | 内存通用后端 | ✅ 已实现 |
| engine/storage/FilesystemBackend.ts | 文件系统后端 | ✅ 已实现 |
| engine/storage/CompositeBackend.ts | 组合后端 | ✅ 已实现 |
| IMemoryStore | 记忆存储 | ❌ 待建 |
| ISessionContentStore | 会话内容存储 | ❌ 待建 |

### 4.2 已有接口（不需要重新设计）

以下接口在现有代码中已定义并实现：

| 层级 | 关键接口 |
|------|---------|
| L1 | AgentEngineConfig · QueryOptions · EngineStats · SessionConfig · EngineErrorCode |
| L2 | CCRuntime(17方法) · SessionContext(39字段) · TokenBudgetState · OffloadStrategy |
| L3 | ToolAdapter · SkillExtension · QueryEvent(5种事件) |
| L4 | HookContext · HookResult · HookExecutor · EngineEventMap |
| L5 | ProviderAdapter · LLMMessage · LLMTool · LLMRuntime · CircuitBreakerState |
| L6 | EngineLogger · LogLevel · LogProvider · LogStore · LogFormatter · MDCContext |
| L7 | ISessionStore · IBackend\<T\> |

---

## 五、研发规约

### 5.1 开发纪律

| 规约 | 说明 |
|------|------|
| **TDD** | 先写测试再写实现，测试代码放在 `__tests__/` |
| **验证原则** | 不接受"感觉没问题"，结论来自自动化测试或可重复的验证步骤 |
| **渐进式** | 每阶段满足结构验证 + 行为验证 + 目检证 |
| **配置化启动** | `AgentEngine.create(config)` 静态工厂，llm 唯一必填 |

### 5.2 架构变更规约

| 规约 | 说明 |
|------|------|
| **架构文档先行** | 架构变更先更新本文档，再实施代码 |
| **OKR 独立维护** | 执行计划在 `docs/okr-roadmap.md`，不在架构文档中 |
| **归纳优先** | 先分析现有代码，再决定是否需要新设计 |
| **新建模块按层级放置** | 新模块归入明确的层级目录 |

### 5.3 代码规范

| 规约 | 说明 |
|------|------|
| **核心模块零 React** | engine/ 目录下禁止引入 React |
| **类型安全** | 生产代码禁止 `as any`，优先用类型守卫或补充 interface |
| **tsc 零错误** | `bunx tsc --noEmit` 必须通过 |
| **事件透传** | 不自建事件模型，直接转发 CC 原始 Message |

### 5.4 文档规范

| 规约 | 说明 |
|------|------|
| **核心文档在 docs/** | 架构设计、功能设计放 docs/，不散落到其他位置 |
| **事实准确** | 文档内容基于实际代码，不凭空编造 |
| **架构与 OKR 分离** | 架构文档描述目标态（变化慢），OKR 描述执行路径（变化快） |
| **不重复创建** | 已有文档保持更新，不新建替代文档 |

### 5.5 现有文档索引

| 文档 | 位置 | 内容 |
|------|------|------|
| 项目目标 | `docs/project-purpose.md` | 用户画像、使用场景、成功标准 |
| 架构设计 | `docs/architecture-design.md` | 架构图、模块依赖、数据流 |
| OKR 路线图 | `docs/okr-roadmap.md` | 版本交付计划、KR 验收标准 |
| 功能设计 | `docs/feature-design/` | 各组件详细设计文档 |
| 技术参考 | `claude-code/CLAUDE.md` | claude-code 目录技术细节 |
| 项目规范 | `CLAUDE.md`（根目录） | 开发流程、文档管理规范 |

---

## 六、术语

| 术语 | 含义 |
|------|------|
| **CC** | Claude Code — 被包装的原始代码（src/ 下的原始实现） |
| **SDK** | Agent Engine SDK — 本项目的产品（engine/ 包装层 + CC 原始能力） |
| **宿主** | 嵌入 SDK 的上层应用（Express、Electron、CLI） |
| **Provider** | 框架定义接口、用户注入实现的模式（LogProvider、TracingProvider） |
| **实体与驱动** | 存储设计中，实体定义数据结构，驱动实现后端能力 |
| **状态外化** | SDK 不持有进程内状态，通过 StorageProvider 持久化 |
