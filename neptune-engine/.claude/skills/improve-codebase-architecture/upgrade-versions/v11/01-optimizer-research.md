# V11 框架深度分析报告

> 创建时间：2026-04-28
> 分析范围：OKR 路线图 V1-V5 全部 10 个架构缺陷
> 分析方法：5 组并行探索 agent 覆盖 CLI/SDK 边界、分层依赖、Provider 体系、日志权限、文档验收

---

## 一、框架现状分析

### 1.1 代码规模总览

| 目录 | 文件数 | 职责 | 层级 |
|------|--------|------|------|
| engine/ | 60 | Agent Engine SDK 核心 | L2 |
| services/ | 284 | 服务层（API/MCP/compact/analytics） | L3 |
| utils/ | 816 | 工具函数（bash/permissions/model/hooks/swarm） | L2-L3 |
| types/ | 35 | TypeScript 类型定义 | L1 |
| constants/ | 22 | 全局常量（prompts 55K行） | L1 |
| state/ | 8 | 应用状态管理 | L3 |
| src/ 根文件 | ~15 | QueryEngine/query.ts/Tool.ts/tools.ts 等核心 | L2 |
| 其余 | ~30 | tasks/skills/entrypoints/memdir/assistant 等 | L3 |

### 1.2 V1 CLI 外化 — 现状

**CLI 专属代码（可直接迁出）**：

| 文件/目录 | 行数 | src/ 内部导入者 | 风险 |
|-----------|------|----------------|------|
| utils/keyboardShortcuts.ts | 14 | **零** | 低 |
| utils/terminalPanel.ts | 195 | **零** | 低 |
| utils/suggestions/ (6 文件) | 1224 | **零** | 低 |
| utils/status.tsx | 493 | doctorContextWarnings.ts | 中 |
| utils/statusNoticeDefinitions.tsx | 265 | doctorContextWarnings.ts | 中 |
| utils/promptEditor.ts | 188 | 零（依赖 Ink instances） | 低 |
| constants/spinnerVerbs.ts | 204 | spawnInProcess.ts | 低 |
| constants/turnCompletionVerbs.ts | 12 | spawnInProcess.ts | 低 |

**React 依赖已隔离**：
- engine/ 目录：**零 React import**，零 @anthropic/ink import
- state/ 目录已拆分：纯 JS 文件（AppStateStore.ts、store.ts、createAppStateStore.ts）+ React 门面（AppState.tsx）
- CoreAppState（engine/types/CoreAppState.ts, 155 行）是无 React 的 AppState 子集

**共享边界文件**：
- constants/figures.ts — SDK 核心（PermissionMode.ts、model.ts）和 CLI 同时使用，需拆分
- state/AppState.tsx — React 门面，已 re-export 纯 JS 类型

**构建入口**：
- 当前只有一个 build 入口：src/entrypoints/cli.tsx
- src/index.ts 是包导出层（~70 导出），但不是独立构建入口
- **不存在独立的 SDK 构建**

### 1.3 V2 分层治理 — 现状

**engine/ 向上穿透引用：86 处**

按目标模块分布：

| 穿透目标 | 数量 | 关键文件 |
|---------|------|---------|
| src/Tool.ts（工具类型） | 10 | EngineState, CoreAppState, CCRuntime, Bridge, initializeEngine |
| src/types/（类型文件） | 16 | EngineState, SessionContext, CoreAppState, TokenBudgetManager |
| src/utils/（工具函数） | 20 | EngineState, SessionContext, CoreAppState, Bridge, DefaultCCRuntime, HookCore |
| src/QueryEngine.ts | 3 | Bridge, DefaultCCRuntime, CCRuntime |
| src/services/ | 2 | EngineState, CoreAppState |
| src/tools.ts | 1 | initializeEngine |
| src/bootstrap/ | 1 | DefaultCCRuntime |
| 动态 require | 12 | DefaultCCRuntime(6), CoreAppState(2), HookCore(1), 其他(3) |

**最严重的穿透文件**：
1. EngineState.ts — 12 处（最多，但多为 type import）
2. types/CoreAppState.ts — 9 处（8 type import + 2 动态 require）
3. cc-runtime/DefaultCCRuntime.ts — 7 处（6 个动态 require）
4. bridge/OriginalQueryEngineBridge.ts — 7 处
5. bootstrap/initializeEngine.ts — 7 处（含 value import）

