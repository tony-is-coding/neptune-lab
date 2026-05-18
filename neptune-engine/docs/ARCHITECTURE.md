# Agent Engine 架构设计

> 更新时间：2026-04-29（V21 完成 · V7 技术债收尾 + V7.5 全局状态解耦）
> 覆盖 `src/` 目录全部模块

**核心文档**：
- [SDK 纲领文档](./ARCHITECTURE.md) — 项目定位 + 架构原则 + 目标架构 + 研发规约（首要参考）
- [OKR 路线图](okr-roadmap.md) — 版本交付计划与 KR 验收标准

---

## 一、项目目标

将 Claude Code 的核心 Agent 能力从 CLI 宿主中解耦，沉淀为通用 **Agent Engine SDK**，使其可以：

- 嵌入业务应用（Express/Koa/Electron）、随宿主进程启动
- 被 CLI / Web / App 服务端复用，提供标准 Agent 能力
- 支持多 Session 并发、暂停/恢复、事件监听

核心原则：**包装不替代** — 框架的核心是扩展 Claude Code，不是从头构建。

详细目标与用户画像见上方「一、项目目标」章节。

---

## 二、整体架构图

### 2.1 架构全景图（框架内外分层）

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                          ▲ 框架外 — 开发者应用 ▲                                ║
║                                                                                  ║
║   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        ║
║   │  Web App │  │Desktop App│  │   CLI    │  │ 自动化脚本 │  │ 任务系统  │        ║
║   │ Express  │  │ Electron │  │ readline │  │ CI/CD   │  │ 后台队列  │        ║
║   │ Koa      │  │ Tauri    │  │ 交互式   │  │ 定时任务 │  │ BullMQ  │        ║
║   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        ║
║        │              │              │              │              │              ║
║   ┌────┴──────────────┴──────────────┴──────────────┴──────────────┘              ║
║   │                     传输层 & 端侧实现（开发者自行构建）                         ║
║   │   HTTP/REST · SSE · WebSocket · 进程内直调 · 标准输入输出                      ║
║   └──────────────────────────┬───────────────────────────────────┘                ║
║                              │ 调用 SDK                                          ║
╠══════════════════════════════╪════════════════════════════════════════════════════╣
║                              ▼                                                   ║
║                  ┌───────────────────────┐                                       ║
║                  │   AgentEngine SDK     │  框架对外的唯一接口                     ║
║                  │                       │                                      ║
║                  │  create(config)       │  静态工厂创建引擎                      ║
║                  │  createSession()      │  创建会话                             ║
║                  │  query(id, input)     │  执行查询 → AsyncGenerator<Message>   ║
║                  │  on(type, handler)    │  事件监听（透传 CC 原始事件）            ║
║                  │  loadSession()        │  从 transcript 恢复会话                ║
║                  │  destroy()            │  销毁引擎                              ║
║                  └───────────┬───────────┘                                       ║
║                              │                                                   ║
║  ┌───────────────────────────┼────────────────────────────────────────────────┐  ║
║  │ ▼ 框架内 — 内部同心圆 ▼   │                                                │  ║
║  │                           │                                                │  ║
║  │  ┌────────────────────────┼──────────────────────────────────────────┐     │  ║
║  │  │ Extension 扩展层（用户可选注入）                                      │     │  ║
║  │  │                                                                      │     │  ║
║  │  │  ToolExtension[]    用户自定义工具，适配为 CC Tool 类型              │     │  ║
║  │  │  SkillExtension[]   用户自定义技能，加载到 workspace                │     │  ║
║  │  │  systemPrompt       系统提示词（字符串或异步函数）                   │     │  ║
║  │  │  memoryRoot         记忆存储根目录，支持用户级隔离                  │     │  ║
║  │  │                                                                      │     │  ║
║  │  │  → 未来可扩展：ContextHook / PermissionHook / Middleware ...         │     │  ║
║  │  │                                                                      │     │  ║
║  │  └─────────────────────────────────────────────────────────────────────┘     │  ║
║  │                                                                              │  ║
║  │  ┌───────────────────────────────────────────────────────────────────────┐   │  ║
║  │  │ 框架核心层（我们的包装层）                          engine/ (172文件)  │   │  ║
║  │  │                                                                       │   │  ║
║  │  │  AgentEngine      统一入口：工厂、Session 管理、query、事件、生命周期  │   │  ║
║  │  │  SessionManager   Session 注册表：并发限制、状态查询                  │   │  ║
║  │  │  Session          纯数据实体：sessionId · workspace · status · meta   │   │  ║
║  │  │  EventBus         发布/订阅事件总线：透传 CC Message + 生命周期事件   │   │  ║
║  │  │  Bridge           构造 QueryEngineConfig，适配 Extension Tool         │   │  ║
║  │  │  ToolAdapter      CoreTool/Tool 互转工具（通用适配器）                │   │  ║
║  │  │                                                                       │   │  ║
║  │  │  ─── 辅助模块 ─────────────────────────────────────────────────────   │   │  ║
║  │  │  SessionStore     可选元数据持久化（InMemory / SQLite）               │   │  ║
║  │  │  LogUtil          统一日志系统（收敛 console，结构化输出）            │   │  ║
║  │  │  SkillLoader      将 SkillExtension 加载到 workspace/.claude/skills/ │   │  ║
║  │  │  TranscriptParser JSONL 解析器（会话恢复 fallback）                  │   │  ║
║  │  │  PermissionDelegate 权限委托（ReadOnly + RBAC + Audit）              │   │  ║
║  │  │  ProviderAdapter  LLM Provider 适配（7 Provider + CircuitBreaker）   │   │  ║
║  │  │  EngineState      零 React 核心状态                                  │   │  ║
║  │  │  IBackend         通用存储抽象（InMemory/Filesystem/Composite）      │   │  ║
║  │  │  ITracingProvider 可观测性接口（NoOp + InMemory 实现）               │   │  ║
║  │  │  IConfigProvider  配置归一化（UnifiedConfig + Diagnostics）          │   │  ║
║  │  │                                                                       │   │  ║
║  │  └───────────────────────────────────────────────────────────────────────┘   │  ║
║  │                                                                              │  ║
║  │  ┌───────────────────────────────────────────────────────────────────────┐   │  ║
║  │  │ CC 原始能力（直接使用，不改不替代）                                    │   │  ║
║  │  │                                                                       │   │  ║
║  │  │  QueryEngine.ts  对话状态管理器 (1320行)                             │   │  ║
║  │  │  query.ts        核心 Agent Loop：LLM API 流式调用、工具调度 (1773行)│   │  ║
║  │  │  tools.ts + /*   55+ 内置工具：FileEdit · Bash · Grep · Agent ...    │   │  ║
║  │  │  canUseTool()    权限检查：用户授权、工具白名单                       │   │  ║
║  │  │  transcript.jsonl 会话内容持久化：仅追加、parent-UUID 链              │   │  ║
║  │  │  context.ts      上下文构建：git status · CLAUDE.md · memory         │   │  ║
║  │  │  services/api/*  多 Provider：Anthropic · OpenAI · Gemini · Grok     │   │  ║
║  │  │  AppState        应用状态：消息历史、工具列表、权限状态              │   │  ║
║  │  │                                                                       │   │  ║
║  │  └───────────────────────────────────────────────────────────────────────┘   │  ║
║  └──────────────────────────────────────────────────────────────────────────────┘  ║
║  ▲ 框架内 ▲                                                                        ║
╚════════════════════════════════════════════════════════════════════════════════════╝

图例：
  ╔══╗ 框架外边界    ║═║ 框架内边界    ┌──┐ 同心圆层
  SDK   唯一交互入口 — 开发者通过 SDK 与框架交互，不直接接触内部实现
```

### 2.2 模块依赖关系（src/ 内部完整依赖链）

```
AgentEngine (SDK 入口) ─ engine/AgentEngine.ts
├── SessionManager ─ engine/SessionManager.ts
│   │   ├── Session (纯数据实体)
│   │   ├── SessionStore ─ engine/storage/
│   │   │   ├── InMemorySessionStore
│   │   │   └── SQLiteSessionStore
│   │   ├── SessionContext ─ engine/session/SessionContext.ts (AsyncLocalStorage)
│   │   ├── TokenBudgetManager ─ engine/session/TokenBudgetManager.ts
│   │   └── TranscriptParser ─ engine/session/TranscriptParser.ts
│   ├── EventBus ─ engine/events/EventBus.ts (推+拉双路)
│   ├── OriginalQueryEngineBridge ─ engine/bridge/
│   │   └── CCRuntime ─ engine/cc-runtime/ (统一访问 CC 内部模块)
│   │       └── QueryEngine.ts (CC 原始对话状态管理)
│   │           └── query.ts (CC 原始 Agent Loop)
│   │               ├── services/api/claude.ts (LLM API 流式调用)
│   │               │   ├── services/api/withRetry.ts (重试策略)
│   │               │   └── utils/auth.ts → Provider 路由
│   │               ├── services/compact/compact.ts (上下文压缩)
│   │               ├── services/tools/toolExecution.ts (工具执行调度)
│   │               │   └── Tool.ts → tools.ts → @claude-code-best/builtin-tools (55+ 工具)
│   │               ├── utils/systemPromptType.ts (系统提示词)
│   │               ├── memdir/memdir.ts (记忆加载)
│   │               └── bootstrap/state.ts (进程全局状态)
│   ├── ProviderAdapter ─ engine/provider/（V19 运行时已接入）
│   │   ├── AnthropicProvider → services/api/claude.ts (firstParty)
│   │   ├── BedrockProvider → services/api/claude.ts (Bedrock SDK)
│   │   ├── VertexProvider → services/api/claude.ts (Vertex SDK)
│   │   ├── FoundryProvider → services/api/claude.ts (Foundry SDK)
│   │   ├── OpenAIProvider → services/api/openai/ (Ollama/DeepSeek/vLLM)
│   │   ├── GeminiProvider → services/api/gemini/
│   │   ├── GrokProvider → services/api/grok/
│   │   ├── CircuitBreaker → 熔断保护 + 指数退避重试
│   │   └── ProviderConfigs → 7 Provider 独立配置类型（discriminated union）
│   ├── IBackend ─ engine/storage/ (通用存储抽象)
│   │   ├── InMemoryBackend (内存实现)
│   │   ├── FilesystemBackend (文件系统实现，原子写入)
│   │   ├── CompositeBackend (LRU 混合缓存路由)
│   │   ├── ISessionStore + InMemory/SQLite 实现
│   │   ├── IMemoryStore + InMemory 实现
│   │   └── ISessionContentStore + InMemory 实现
│   ├── OffloadStrategy ─ engine/context/ (上下文卸载)
│   ├── PermissionDelegate ─ engine/permissions/
│   │   ├── ReadOnlyPermissionDelegate (只读策略)
│   │   ├── RBACPermissionDelegate (角色权限策略)
│   │   └── AuditPermissionDelegate (审计日志策略)
│   └── ToolAdapter ─ engine/tools/ToolAdapter.ts
│       └── Tool.ts ↔ tools.ts (CoreTool/UITool 互转)
├── EngineState ─ engine/types/CoreAppState.ts (零 React 核心状态)
├── LogUtil ─ engine/log/ (结构化日志)
│   ├── JsonLogFormatter (JSON 格式输出)
│   └── MDC (上下文诊断信息传播)
├── SkillLoader ─ engine/skill/ (SkillExtension → workspace)
├── HookCore ─ engine/hooks/ (零 UI Hook 执行)
├── Observability ─ engine/observability/
│   ├── ITracingProvider (NoOpTracingProvider 零开销默认)
│   └── IMetricsProvider (NoOpMetricsProvider + InMemoryMetricsProvider)
├── ConfigProvider ─ engine/config/
│   ├── IConfigProvider (NoOpConfigProvider)
│   ├── UnifiedConfig (配置归一化)
│   └── ConfigDiagnostics (配置诊断)
├── CompatLayer ─ engine/compat/ (Feature Flag SDK 兼容)
├── ContextOffload ─ engine/context/ (DefaultOffloadStrategy)
└── Analytics ─ engine/analytics/ (NoOpAnalyticsSink)

─── 支撑服务（被 CC 原始能力调用）───

services/mcp/ ─── MCP 协议 (client/config/auth, 工具发现与注册)
services/api/ ─── 多 Provider API (Claude/Bedrock/Vertex/OpenAI/Grok)
services/compact/ ─── 上下文压缩 (auto-compact/micro-compact)
services/tools/ ─── 工具执行引擎 (StreamingToolExecutor, hook 生命周期)
services/analytics/ ─── 分析统计 (GrowthBook, 事件追踪)
services/oauth/ ─── OAuth 2.0 PKCE 认证
services/langfuse/ ─── Langfuse 可观测性
services/SessionMemory/ ─── 会话记忆提取
services/plugins/ ─── 插件管理

utils/model/ ─── LLM 模型路由 (provider 选择、token 计费)
utils/permissions/ ─── 权限规则 (canUseTool、规则匹配、危险检测)
utils/hooks/ ─── Hook 系统 (注册表、HTTP/Prompt/Agent 执行器)
utils/settings/ ─── 配置管理 (加载/验证/MDM)
utils/git/ ─── Git 操作 (status/diff/blame)
utils/auth.ts ─── 认证 (API Key/OAuth/3P)
utils/config.ts ─── 全局/项目配置读写
utils/bash/ ─── Bash 解析 (AST/管道/heredoc)
utils/swarm/ ─── Swarm 多 Agent 编排
utils/computerUse/ ─── 计算机使用 (截图/键鼠)
utils/teleport/ ─── Teleport 远程会话
utils/processUserInput/ ─── 用户输入处理 (斜杠命令/管道)
utils/suggestions/ ─── 命令/目录补全
utils/plugins/ ─── 插件加载/市场管理

─── 基础层（被所有上层引用）───

types/ ─── TypeScript 类型 (Command·Hook·Message·Tool·Permission·Plugin)
constants/ ─── 全局常量 (prompts 55K行·apiLimits·oauth·betas)
bootstrap/ ─── 启动引导 + state.ts 进程单例 (sessionId·CWD·projectRoot)
```

---

## 三、架构设计原则

> **真相来源**: [ARCHITECTURE-PRINCIPLES.md](../.claude/skills/improve-codebase-architecture/ARCHITECTURE-PRINCIPLES.md)
> 以下为摘要视图，完整定义（含 Why/Scope/Since）见上方链接。

### 强制原则（违反即阻塞）

| # | 原则 | 说明 |
|---|------|------|
| P1 | **包装不替代** | 禁止自建 QueryEngine、工具 handler、LLM 调用层、权限系统、会话存储 |
| P2 | **单向分层依赖** | L0 ← L1 ← L2 ← L3，禁止反向 import |
| P3 | **核心状态零 React** | engine/ 和 state/AppStateStore 零 React 依赖 |
| P4 | **事件完全透传** | 不自建事件模型，直接转发 CC 原始 Message |
| P5 | **权限委托不硬编码** | 权限行为通过 PermissionDelegate 注入 |

### 建议原则（推荐遵循）

| # | 原则 | 说明 |
|---|------|------|
| P6 | **Session = Workspace** | Session 与工作目录一对一映射 |
| P7 | **配置化启动** | `AgentEngine.create(config)` 静态工厂，Extension 模型 |
| P8 | **框架轻量** | 框架只提供 SDK + EventBus，不内置 HTTP/SSE/CLI |
| P9 | **存储分层** | 框架管 Session 元数据，CC 管 transcript 内容 |
| P10 | **命令接口解耦** | CLI 通过 ICommandProvider 注入命令实现 |
| P11 | **组件注册模式** | 框架定义注册点，CLI 注册 UI 组件 |

### 补充原则（v1-v21 提炼）

| # | 原则 | 说明 |
|---|------|------|
| P12 | **全局状态隔离** | AsyncLocalStorage 按会话隔离，不使用裸全局变量 |
| P13 | **Provider 可插拔** | ProviderRegistry + ProviderAdapter 机制，运行时按配置激活 |
| P14 | **深化优先于广化** | 发现浅模块时优先深化，而非横向拆分 |
| P15 | **渐进式改造** | 每阶段必须可验证：测试通过 + 回归通过 + 准入门禁 |

---

## 四、项目目录说明

### 4.1 src/ 目录树

```
src/
├── engine/             (172)  Agent Engine SDK 核心 [L2] — SDK 对外统一接口层
│   ├── AgentEngine.ts         SDK 主入口 (create/query/on/destroy)
│   ├── EngineFacade.ts        (V21 已删除，AgentEngine 直接持有 SessionManager)
│   ├── SessionManager.ts      会话创建/销毁/恢复
│   ├── Session.ts             纯数据实体
│   ├── EngineState.ts         引擎状态 (零 React)
│   ├── bridge/                桥接 CC 原始 QueryEngine
│   ├── events/                EventBus 推+拉双路
│   ├── permissions/           PermissionDelegate 权限委托
│   ├── provider/              LLM Provider 适配（7 Provider + CircuitBreaker + 配置类型）
│   ├── session/               SessionContext, TokenBudget, TranscriptParser
│   ├── storage/               ISessionStore + IBackend（InMemory/SQLite/Filesystem/Composite）
│   ├── tools/                 ToolAdapter (CoreTool↔Tool 互转) + ToolRegistry
│   ├── hooks/                 零 UI Hook 执行
│   ├── log/                   LogUtil 结构化日志（MDC + JsonLogFormatter）
│   ├── skill/                 SkillExtension 加载器
│   ├── cc-runtime/            CC 原始模块统一访问入口
│   ├── observability/         ITracingProvider + IMetricsProvider（NoOp + InMemory）
│   ├── config/                IConfigProvider 配置归一化（UnifiedConfig + Diagnostics）
│   ├── state/                 状态管理模块
│   ├── analytics/             分析统计模块
│   ├── compat/                Feature Flag 兼容层
│   ├── context/               上下文卸载策略（DefaultOffloadStrategy）
│   ├── types/                 类型屏障文件（15 屏障 + 5 内部类型）
│   ├── helpers/               辅助工具函数
│   └── bootstrap/             框架核心启动函数 (V21: initializeEngine 已废弃)
│
├── query.ts             (1773) 核心 Agent Loop — LLM API 调用与工具调度
├── QueryEngine.ts       (1320) 对话状态管理器，封装 query()
├── Tool.ts               (815) Tool 类型接口与工具查找
├── tools.ts              (392) 工具注册表，55+ 工具组装
├── commands.ts           (461) 命令接口 + 注入机制 + 纯框架函数（V9 精简）
├── context.ts            (189) 上下文构建 (git status, CLAUDE.md)
├── history.ts            (464) 对话历史管理
├── cost-tracker.ts       (323) API 费用追踪
├── Task.ts               (125) 任务类型系统
├── tasks.ts               (39) 任务注册表
├── index.ts              (134) 框架公共导出层
│
├── query/                 (5)  查询子系统 [L2] — QueryContext、AbstractQuery、QuerySource 等
├── bootstrap/            (2)  启动引导 [L0] — bridgeConfig + state.ts 进程单例
├── types/                (35)  TypeScript 类型定义 [L1] — Message·Tool·Permission·Plugin·Command 等
├── constants/            (22)  全局常量 [L1] — prompts(55K)·apiLimits·oauth·systemPrompt 等
├── services/            (284)  服务层 [L3]
│   ├── api/             (~95)  API 客户端 — claude.ts(128K), gemini/, grok/, openai/
│   ├── mcp/             (~50)  MCP 协议 — client.ts(119K), config.ts(51K), auth.ts(89K)
│   ├── tools/            (~7)  工具执行引擎 — toolExecution, StreamingToolExecutor
│   ├── compact/         (~28)  上下文压缩 (auto-compact, micro-compact)
│   ├── analytics/       (~10)  分析统计 (GrowthBook, 事件追踪)
│   ├── oauth/           (~12)  OAuth 2.0 PKCE 认证
│   ├── plugins/          (~3)  插件安装/管理
│   ├── langfuse/          (6)  Langfuse 可观测性
│   ├── lsp/               (8)  LSP 语言服务集成
│   ├── SessionMemory/     (3)  会话记忆
│   ├── extractMemories/   (2)  记忆提取
│   ├── teamMemorySync/    (5)  团队记忆同步
│   ├── contextCollapse/   (3)  上下文折叠
│   ├── settingsSync/      (2)  设置跨设备同步
│   ├── remoteManagedSettings/ (4)  远程托管设置
│   ├── policyLimits/      (2)  策略限制
│   ├── tips/              (7)  使用提示
│   ├── AgentSummary/      会话摘要生成
│   ├── PromptSuggestion/  命令建议
│   ├── autoDream/         自动 Dream 模式
│   ├── skillSearch/       技能搜索
│   ├── toolUseSummary/    工具使用统计
│   └── sessionTranscript/ 会话记录处理
│
├── utils/               (816)  工具函数 [L2-L3]
│   ├── bash/             (19)  Bash 命令解析
│   ├── computerUse/      (20)  计算机使用 (截图/键鼠)
│   ├── permissions/      (30)  权限规则匹配
│   ├── model/            (20)  LLM 模型管理与路由
│   ├── plugins/          (47)  插件加载与管理
│   ├── settings/         (21)  配置读写验证
│   ├── swarm/            (17)  Swarm 多 Agent 编排
│   ├── hooks/            (20)  Hook 注册与执行
│   ├── shell/            (13)  Shell 集成
│   ├── suggestions/       (8)  命令/目录补全
│   ├── teleport/          (7)  Teleport 远程会话
│   ├── processUserInput/  (7)  斜杠命令解析
│   ├── git/               (6)  Git 操作封装
│   ├── secureStorage/    (10)  安全凭据存储
│   ├── telemetry/        (12)  OpenTelemetry 遥测
│   ├── deepLink/          (9)  深度链接处理
│   ├── claudeInChrome/    (9)  Chrome 浏览器集成
│   ├── background/        远程会话后台支持
│   ├── dxt/               文本差异化工具
│   ├── filePersistence/   文件持久化
│   ├── github/            GitHub API 集成
│   ├── mcp/               MCP 相关工具
│   ├── memory/            记忆管理
│   ├── messages/          消息处理工具
│   ├── powershell/        PowerShell 支持
│   ├── sandbox/           沙箱环境
│   ├── skills/            技能相关工具
│   ├── task/              任务工具
│   ├── todo/              TODO 管理
│   ├── ultraplan/         UltraPlan 规划
│   └── vendor/            第三方库
│
├── tasks/                (14)  任务系统 [L3]
│   ├── LocalMainSessionTask.ts (15K)  本地主会话任务
│   ├── LocalAgentTask/           本地 Agent 任务
│   ├── LocalShellTask/           Shell 命令任务
│   ├── LocalWorkflowTask/        工作流任务
│   ├── RemoteAgentTask/          远程 Agent 任务
│   ├── InProcessTeammateTask/    进程内队友
│   └── DreamTask/                Dream 模式
│
├── skills/               (28)  技能系统 [L3] — MCP 技能构建器、bundled 内置技能
├── state/                 (8)  应用状态管理 [L3] — AppState、AppStateStore、Selectors
├── entrypoints/          (17)  程序入口 [L3] — CLI 启动入口、SDK 类型定义、状态初始化
├── memdir/                (9)  记忆目录系统 [L3] — MEMORY.md 管理、自动记忆
├── assistant/             (5)  助手会话管理 [L3] — Assistant 会话封装
├── coordinator/           (2)  多 Agent 协调 [L3] — coordinatorMode (19K)
├── proactive/             (2)  主动建议 [L3] — 主动提示系统
├── plugins/               (2)  内置插件注册 [L3]
├── schemas/               (2)  JSON Schema 验证 [L1]
├── outputStyles/          (1)  输出样式加载 [CLI 专用]
└── jobs/                  (1)  作业分类 [CLI 专用]

─── V8 已删除的模块 ───

buddy/                   (已删除) → V8 删除：纯 CLI 娱乐功能

─── V9 已删除/迁移的模块 ───

context/                 (已迁移) → V9 全部迁移到 claude-code-cli/src/context/
commands.ts 精简          → V9 命令注册迁移到 CLI commandRegistry.ts，框架仅保留接口+注入
engine/bootstrap/         → V9 新增 initializeEngine.ts 框架核心启动函数（V21 已废弃并删除）
```

### 4.2 层级速查

| 层级 | 代号 | 对应目录/文件 |
|------|------|---------------|
| L0 | 进程单例 | bootstrap/, state.ts |
| L1 | 类型常量 | types/, constants/, schemas/ |
| L2 | 核心引擎 | engine/, query/, QueryEngine.ts, query.ts, Tool.ts, tools.ts |
| L3 | 服务工具 | services/, utils/, tasks/, skills/, state/, 其余所有 |

---

## 五、关键设计及流程

### 5.1 桥接设计

AgentEngine 通过 `OriginalQueryEngineBridge` 连接 CC 原始 QueryEngine，职责：

1. 为每个 Session 构造 `QueryEngineConfig`（cwd、tools、canUseTool、AppState）
2. 将用户的 `ToolExtension` 适配为 CC `Tool` 类型，合并到工具列表
3. 原始 QueryEngine 产出的 `Message` 同时 yield 和 emit（双路输出）

### 5.2 事件体系

EventBus 同时支持两种消费模式，**不自建事件模型，直接转发 CC 原始 Message**：

| 模式 | API | 场景 |
|------|-----|------|
| 推模式 | `engine.on('assistant', handler)` | 实时 UI 更新 |
| 拉模式 | `for await (const msg of engine.query(...))` | 批处理/脚本/测试 |

### 5.3 存储分工

| 数据 | 管理方 | 格式 |
|------|--------|------|
| Session 元数据 | 框架 (SessionStore) | InMemory / SQLite |
| 会话内容 | CC 原始 (transcript.jsonl) | 仅追加 JSONL |
| Memory/CLAUDE.md | 文件系统 | Markdown |
| Settings | 文件系统 | JSON |

### 5.4 Bootstrap 启动流程

```
1. cli.tsx 入口 → MACRO.* 初始化
2. init.ts → telemetry/config/trust 初始化
3. bootstrap/hooks → 启动钩子执行
4. AgentEngine.create(config)
   ├── new EventBus()
   ├── new SessionManager({ store })
   └── ProviderAdapter + PermissionDelegate 初始化
5. 进入交互/非交互模式
```

### 5.5 查询数据流

```
用户输入 → processUserInput (斜杠命令解析)
  → QueryEngine.query()
    → query.ts (构建 API 请求: system prompt + messages + tools)
      → services/api/claude.ts (调用 LLM API, 流式)
        → 流式响应处理:
          ├── text_delta → 文本输出
          ├── tool_use → canUseTool() → tools/[ToolName]/ → tool_result
          └── message_stop → 查询结束
        → 双路输出:
          ├── EventBus.emit() — 推模式
          └── yield — 拉模式
```

### 5.6 会话恢复流程

```
engine.loadSession({ workspace })
  → 定位 transcript.jsonl
  → 解析 JSONL → Message[]
  → 创建新 Session (绑定 workspace)
  → 首次 query 时作为 initialMessages 传入
```

### 5.7 MCP 连接建立

```
配置加载 → config.ts 解析 mcpServers
  → auth.ts (OAuth 认证, 如有)
  → client.ts (启动 MCP 进程)
  → 枚举 MCP server 工具
  → 注册到 tools.ts 工具列表
  → mcpSkillBuilders 构建技能
```

---

## 六、文档索引

### 核心组件设计
- [Engine Facade](feature-design/core-components/engine-facade-design.md)
- [SessionManager](feature-design/core-components/session-manager-design.md)
- [Session](feature-design/core-components/session-design.md)
- [Event Bus](feature-design/core-components/event-bus-design.md)
- [Bootstrap](feature-design/core-components/bootstrap-design.md)
- [数据流](feature-design/core-components/data-flow-design.md)
- [Extension 模型](feature-design/core-components/extension-model-design.md)
- [EngineState](feature-design/core-components/engine-state-design.md)
- [HookCore](feature-design/core-components/hook-core-design.md)
- [CCRuntime](feature-design/core-components/cc-runtime-design.md)

### 存储层
- [Session Store](feature-design/storage-layer/session-store-design.md)

### CC 原始能力研究
- [QueryEngine 分析](feature-design/core-components/query-engine-design.md)
- [Context Compactor](feature-design/core-components/context-compactor-design.md)
- [记忆与会话内容](feature-design/core-components/memory-and-session-content-design.md)

### 项目管理
- [项目目标](#一项目目标) — 定位、用户画像、场景、成功标准
- [分层架构标准](architecture-layering-standard.md) — L0-L4 定义与 Import 规则
- [OKR 路线图](okr-roadmap.md) — 版本交付路线图
- [CLI 使用说明](cli-usage.md) — CLI 包使用与导入路径规则