**工具注册机制**：
- tools.ts（393 行）静态注册 55+ 工具，全部从 @claude-code-best/builtin-tools 加载
- 条件加载：20 无条件 + 3 ant-only + 11 feature flag + 4 env var + 4 功能检测 + 3 循环依赖 lazy require
- builtin-tools 已是独立 workspace 包，物理隔离做得好

**Feature Flag 系统**：
- engine/ 仅使用 1 个 flag：COORDINATOR_MODE（initializeEngine.ts:400）
- 其余 30+ flags 全在 CLI 层
- SDK 模式下 feature flag 默认返回 false

**lint:layers 现状**：
- 已有 lint-layers.sh（54 行），检查 engine/ 不引用 React/components/hooks/screens/keybindings
- **执行结果：零违规**
- **盲区**：不检查 engine/ 向上穿透到 src/ 根的问题（86 处未检测）

**外部引用**：
- e2e_cli 通过 tsconfig paths 映射 claude-code-best/* → src/*
- 不是真正的 workspace:* 依赖声明
- 绕过包入口，直接引用 engine 内部模块

### 1.4 V3 能力补齐 — 现状

**Provider 体系两套未整合**：

| 维度 | engine/provider（框架层） | services/api（CC 原始层） |
|------|--------------------------|-------------------------|
| LLM 调用 | 无（throw Error） | 7 个完整实现 |
| 流式输出 | 接口定义未实现 | 完整 AsyncGenerator |
| 认证 | 无 | AWS/GCP/Azure/OAuth/API Key 全套 |
| 错误重试 | 无 | 重试 + cost tracking + quota |
| 注册表 | 有（Map） | 无（env var + if/else） |

CC 原始层 7 个 provider：
- firstParty/bedrock/vertex/foundry — 共享 queryModelWithStreaming()，区别仅在 getAnthropicClient()
- openai/gemini/grok — 独立 queryModel*() + convertMessages + convertTools + streamAdapter

**上下文管理**：
- compact 系统有 6 种策略（4 活跃 + 2 stubbed）
- auto-compact：token >= threshold 时全量压缩
- micro-compact：time-based（60min gap 清除旧工具结果）+ cached MC（stubbed）
- API micro-compact：服务端 context_edit 清除
- session memory compact：使用 session memory 文件替代 API 摘要
- **无统一"卸载到文件 + 摘要引用"机制**
- BashTool 已有 DiskTaskOutput 写磁盘机制，可复用

**存储抽象**：
- ISessionStore：CRUD 接口，仅操作 Session 实体
- InMemorySessionStore：Map<string, Session>
- SQLiteSessionStore：bun:sqlite，WAL 模式
- **无通用 Backend 接口**（read/write/delete/list）
- **无 FilesystemBackend**
- ISessionStore 无 dispose() 接口 — SQLite 连接可能泄漏

### 1.5 V4 生产加固 — 现状

**日志系统**：
- 11 个文件，设计完整（LogProvider/EngineLogger/LogFormatter/LogStore）
- **仅文本输出**（StandardLogFormatter），无 JSON 格式化器
- **无 MDC**：搜索 MDC/traceId/correlation/spanId 均无结果
- 多 Session 并行时日志无 session 关联标识
- LogRecord 本身是结构化的，但 FileLogStore 持久化时转为文本

**权限系统**：
- PermissionDelegate 接口：onToolAccess() → 'allow'/'deny'/'ask'
- **仅 1 个实现**：ReadOnlyPermissionDelegate（白名单放行 6 个只读工具）
- **无 RBAC**：全局搜索无结果
- **无审计日志**：权限决策不记录 audit trail
- CC 原始层有完善的 ACL 规则体系（permissions.ts 1487 行），但未暴露到 SDK

**并发安全**：
- SessionManager.sessions Map 无锁，destroyed Session 不清理
- EventBus 监听器无 TTL，无自动 unsubscribe
- 无 GC 定时器，tokenBudgetStates 需手动清理

**资源管理**：
- MCP 子进程有完善的 cleanupRegistry（SIGINT→SIGTERM→SIGKILL 递进）
- FileLogStore 每次 flush 开关文件，无长期持有
- SQLiteSessionStore close() 不在 ISessionStore 接口中
- 无统一句柄池或引用计数

### 1.6 V5 交付验收 — 现状

| 维度 | 现状 | 差距 |
|------|------|------|
| API 文档 | ~30-40% TSDoc 覆盖率 | 差距大，核心类（AgentEngine/EngineFacade）注释少 |
| 示例 | 1 个 CLI 示例（完整） | 缺嵌入式 SDK + Web 服务两种场景 |
| 快速开始 | 不存在 | 需从零创建 |
| 测试 | 5 个单元测试文件，核心类零测试 | claude-code-framework-test/ 目录不存在 |
| workspace 引用 | e2e_cli 可运行但依赖隐式解析 | 缺声明式依赖 |
| 配置校验 | validateEngineConfig 存在但**从未调用** | 缺启动时完整性检查 |

---

## 二、框架目标对齐分析

| 框架目标 | 当前状态 | 对齐度 | 关键差距 |
|---------|---------|--------|---------|
| 物理分离：claude-code/ 只含 SDK 核心 | CLI 专属代码仍在 src/ 中；无独立 SDK 构建 | 60% | ~2,100 行 CLI 代码需迁出；figures.ts 需拆分 |
| 零 UI 依赖 | engine/ 已零 React；state/ 已拆分 | 90% | AppState.tsx React 门面仍在 src/state/ |
| 单向分层依赖 | engine/ 有 86 处向上穿透 | 40% | 最严重：DefaultCCRuntime(7处)、initializeEngine(7处) |
| 外部可引用 | e2e_cli 通过 tsconfig paths 引用 | 50% | 非声明式依赖，绕过包入口 |
| Provider 可用 | 空壳 + 7 个未整合的真实实现 | 20% | AnthropicProvider throw Error |
| 上下文卸载 | compact 系统丰富但无统一卸载机制 | 60% | 需扩展 micro-compact 为文件+摘要模式 |
| 存储抽象 | ISessionStore 仅 Session CRUD | 30% | 无通用 Backend、无 Filesystem |
| 日志 JSON | 仅文本输出，无 MDC | 30% | 需新增 JsonLogFormatter |
| 权限扩展 | 仅 ReadOnlyPermissionDelegate | 20% | 需 RBAC + 审计日志 |
| 生产安全 | SessionManager 无锁、EventBus 无 TTL | 40% | 内存泄漏风险 |

---

## 三、优化清单（按优先级排序，TOP 15）

基于 OKR 路线图 5 个版本的 10 个架构缺陷，识别出 15 个优化点：

| # | 优化重点 | 优先级 | OKR 版本 | 对应缺陷 |
|---|---------|--------|---------|---------|
| 1 | engine/ 穿透依赖清理 | P0 | V2 | 缺陷 3 |
| 2 | CLI 专属代码迁出 | P0 | V1 | 缺陷 1 |
| 3 | figures.ts 边界拆分 | P0 | V1 | 缺陷 1 |
| 4 | 独立 SDK 构建入口 | P0 | V1 | 缺陷 2 |
| 5 | lint:layers 扩展（穿透检查） | P1 | V2 | 缺陷 10 |
| 6 | 工具注册可插拔化 | P1 | V2 | 缺陷 5 |
| 7 | workspace 声明式依赖 | P1 | V2 | — |
| 8 | Provider 整合（包装不替代） | P1 | V3 | 缺陷 4 |
| 9 | 上下文卸载机制 | P1 | V3 | 缺陷 6 |
| 10 | 通用 Backend 抽象 | P2 | V3 | 缺陷 7 |
| 11 | 日志 JSON + MDC | P2 | V4 | 缺陷 8 |
| 12 | RBAC 权限策略 + 审计 | P2 | V4 | 缺陷 9 |
| 13 | 并发安全（GC/TTL/锁） | P2 | V4 | — |
| 14 | API 文档 + 示例 | P3 | V5 | — |
| 15 | 回归测试 + 配置校验 | P3 | V5 | — |

---

## 四、每个优化点的详细 OKR 描述

### 优化 1：engine/ 穿透依赖清理

**优化重点**：消除 engine/ 向 src/ 根的 86 处穿透引用，实现真正的单向分层

**优化目标（Objective）**：engine/ 零向上穿透 import，所有依赖通过接口注入或类型下沉实现

**关键结果（Key Results）**：
- KR1：engine/ 零 `import from '../../根文件'`（当前 86 处 → 0）
- KR2：DefaultCCRuntime 的 6 个动态 require 通过 CCRuntime 接口注入
- KR3：initializeEngine.ts 的 value import（tools.js, model.js）改为通过构造函数参数注入

**预期收益**：engine/ 成为真正独立的 L2 层，可独立构建和测试

**对框架的影响**：
- 破坏框架本质？否 — 清理依赖不影响核心 agent loop
- 正向影响：分层清晰，独立构建，外部可引用
- 负面影响：需要大量文件修改（15+ 文件），回归风险
- 实施风险：中等 — 多为 type import（风险低），value import 和动态 require（风险中）

**符合框架目标**：技术目标 > 核心架构目标 > 单向分层依赖

**依赖关系**：无前置依赖，但建议在 V1 CLI 外化后执行（代码目录更清晰）

---

### 优化 2：CLI 专属代码迁出

**优化重点**：将 src/ 中 ~2,100 行 CLI 专属代码迁出到独立位置

**优化目标（Objective）**：src/utils/ 和 src/constants/ 不再包含 CLI 专属代码

**关键结果（Key Results）**：
- KR1：keyboardShortcuts、terminalPanel、suggestions/、status.tsx、statusNoticeDefinitions.tsx、promptEditor 迁出（零 SDK 导入者）
- KR2：spinnerVerbs.ts、turnCompletionVerbs.ts 迁出（仅 CLI 导入者）
- KR3：SDK `tsc` 编译通过，零回归

**预期收益**：SDK 目录干净，打包后无终端动画/UI 依赖

**对框架的影响**：
- 破坏框架本质？否
- 正向影响：SDK 包体积减小，依赖更少
- 负面影响：CLI 构建路径变更，需同步更新 claude-code-cli/
- 实施风险：低 — 迁出文件零或极少 SDK 导入者

**符合框架目标**：终极目标 > claude-code/ 只包含 SDK 核心

**依赖关系**：无

---

### 优化 3：figures.ts 边界拆分

**优化重点**：将 figures.ts 拆分为 SDK 核心常量 + CLI 专属常量

**优化目标（Objective）**：SDK 核心代码不依赖 CLI 专属的 Unicode 图形常量

**关键结果（Key Results）**：
- KR1：figures.ts 拆分为 figures-core.ts（SDK 使用的 LIGHTNING_BOLT、PAUSE_ICON、BLOCKQUOTE_BAR 等）+ figures-cli.ts（CLI 动画帧等）
- KR2：SDK 核心（PermissionMode.ts、model.ts、markdown.ts）只引用 figures-core.ts
- KR3：13+ 引用文件迁移完毕，tsc 通过

**预期收益**：SDK 不再间接依赖终端动画常量

**对框架的影响**：
- 破坏框架本质？否
- 正向影响：清晰的共享边界
- 负面影响：13+ 文件 import 路径变更
- 实施风险：低 — 仅路径变更

**符合框架目标**：终极目标 > SDK 目录干净

**依赖关系**：可与优化 2 并行

---

### 优化 4：独立 SDK 构建入口

**优化重点**：创建 SDK 专用构建配置，输出 dist/sdk.js + .d.ts

**优化目标（Objective）**：SDK 和 CLI 各自可独立构建，互不影响

**关键结果（Key Results）**：
- KR1：SDK 构建入口 src/index.ts → dist/sdk.js + dist/sdk.d.ts
- KR2：SDK `tsc` 零错误，零 CLI 依赖
- KR3：CLI 通过 @claude-code-best/* 引用 SDK，两套构建独立

**预期收益**：SDK 可独立发布和测试

**对框架的影响**：
- 破坏框架本质？否
- 正向影响：独立构建、独立发布
- 负面影响：需要维护两套构建配置
- 实施风险：中等 — 需要确保 SDK 构建不遗漏必要模块

**符合框架目标**：技术目标 > 独立发布

**依赖关系**：依赖优化 2、3 完成（SDK 目录干净后才能独立构建）

---

### 优化 5：lint:layers 扩展（穿透检查）

**优化重点**：扩展 lint-layers.sh 检查 engine/ 向上穿透到 src/ 根的问题

**优化目标（Objective）**：分层违规自动化检测覆盖全部 86 处穿透

**关键结果（Key Results）**：
- KR1：lint-layers.sh 增加 engine/ 穿透 src/ 根的检查规则
- KR2：按严重度分级：P0（value import）→ P1（动态 require）→ P2（type import）
- KR3：CI 集成，PR 自动检查

**预期收益**：分层违规从"靠人工 review"变为"CI 自动守护"

**对框架的影响**：
- 破坏框架本质？否
- 正向影响：架构质量自动化保障
- 负面影响：开发时约束更严格
- 实施风险：低 — bash 脚本扩展

**符合框架目标**：技术目标 > 分层验证通过

**依赖关系**：可与优化 1 并行（边修边检查）

---

### 优化 6：工具注册可插拔化

**优化重点**：tools.ts 从硬编码 55+ 工具改为可插拔注册

**优化目标（Objective）**：SDK 用户可按需加载工具组，不引入不需要的工具

**关键结果（Key Results）**：
- KR1：定义 ToolRegistry 接口（registerToolSet/getTools/filterTools）
- KR2：默认 core tools（~20 个无条件加载工具），按需加载 builtin-tools（35+ 条件工具）
- KR3：engine/bootstrap/initializeEngine.ts 通过 ToolRegistry 注入，不直接 import tools.js

**预期收益**：SDK 包体积可控，按场景裁剪

**对框架的影响**：
- 破坏框架本质？否
- 正向影响：灵活性提升，SDK 体积减小
- 负面影响：工具顺序可能影响 prompt cache
- 实施风险：中等 — 需要处理 feature flag 与工具注册的耦合

**符合框架目标**：技术目标 > 轻量化框架

**依赖关系**：依赖优化 1（穿透清理后 initializeEngine 不再直接 import tools.js）

---

### 优化 7：workspace 声明式依赖

**优化重点**：e2e_cli 和其他项目通过 workspace:* 声明式依赖 claude-code

**优化目标（Objective）**：外部项目从零到跑通 SDK < 30 分钟

**关键结果（Key Results）**：
- KR1：e2e_cli package.json 声明 workspace:* 依赖 claude-code-best
- KR2：src/index.ts 作为统一入口，覆盖全部公共 API
- KR3：全新项目通过 workspace:* 引用跑通 agent 交互

**预期收益**：SDK 接入成本大幅降低

**对框架的影响**：
- 破坏框架本质？否
- 正向影响：标准化引用方式
- 负面影响：需要确保 index.ts 导出完整
- 实施风险：低

**符合框架目标**：开发体验 > 接入成本 < 1 天

**依赖关系**：依赖优化 4（独立构建入口）

---

### 优化 8：Provider 整合（包装不替代）

**优化重点**：将 services/api/ 的 7 个 provider 适配到 ProviderAdapter 接口

**优化目标（Objective）**：SDK 用户切换配置即可换 LLM 后端

**关键结果（Key Results）**：
- KR1：AnthropicProvider 包装 queryModelWithStreaming()，实现真实 LLM 调用
- KR2：OpenAI/Gemini/GrokProvider 分别包装各自 queryModel*() 函数
- KR3：Bedrock/Vertex/FoundryProvider 通过 getAnthropicClient() 适配
- KR4：ProviderRegistry 默认注册 7 个 provider，按配置选择

**预期收益**：SDK 支持多 LLM 后端，覆盖主流 Provider

**对框架的影响**：
- 破坏框架本质？否 — 包装不替代，不改 CC 原始实现
- 正向影响：多 Provider 支持，SDK 可用性大幅提升
- 负面影响：新增 7 个 adapter 文件，维护成本
- 实施风险：中等偏高 — 流式输出 + token 统计 + 错误重试的统一抽象

**符合框架目标**：技术目标 > 完整能力

**依赖关系**：依赖优化 1（engine 穿透清理后 Provider 更独立）

---

### 优化 9：上下文卸载机制

**优化重点**：大块工具输出自动写入临时文件，context 只保留摘要 + 文件路径

**优化目标（Objective）**：SDK 长时间运行时 token 使用量可控

**关键结果（Key Results）**：
- KR1：所有工具输出超过阈值（如 10K tokens）自动写入磁盘 + 生成摘要引用
- KR2：复用现有 DiskTaskOutput 机制，扩展为统一卸载层
- KR3：Token 使用量下降可测量（对比测试）

**预期收益**：长时间运行的 Agent 会话 token 可控

**对框架的影响**：
- 破坏框架本质？否
- 正向影响：内存和 token 可控
- 负面影响：磁盘 I/O 增加
- 实施风险：中等 — 需要在 micro-compact 执行链中插入卸载逻辑

**符合框架目标**：技术目标 > 高性能

**依赖关系**：无严格前置依赖

---

### 优化 10：通用 Backend 抽象

**优化重点**：ISessionStore 扩展为通用 IBackend 接口，支持多种存储后端

**优化目标（Objective）**：SDK 支持可插拔的存储后端（内存/SQLite/文件系统/Redis/S3）

**关键结果（Key Results）**：
- KR1：定义 IBackend<T> 接口（read/write/delete/list）
- KR2：FilesystemBackend 实现（基于文件系统）
- KR3：SessionStore 改为 IBackend<Session> 上层
- KR4：CompositeBackend 实现按路径路由到不同后端

**预期收益**：SDK 可根据部署环境选择合适的存储策略

**对框架的影响**：
- 破坏框架本质？否
- 正向影响：存储可扩展
- 负面影响：接口变更
- 实施风险：中等 — 需要迁移现有 SessionStore 用户

**符合框架目标**：技术目标 > 可靠性

**依赖关系**：无严格前置依赖

---

### 优化 11：日志 JSON + MDC

**优化重点**：日志系统支持结构化 JSON 输出和自动上下文传播

**优化目标（Objective）**：日志可被 ELK/Datadog 等日志聚合系统消费

**关键结果（Key Results）**：
- KR1：JsonLogFormatter 实现，输出 JSON 格式日志
- KR2：MDC 自动注入 sessionId、requestId（基于 AsyncLocalStorage）
- KR3：多 Session 并行时日志按 sessionId 可区分
- KR4：FileLogStore 支持 JSON 持久化

**预期收益**：生产环境日志可聚合、可追踪

**对框架的影响**：
- 破坏框架本质？否
- 正向影响：生产可观测性
- 负面影响：JSON 日志体积略增
- 实施风险：低 — LogFormatter 是可插拔接口

**符合框架目标**：技术目标 > 可靠性

**依赖关系**：无

---

### 优化 12：RBAC 权限策略 + 审计

**优化重点**：权限系统从单一 ReadOnlyDelegate 扩展为 RBAC + 审计日志

**优化目标（Objective）**：SDK 支持角色-权限映射和权限决策审计

**关键结果（Key Results）**：
- KR1：RBACPermissionDelegate 实现（角色-权限映射表）
- KR2：AuditPermissionDelegate 装饰器（记录 allow/deny/ask 决策到审计日志）
- KR3：权限决策有据可查（持久化审计 trail）

**预期收益**：多租户场景下的权限管理，合规审计支持

**对框架的影响**：
- 破坏框架本质？否 — 权限通过 PermissionDelegate 注入
- 正向影响：生产级权限管理
- 负面影响：接口扩展
- 实施风险：低 — 纯新增实现，不改已有代码

**符合框架目标**：技术目标 > 安全性

**依赖关系**：依赖优化 11（审计日志需要日志系统支持）

---

### 优化 13：并发安全（GC/TTL/锁）

**优化重点**：SessionManager、EventBus 的内存和生命周期管理

**优化目标（Objective）**：SDK 长时间运行无内存泄漏

**关键结果（Key Results）**：
- KR1：SessionManager destroyed Session 定期 GC（定时器清理 Map）
- KR2：EventBus 监听器 TTL + 自动 unsubscribe
- KR3：ISessionStore 增加 dispose() 接口，SQLite 连接可关闭
- KR4：压力测试无泄漏（10+ Session 并发，24 小时运行）

**预期收益**：SDK 可在服务端长时间稳定运行

**对框架的影响**：
- 破坏框架本质？否
- 正向影响：生产稳定性
- 负面影响：GC 行为需要调优
- 实施风险：中等 — 需要验证 GC 不影响正在使用的 Session

**符合框架目标**：技术目标 > 可靠性/高性能

**依赖关系**：依赖优化 10（Backend dispose 与 ISessionStore dispose 协调）

---

### 优化 14：API 文档 + 示例

**优化重点**：SDK 公共 API 100% TSDoc 覆盖 + 3 种场景示例

**优化目标（Objective）**：新用户 30 分钟可理解和使用 SDK

**关键结果（Key Results）**：
- KR1：全部 ~70 公共导出有 TSDoc 注释（含 @param @returns @example）
- KR2：快速开始指南（从零到第一个 Agent 交互）
- KR3：3 种场景示例（嵌入式 SDK / Web 服务 / CLI 工具）
- KR4：TypeDoc 生成 API 文档站

**预期收益**：SDK 接入成本大幅降低

**对框架的影响**：
- 破坏框架本质？否
- 正向影响：开发体验
- 负面影响：文档维护成本
- 实施风险：低

**符合框架目标**：开发体验 > API 文档完整覆盖

**依赖关系**：依赖优化 1-8（API 稳定后再写文档）

---

### 优化 15：回归测试 + 配置校验

**优化重点**：建立回归测试套件和启动时配置校验

**优化目标（Objective）**：每次变更可自动验证无回归

**关键结果（Key Results）**：
- KR1：AgentEngine、EngineFacade、SessionManager、EventBus 核心类有单元测试
- KR2：validateEngineConfig 在 AgentEngine.create() 中调用
- KR3：LLM 配置（apiKey/baseUrl/model）启动时校验
- KR4：CI 全绿（tsc + lint:layers + 全量测试）

**预期收益**：变更质量有保障

**对框架的影响**：
- 破坏框架本质？否
- 正向影响：质量保障自动化
- 负面影响：测试维护成本
- 实施风险：低

**符合框架目标**：质量指标 > 测试覆盖 ≥ 90%

**依赖关系**：无严格前置依赖，但建议 API 稳定后再补充

---

## 五、优化点依赖关系

```
优化 2 (CLI迁出) ──→ 优化 3 (figures拆分) ──→ 优化 4 (SDK构建)
                                                        │
优化 1 (穿透清理) ──→ 优化 5 (lint:layers) ──────────────┤
         │                                              │
         ├──→ 优化 6 (工具可插拔)                        │
         │                                              │
         └──→ 优化 8 (Provider整合)                      │
                                                        │
优化 9 (上下文卸载) ── 独立                              │
                                                        │
优化 10 (Backend抽象) ──→ 优化 13 (并发安全)             │
                                                        │
优化 11 (日志JSON) ──→ 优化 12 (RBAC权限)               │
                                                        │
优化 7 (workspace依赖) ──→ 优化 14 (API文档) ──→ 优化 15 (回归测试)
```

**关键路径**：
1. 优化 2 → 3 → 4 → 7 → 14（CLI 外化 → SDK 构建 → workspace 引用 → 文档）
2. 优化 1 → 6（穿透清理 → 工具可插拔）
3. 优化 1 → 8（穿透清理 → Provider 整合）
4. 优化 10 → 13（Backend 抽象 → 并发安全）
5. 优化 11 → 12（日志 → 权限审计）

---

## 六、映射到 OKR 版本

| OKR 版本 | 包含优化点 | 核心交付物 |
|---------|-----------|-----------|
| **V1 CLI 外化** | 优化 2、3、4 | SDK 目录干净，SDK 和 CLI 各自可构建 |
| **V2 分层治理** | 优化 1、5、6、7 | engine 零穿透，工具可插拔，workspace 可引用 |
| **V3 能力补齐** | 优化 8、9、10 | 7 Provider 可用，上下文卸载，Backend 抽象 |
| **V4 生产加固** | 优化 11、12、13 | 日志 JSON+MDC，RBAC 权限，并发安全 |
| **V5 交付验收** | 优化 14、15 | API 文档，3 个示例，回归测试，配置校验 |

---

## 七、后续行动建议

1. **立即执行 V1**：CLI 专属代码迁出是最低风险、最高确定性的工作，~2,100 行代码零或极少 SDK 导入者
2. **V2 并行推进**：穿透清理和 lint:layers 扩展可同步进行（边修边检查）
3. **V3 Provider 整合**：建议从 firstParty 开始，验证端到端链路后再逐步扩展其他 6 个
4. **V4 日志优先**：JsonLogFormatter 实现简单（LogFormatter 是可插拔接口），可快速交付
5. **V5 贯穿始终**：每个版本完成时同步补充文档和测试，不要集中在最后
