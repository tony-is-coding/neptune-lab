# V3 框架差距分析报告 — 目标架构 Gap Analysis

> 生成时间：2026-04-26
> 基于对 src/（2641 源文件，~483,174 行）的全面扫描
> 对照用户给出的目标 packages 分层架构

---

## 一、框架现状总结

### 1.1 项目核心目标

将 Claude Code 核心执行能力从 CLI 宿主中解耦为通用 Agent Engine 底座，使其可嵌入业务应用、随宿主进程启动，被 CLI/Web/App/服务端复用。

### 1.2 核心设计原则

**包装不替代**：在 Claude Code 之上的管理层和桥接层，不替代原始能力（QueryEngine、tools、权限、API 调用）。

### 1.3 框架使用者典型场景

- 嵌入业务应用（Express/Koa/Electron），通过 SDK 调用 Agent 能力
- CLI 工具（保持现有能力）
- Web 服务（RESTful/SSE 接口）
- 服务端任务系统（后台队列 BullMQ 等）

---

## 二、框架目标对齐分析

### 2.1 目标 Package vs 当前状态总览

| 目标 Package | 当前代码位置 | 已有核心能力 | 独立性 | UI 耦合度 | 差距评级 |
|-------------|------------|------------|--------|----------|---------|
| **packages/agent** | src/engine/, src/query.ts, src/QueryEngine.ts, src/utils/hooks.ts, src/services/compact/, src/utils/cronScheduler.ts | 查询引擎、Hook、Compaction、Cron、AgentEngine 入口 | 高 | 低 | 🟡 中等 |
| **packages/provider** | src/services/api/, src/utils/auth.ts, src/context.ts, src/utils/proxy.ts, src/utils/mtls.ts | 7种 LLM Provider、5种 Auth、流适配、代理/mTLS | 中 | 低 | 🔴 高 |
| **packages/ink** | packages/@ant/ink/ (workspace), src/components/, src/vim/, src/keybindings/ | Ink 框架、Vim、Keybinding、Typeahead | 低 | **核心** | 🟢 低 |
| **packages/agent-tools** | src/Tool.ts, src/tools.ts, src/tools/, src/utils/sandbox/ | ~35-40 工具、Tool 接口、Sandbox | 中 | **高** | 🔴 高 |
| **packages/shell** | src/utils/shell/, src/utils/Shell.ts | ShellProvider 接口、Bash/Zsh/PowerShell | **高** | 极低 | 🟢 低 |
| **packages/config** | src/utils/config.ts, src/utils/settings/ | GlobalConfig、5层合并、FeatureFlag | **高** | 无 | 🟡 中等 |
| **packages/telemetry** | src/services/analytics/ | logEvent、GrowthBook、Datadog、1P 批处理 | **高** | 极低 | 🟡 中等 |
| **packages/memory** | src/memdir/, src/services/extractMemories/ | 文件系统记忆、4种类型、提取 | **高** | 极低 | 🟡 中等 |
| **packages/permission** | src/utils/permissions/, src/types/permissions.ts | 7种模式、规则管道、AI 分类器 | 中 | 低 | 🟡 中等 |
| **packages/swarm** | src/utils/swarm/, src/utils/teammateMailbox.ts, src/services/teamMemorySync/ | 进程/Tmux/iTerm2 后端、权限同步、邮箱 | 中 | 中 | 🟡 中等 |
| **packages/ide** | src/utils/ide.ts, src/services/lsp/, src/utils/jetbrains.ts | LSP Client/Server、VS Code/JetBrains 集成 | 中 | 中 | 🟡 中等 |
| **packages/server** | src/server/ | 类型定义、DirectConnect | 低 | 低 | 🔴 高 (70% stub) |
| **packages/teleport** | src/utils/teleport.tsx, src/components/Teleport* | Git 打包、环境选择、API 集成 | 中 | 中 | 🟡 中等 |
| **packages/updater** | src/utils/nativeInstaller/, src/utils/autoUpdater.ts | 原生安装器、二进制下载、自动更新 | 中 | 中 | 🟢 低 |
| **packages/cli** | src/cli/, src/cli/transports/ | SSE/WS/Hybrid Transport、StructuredIO | 中 | 低 | 🟡 中等 |

### 2.2 评级说明

- 🟢 **低差距**：当前实现与目标基本对齐，独立性好，仅需小幅整理
- 🟡 **中等差距**：核心能力存在但需要接口标准化、耦合解耦、或拆分重组
- 🔴 **高差距**：缺少关键抽象接口、与 UI 深度耦合、或大量 stub

---

## 三、优化清单（TOP 21，按优先级排序）

---

### 【P0 — 架构基础】必须先完成，是其他优化的前提

---

#### 优化 #1：Tool 系统 UI 解耦 — CoreTool/UITool 完整分离

**优化重点**：将 Tool 接口中 ~40% 的 UI 渲染方法完整剥离到 UITool，使核心工具逻辑零 UI 依赖

**优化目标（Objective）**：Tool 核心逻辑可脱离 React/Ink 独立运行

**关键结果（Key Results）**：
- KR1: `CoreTool` 接口只包含 `call()`, `description()`, `inputSchema`, `checkPermissions()`, `isEnabled()`, `isReadOnly()`, `isConcurrencySafe()` — 7 个核心方法，零 React 依赖
- KR2: 所有 UI 渲染方法（`renderToolUseMessage`, `renderToolResultMessage`, `renderToolUseProgressMessage`, `renderGroupedToolUse`, `renderToolUseRejectedMessage`, `renderToolUseErrorMessage`, `userFacingName`, `getToolUseSummary`, `getActivityDescription`）移入 `UITool`
- KR3: ~35 个工具实现文件完成拆分，核心部分 import 不含 `@anthropic/ink` 或 `React`

**预期收益**：
- 工具可在 headless/SDK/server 场景独立运行
- 工具测试不需要 React 渲染环境
- 工具库可独立打包为 `packages/agent-tools`

**对框架的影响**：
- 符合"包装不替代"原则 ✅ — 不改工具逻辑，只拆分接口
- 正向：核心工具零 UI 依赖，为 packages/agent-tools 独立打包铺路
- 负向：需要逐个工具调整实现，工作量大
- 风险：中等 — `ToolAdapter.ts` 已有互转逻辑可复用，但需验证所有消费者

**符合框架目标**：嵌入业务应用（工具独立运行）、被服务端复用（headless 工具执行）

**依赖关系**：无前置依赖，可立即开始

---

#### 优化 #2：Provider 适配器接口统一

**优化重点**：建立统一的 `ProviderAdapter` 接口，替代 claude.ts 中的 if/else 分发

**优化目标（Objective）**：所有 LLM Provider 通过统一接口调用，新增 Provider 只需实现接口

**关键结果（Key Results）**：
- KR1: 定义 `ProviderAdapter` 接口（`queryStream()`, `query()`, `isAvailable()`, `listModels()`）
- KR2: 7 种 Provider（Anthropic/Bedrock/Vertex/Foundry/OpenAI/Gemini/Grok）各自实现 `ProviderAdapter`
- KR3: `claude.ts`（3483行）中的 if/else 分发替换为 Provider 注册表查找

**预期收益**：
- 新增 Provider（通义千问、本地推理）只需实现接口
- Provider 可独立测试、独立打包
- 消除 claude.ts（3483行）中最大的复杂度来源

**对框架的影响**：
- 符合"包装不替代"原则 ✅ — 包装现有 Provider 实现为接口
- 正向：为 `packages/provider` 独立打包铺路
- 负向：需要重构 claude.ts 的核心分发逻辑
- 风险：中等 — 核心路径，需充分测试

**符合框架目标**：支持更多使用场景（多 Provider 扩展）

**依赖关系**：无前置依赖，可与 #1 并行

---

#### 优化 #3：Auth 策略模式统一

**优化重点**：建立统一的 `AuthProvider` 接口，将 5 种认证方式收敛为策略模式

**优化目标（Objective）**：认证层可插拔，新增认证方式只需实现 AuthProvider 接口

**关键结果（Key Results）**：
- KR1: 定义 `AuthProvider` 接口（`getCredentials()`, `refresh()`, `invalidate()`）
- KR2: 5 种认证实现（OAuth/APIKey/AWS/GCP/Azure）各自封装为 AuthProvider
- KR3: auth.ts（1999行）的职责缩减为 AuthProvider 注册和选择

**预期收益**：
- 新增认证方式（企业 SSO 等）只需实现接口
- auth.ts 从 1999 行巨型文件变为轻量注册器
- 认证可独立测试

**对框架的影响**：
- 符合"包装不替代"原则 ✅
- 正向：认证层可独立演进
- 负向：auth.ts 是全局热路径，改动需谨慎
- 风险：中等

**符合框架目标**：降低接入成本（认证简化）

**依赖关系**：可与 #2 并行（同属 provider 层）

---

#### 优化 #4：StreamAdapter 接口统一

**优化重点**：建立统一的 `StreamAdapter` 接口，将各 Provider 的流适配器归一化

**优化目标（Objective）**：所有 LLM 流响应通过统一 StreamAdapter 转换为内部事件格式

**关键结果（Key Results）**：
- KR1: 定义 `StreamAdapter<T>` 接口（输入任意流 → 输出 `BetaRawMessageStreamEvent`）
- KR2: OpenAI streamAdapter（376行）和 Gemini streamAdapter（244行）实现统一接口
- KR3: Grok 的流复用逻辑从硬编码改为通过 StreamAdapter 注册

**预期收益**：
- 新 Provider 只需提供 StreamAdapter 实例
- 流转换逻辑可独立测试
- 消除 OpenAI/Gemini 适配器的代码重复

**对框架的影响**：
- 符合"包装不替代"原则 ✅
- 正向：流处理标准化
- 负向：改动面较小
- 风险：低 — 输出类型不变

**符合框架目标**：支持更多使用场景（多 Provider）

**依赖关系**：与 #2 紧密相关，建议 #2 完成后做

---

#### 优化 #5：ContextProvider 管线可插拔化

**优化重点**：将硬编码的上下文构建函数链（GitStatus → ClaudeMd → Date → Attribution）重构为可插拔管线

**优化目标（Objective）**：上下文构建可通过配置注入，支持自定义上下文源

**关键结果（Key Results）**：
- KR1: 定义 `ContextProvider` 接口（`name`, `priority`, `build(): Promise<string>`）
- KR2: 内置 Provider 迁移：GitStatusProvider, ClaudeMdProvider, DateProvider, AttributionProvider
- KR3: `context.ts`（189行）从硬编码函数链改为 Provider 注册 + 按优先级执行

**预期收益**：
- 框架使用者可注入自定义上下文（如数据库 schema、API 文档）
- 上下文构建可独立测试
- 为 SDK 场景提供灵活配置

**对框架的影响**：
- 符合"包装不替代"原则 ✅ — 包装现有函数
- 正向：可扩展性大幅提升
- 负向：需要确保管线顺序和缓存行为不变
- 风险：低

**符合框架目标**：嵌入业务应用（自定义上下文）

**依赖关系**：可与 #2-#4 并行

---

#### 优化 #6：AppState 解耦 — 核心状态与 UI 状态分离

**优化重点**：将 AppState 中的核心运行时状态（messages、tools、permissions）与 UI 渲染状态分离

**优化目标（Objective）**：核心逻辑不再依赖 React Context/Provider

**关键结果（Key Results）**：
- KR1: 识别 AppState（200行）中属于核心逻辑的字段 vs UI 渲染字段
- KR2: 核心字段迁移到 engine 层的 `SessionContext` 或 `EngineState`
- KR3: UI 层通过订阅机制获取核心状态，而非直接访问 React Context

**预期收益**：
- 核心逻辑可在非 React 环境运行（headless/SDK/server）
- Permission 系统不再间接依赖 React（通过 AppState）
- 为 packages/agent 独立运行铺路

**对框架的影响**：
- 需谨慎评估 — AppState 是整个系统的枢纽
- 正向：彻底解耦核心与 UI
- 负向：改动面广，几乎所有组件都依赖 AppState
- 风险：高 — 需要分阶段渐进

**符合框架目标**：嵌入业务应用（非 React 环境运行）

**依赖关系**：前置：#1（Tool UI 解耦），#7（SessionStorage 拆分）

---

#### 优化 #7：SessionStorage 巨型文件拆分

**优化重点**：将 `utils/sessionStorage.ts`（5106 行）按职责拆分为独立模块

**优化目标（Objective）**：每个会话存储职责独立、可测试、可替换

**关键结果（Key Results）**：
- KR1: sessionStorage.ts 拆分为 3-5 个模块（存储路径管理、消息序列化、会话索引、文件锁、缓存策略）
- KR2: 每个模块 < 1500 行，有清晰的导出接口
- KR3: 现有功能 100% 回归通过

**预期收益**：
- 可维护性大幅提升
- 会话存储可独立演进
- 为 packages/agent 的 Session 管理提供清晰基础

**对框架的影响**：
- 符合"包装不替代"原则 ✅ — 纯拆分
- 正向：代码组织清晰
- 负向：无
- 风险：低 — 纯文件拆分

**符合框架目标**：清晰架构、可维护性

**依赖关系**：无前置依赖，可立即开始

---

#### 优化 #8：QueryDeps 依赖注入扩展

**优化重点**：将 QueryDeps 从仅 4 个依赖扩展为完整的 DI 机制

**优化目标（Objective）**：query() 的所有外部依赖可通过 DI 注入，实现完整可测试性

**关键结果（Key Results）**：
- KR1: QueryDeps 扩展覆盖：runTools, handleStopHooks, logEvent, compactConversation, queue 操作
- KR2: 所有 query 相关测试使用 mock deps，不再依赖 spyOn
- KR3: CCRuntime 与 QueryDeps 统一为一致的 DI 体系

**预期收益**：
- query() 完全可测试
- 不同宿主（CLI/SDK/server）可注入不同 deps
- DI 体系统一

**对框架的影响**：
- 符合"包装不替代"原则 ✅
- 正向：可测试性、可扩展性
- 负向：需要梳理所有 query() 的外部依赖
- 风险：低 — 渐进式添加

**符合框架目标**：被多种宿主复用（不同 DI 配置）

**依赖关系**：可与 #6 并行

---

### 【P1 — 模块独立】在 P0 基础上，将各模块推向独立打包

---

#### 优化 #9：Shell 独立打包准备

**优化重点**：Shell 执行层已经高度独立，完成最后的接口标准化，使其可独立为 packages/shell

**优化目标（Objective）**：Shell 模块零外部依赖，可独立导入使用

**关键结果（Key Results）**：
- KR1: Shell.ts（474行）中的 analytics 调用改为可选回调注入
- KR2: 确认 ShellProvider 接口、BashProvider、PowerShellProvider 无 UI 依赖
- KR3: 验证 e2e CLI 可独立使用 Shell 模块

**预期收益**：
- Shell 可嵌入任何宿主（不需要 Ink）
- 独立测试和发布

**对框架的影响**：
- 符合"包装不替代"原则 ✅
- 风险：低 — 改动极小

**符合框架目标**：嵌入业务应用

**依赖关系**：无前置依赖

---

#### 优化 #10：Config 接口标准化

**优化重点**：将函数式的配置管理标准化为 `SettingsManager` 接口

**优化目标（Objective）**：配置管理有清晰的接口契约，支持不同的存储后端

**关键结果（Key Results）**：
- KR1: 定义 `ISettingsManager` 接口（get, set, merge, watch, getFeatureFlag）
- KR2: 当前函数式实现包装为 `DefaultSettingsManager`
- KR3: GlobalConfig 类型（578行）按职责拆分为子类型

**预期收益**：
- 配置可替换（测试用 MemorySettingsManager）
- 为企业场景提供 RemoteSettingsManager 基础
- GlobalConfig 类型更易理解

**对框架的影响**：
- 符合"包装不替代"原则 ✅
- 风险：低 — 接口包装

**符合框架目标**：降低接入成本

**依赖关系**：无前置依赖

---

#### 优化 #11：Permission 系统与 AppState 解耦

**优化重点**：将权限检查从依赖 AppState 的 React Context 改为纯函数调用

**优化目标（Objective）**：权限系统零 React 依赖，可在任何环境运行

**关键结果（Key Results）**：
- KR1: `hasPermissionsToUseTool()` 不再依赖 React Context，改为接收 `ToolPermissionContext` 参数
- KR2: 权限规则加载（permissionSetup.ts 1533行）与 UI 初始化解耦
- KR3: 权限系统可在 headless/SDK 模式完整工作

**预期收益**：
- 权限系统可独立打包为 packages/permission
- headless 模式下权限自动执行（bypassPermissions 或 rule-based）

**对框架的影响**：
- 正向：独立部署
- 风险：中等 — 需要改变权限检查的调用方式

**符合框架目标**：被服务端复用（headless 权限）

**依赖关系**：前置：#6（AppState 解耦）

---

#### 优化 #12：Memory 系统接口化

**优化重点**：将文件系统驱动的记忆系统抽象为 `MemoryStore` 接口

**优化目标（Objective）**：记忆存储可替换（文件系统/SQLite/远程 API）

**关键结果（Key Results）**：
- KR1: 定义 `IMemoryStore` 接口（save, load, list, delete, search）
- KR2: 当前文件系统实现包装为 `FileSystemMemoryStore`
- KR3: 测试用 `InMemoryMemoryStore` 可注入

**预期收益**：
- 记忆系统可独立打包
- 支持不同的存储后端（企业场景用远程存储）

**对框架的影响**：
- 符合"包装不替代"原则 ✅
- 风险：低

**符合框架目标**：嵌入业务应用（自定义存储）

**依赖关系**：无前置依赖

---

#### 优化 #13：Telemetry 接口标准化

**优化重点**：将函数式的 logEvent/logEventAsync 标准化为 `ITelemetryService` 接口

**优化目标（Objective）**：遥测可替换，支持 NoopTelemetry（禁用）和自定义 Sink

**关键结果（Key Results）**：
- KR1: 定义 `ITelemetryService` 接口（logEvent, logEventAsync, setMetadata）
- KR2: 当前实现包装为 `DefaultTelemetryService`
- KR3: 提供 `NoopTelemetryService`（SDK/embedded 场景禁用遥测）

**预期收益**：
- 嵌入式场景可完全禁用遥测
- 遥测可替换为企业自有的分析系统

**对框架的影响**：
- 符合"包装不替代"原则 ✅
- 风险：低 — 接口包装
- 注意：GrowthBook 的 feature flag 功能不在遥测接口内

**符合框架目标**：嵌入业务应用（禁用遥测）

**依赖关系**：无前置依赖

---

#### 优化 #14：Hook 系统与 UI 解耦

**优化重点**：将 hooks.ts（5177行）中的 UI 依赖（hookEvents pendingEvents 缓冲机制）剥离

**优化目标（Objective）**：Hook 执行核心逻辑零 UI 依赖

**关键结果（Key Results）**：
- KR1: hooks.ts 中的 12 个 execute 函数不依赖任何 React 类型
- KR2: hookEvents 的缓冲机制改为通用事件发射器（EventBus）
- KR3: UI 层的 hook 渲染（components/permissions/hooks.ts）通过订阅核心事件实现

**预期收益**：
- Hook 可在 headless/SDK 模式完整工作
- Hook 测试不需要 React 环境

**对框架的影响**：
- 正向：核心 Hook 独立
- 风险：中等 — hooks.ts 是 5177 行的核心文件

**符合框架目标**：被服务端复用

**依赖关系**：前置：#6（AppState 解耦）

---

#### 优化 #15：REPL.tsx 拆分

**优化重点**：将 `screens/REPL.tsx`（6314 行）按职责拆分为多个组件

**优化目标（Objective）**：REPL 入口文件聚焦于 UI 编排，核心逻辑下沉

**关键结果（Key Results）**：
- KR1: REPL.tsx 中的查询编排逻辑移入 engine 层
- KR2: REPL.tsx 中的权限处理逻辑移入 permission UI 组件
- KR3: 拆分后 REPL.tsx < 1500 行

**预期收益**：
- REPL 可维护性提升
- 核心逻辑可被其他 UI（Web/Desktop）复用

**对框架的影响**：
- 正向：核心逻辑可复用
- 风险：中等 — REPL 是 UI 与核心的最大交汇点

**符合框架目标**：被多种 UI 复用

**依赖关系**：前置：#6（AppState 解耦），#14（Hook 解耦）

---

### 【P2 — 扩展完善】架构基础稳固后的增强

---

#### 优化 #16：Server 层 stub 完善

**优化重点**：将 server/ 目录中 7/11 个 stub 文件实现为真实功能

**优化目标（Objective）**：Server 层可独立运行，提供 HTTP/SSE/WebSocket 接入能力

**关键结果（Key Results）**：
- KR1: `server.ts`, `sessionManager.ts`, `lockfile.ts` 实现完整功能
- KR2: `connectHeadless.ts` 实现 headless 连接模式
- KR3: Server 可独立启动并管理多 Session

**预期收益**：
- 提供 HTTP API 接入能力
- 为 Web App 场景提供后端

**对框架的影响**：
- 正向：新的接入方式
- 风险：中等 — 需要设计 API

**符合框架目标**：Web 服务场景

**依赖关系**：前置：#6（AppState 解耦），#8（QueryDeps 扩展）

---

#### 优化 #17：OutputTarget 抽象

**优化重点**：建立统一的输出目标抽象，支持 Terminal/JSON/Web/Silent

**优化目标（Objective）**：相同的核心输出可路由到不同的目标

**关键结果（Key Results）**：
- KR1: 定义 `OutputTarget` 接口（`write()`, `flush()`, `close()`）
- KR2: 实现 TerminalOutput（Ink）、JSONOutput（SDK）、SilentOutput（后台）
- KR3: 消除核心代码中直接的 console.log/Ink render 调用

**预期收益**：
- SDK 模式输出 JSON，CLI 模式输出 Ink，后台模式静默
- 输出格式可扩展

**对框架的影响**：
- 正向：统一输出模型
- 风险：低

**符合框架目标**：被多种宿主复用

**依赖关系**：前置：#1（Tool UI 解耦），#15（REPL 拆分）

---

#### 优化 #18：ToolRegistry 扩展点设计

**优化重点**：将 tools.ts 的函数式工具注册改造为可扩展的 ToolRegistry

**优化目标（Objective）**：工具注册支持内置（静态）、MCP（动态）、Plugin、用户自定义

**关键结果（Key Results）**：
- KR1: 定义 `IToolRegistry` 接口（register, unregister, get, list）
- KR2: 内置工具静态注册、MCP 工具动态注册
- KR3: 支持 Plugin 工具和用户自定义工具的注册

**预期收益**：
- 工具可动态增减
- 支持第三方工具插件

**对框架的影响**：
- 符合"包装不替代"原则 ✅
- 风险：低

**符合框架目标**：支持更多使用场景

**依赖关系**：前置：#1（Tool UI 解耦）

---

#### 优化 #19：Compaction stub 实现

**优化重点**：将 services/compact/ 中 4 个 stub（Reactive/Snip/Cached 等）实现为完整功能

**优化目标（Objective）**：压缩策略丰富，支持更多场景

**关键结果（Key Results）**：
- KR1: Reactive Compact 实现完成
- KR2: Snip Compact 实现完成
- KR3: 通过 feature flag 控制，不影响现有行为

**预期收益**：
- 更灵活的上下文管理
- 长对话性能提升

**对框架的影响**：
- 正向：压缩能力增强
- 风险：低 — feature-gated

**符合框架目标**：系统稳定性

**依赖关系**：无严格前置

---

#### 优化 #20：GlobalConfig 类型瘦身

**优化重点**：将 GlobalConfig（578 行类型，100+ 字段）按职责拆分为子类型

**优化目标（Objective）**：每个配置领域有独立的类型，GlobalConfig 变为组合类型

**关键结果（Key Results）**：
- KR1: 拆分为 UserPreferences, ProjectConfig, AuthConfig, CacheConfig, IDEConfig 等子类型
- KR2: GlobalConfig = UserPreferences & ProjectConfig & AuthConfig & ...
- KR3: 各子类型可独立读写

**预期收益**：
- 配置类型更易理解
- 各配置领域可独立演进
- 减少配置变更的爆炸半径

**对框架的影响**：
- 正向：代码组织
- 风险：低 — 纯类型拆分

**符合框架目标**：可维护性

**依赖关系**：前置：#10（Config 接口标准化）

---

#### 优化 #21：Stub 文件清理与整合

**优化重点**：清理代码库中约 70+ 个 stub 文件，整合 re-export stub

**优化目标（Objective）**：代码库中无冗余 stub，模块边界通过 package.json 管理

**关键结果（Key Results）**：
- KR1: cli/src/, screens/src/, components/*/src/ 下约 100+ 个 re-export stub 整合
- KR2: ssh/ 目录的 2 个 stub 决定实现或删除
- KR3: services/ 下的 stub 决定排期或删除

**预期收益**：
- 代码库清洁度提升
- 减少维护负担

**对框架的影响**：
- 正向：代码清洁
- 风险：低

**符合框架目标**：可维护性

**依赖关系**：依赖各模块的拆分进度

---

## 四、优化点依赖关系

```
P0（架构基础）─────────────────────────────────────────────
#7 SessionStorage 拆分 ─┐
#9 Shell 独立打包 ──────┤
#10 Config 接口标准化 ──┤
#12 Memory 接口化 ──────┤── 无前置依赖，可并行启动
#13 Telemetry 标准化 ───┤
#2 Provider 接口统一 ───┤
#3 Auth 策略统一 ───────┤
#5 Context 管线可插拔 ──┘
        │
#1 Tool UI 解耦 ──────────── 可与其他 P0 并行
        │
#4 StreamAdapter 统一 ────── 依赖 #2
#8 QueryDeps 扩展 ────────── 可并行
        │
#6 AppState 解耦 ─────────── 依赖 #1, #7
        │
P1（模块独立）─────────────────────────────────────────────
#11 Permission 解耦 ──────── 依赖 #6
#14 Hook 解耦 ────────────── 依赖 #6
#15 REPL 拆分 ────────────── 依赖 #6, #14
        │
P2（扩展完善）─────────────────────────────────────────────
#16 Server stub 完善 ─────── 依赖 #6, #8
#17 OutputTarget 抽象 ────── 依赖 #1, #15
#18 ToolRegistry 扩展 ────── 依赖 #1
#19 Compaction stub 实现 ─── 无严格前置
#20 GlobalConfig 瘦身 ────── 依赖 #10
#21 Stub 清理 ────────────── 依赖各模块拆分
```

---

## 五、每层差距详细对照

### 5.1 packages/agent（核心引擎）— 差距评级 🟡

| 目标能力 | 当前状态 | 差距 | 对应优化 |
|---------|---------|------|---------|
| query() streaming/recovery/abort | ✅ query.ts 1773行，AsyncGenerator | 无 | — |
| QueryEngine turn 管理 | ✅ QueryEngine.ts 1320行 | 无 | — |
| HookLifecycle 27种事件 | ✅ 24种事件，5177行 | 3种事件缺失 | #14 |
| CompactionService | ✅ 7种模式（4种stub），4051行 | stub 未实现 | #19 |
| CronScheduler | ✅ 完整，1908行，完全独立 | 无 | — |
| LocalMainSessionTask 分解 | ⚠️ 未找到明确对应 | 需识别 | #7 |
| QueryDeps 依赖注入 | ⚠️ 仅 4 个依赖 | 需扩展 | #8 |
| SDK消息转换 | ✅ QueryEngine 内 | 无 | — |
| Budget追踪 | ⚠️ 基础实现 | 需增强 | #8 |

### 5.2 packages/provider（适配器层）— 差距评级 🔴

| 目标能力 | 当前状态 | 差距 | 对应优化 |
|---------|---------|------|---------|
| ProviderAdapter 接口 | ❌ if/else 分发 | **核心缺失** | #2 |
| AuthProvider 接口 | ❌ 散落在 auth.ts 1999行 | **核心缺失** | #3 |
| StreamAdapter 接口 | ❌ 各 Provider 独立实现 | **核心缺失** | #4 |
| ContextProvider 管线 | ❌ 硬编码函数链 | **核心缺失** | #5 |
| NetworkLayer | ✅ proxy/mTLS/CA/upstream 完整 | 无 | — |

### 5.3 packages/ink（UI 框架）— 差距评级 🟢

| 目标能力 | 当前状态 | 差距 | 对应优化 |
|---------|---------|------|---------|
| reconciler/hooks/components | ✅ @anthropic/ink workspace 包 | 无 | — |
| Keybinding 系统 | ✅ 完整 | 无 | — |
| Vim Emulation | ✅ src/vim/ 5文件 | 无 | — |
| Typeahead | ✅ useTypeahead.tsx 1579行 | 无 | — |
| InkConfig 12注入点 | ⚠️ 不确定完整度 | 需验证 | — |

### 5.4 packages/agent-tools（工具库）— 差距评级 🔴

| 目标能力 | 当前状态 | 差距 | 对应优化 |
|---------|---------|------|---------|
| Tool interface | ✅ Tool.ts 815行 | 无 | — |
| 54个工具实现 | ⚠️ ~35-40个（含条件编译） | 数量差异 | — |
| Sandbox 系统 | ✅ sandbox-adapter.ts 985行 | 无 | — |
| ModelDeps 注入点 | ❌ 不存在 | **核心缺失** | #8, #18 |
| CoreTool/UITool 分离 | ⚠️ 已开始，未完成 | **UI 耦合 40%** | #1 |
| 零 UI 依赖 | ❌ 40% 方法是 UI 渲染 | **核心问题** | #1 |

### 5.5 packages/shell — 差距评级 🟢

| 目标能力 | 当前状态 | 差距 | 对应优化 |
|---------|---------|------|---------|
| ShellProvider 接口 | ✅ 33行 | 无 | — |
| Bash/Zsh 实现 | ✅ bashProvider 255行 | 无 | — |
| PowerShell 实现 | ✅ powershellProvider 123行 | 无 | — |
| 子进程环境构建 | ✅ Shell.ts 474行 | 微量 analytics 耦合 | #9 |

### 5.6 packages/config — 差距评级 🟡

| 目标能力 | 当前状态 | 差距 | 对应优化 |
|---------|---------|------|---------|
| SettingsManager 7层合并 | ⚠️ 函数式，非接口 | 需接口化 | #10 |
| FeatureFlagProvider | ✅ GrowthBook 实现 | 无 | — |
| SettingsSync | ⚠️ 部分 | 需增强 | — |
| GlobalConfig 瘦身 | ❌ 578行类型 | 需拆分 | #20 |

### 5.7 packages/telemetry — 差距评级 🟡

| 目标能力 | 当前状态 | 差距 | 对应优化 |
|---------|---------|------|---------|
| AnalyticsEventEmitter | ⚠️ 函数式 logEvent | 需接口化 | #13 |
| GrowthBook 客户端 | ✅ 1256行完整 | 无 | — |
| Datadog 日志 | ✅ 321行 | 无 | — |
| SessionTracer | ⚠️ 未明确识别 | 需验证 | #13 |

### 5.8 packages/memory — 差距评级 🟡

| 目标能力 | 当前状态 | 差距 | 对应优化 |
|---------|---------|------|---------|
| MemoryStore 接口 | ❌ 文件系统直接操作 | **需抽象** | #12 |
| MemoryRecall | ⚠️ findRelevantMemories feature-gated | 需默认启用 | #12 |
| MemoryExtract | ✅ extractMemories.ts 615行 | 无 | — |
| MemoryConsolidation | ⚠️ 部分 | 需增强 | #12 |

### 5.9 packages/permission — 差距评级 🟡

| 目标能力 | 当前状态 | 差距 | 对应优化 |
|---------|---------|------|---------|
| PermissionMode 8种 | ⚠️ 7种（5 External + 2 Internal） | 1种差异 | — |
| PermissionPipeline | ⚠️ 函数式 hasPermissionsToUseTool | 需接口化 | #11 |
| RuleStore | ⚠️ 通过 ToolPermissionContext | 需独立 | #11 |
| AutoClassifier | ✅ yoloClassifier.ts 1495行 | 无 | — |
| 零 UI 依赖 | ❌ 通过 AppState 间接耦合 | **需解耦** | #11 |

### 5.10 packages/swarm — 差距评级 🟡

| 目标能力 | 当前状态 | 差距 | 对应优化 |
|---------|---------|------|---------|
| Backends (进程/Tmux/iTerm2) | ✅ 完整实现 | 无 | — |
| PermissionSync | ✅ 928行 | 无 | — |
| TeammateMailbox | ✅ 1187行文件邮箱 | 无 | — |
| Worktree 管理 | ✅ 完整 | 无 | — |
| 独立打包 | ❌ 在 utils/swarm/ 内 | 需提取 | — |

### 5.11 packages/server — 差距评级 🔴

| 目标能力 | 当前状态 | 差距 | 对应优化 |
|---------|---------|------|---------|
| DirectConnect | ✅ directConnectManager.ts | 无 | — |
| LockFile | ❌ stub（13行空实现） | **核心缺失** | #16 |
| SessionManager | ❌ stub | **核心缺失** | #16 |
| Server 主入口 | ❌ stub | **核心缺失** | #16 |

---

## 六、自我检验记录

| 检验项 | 结果 | 备注 |
|-------|------|------|
| 是否完整阅读了所有核心文档？ | ✅ | project-purpose.md, architecture-design.md, CLAUDE.md, 00-user-requirement.md |
| 4 个探索 agent 是否覆盖了目标架构的每一层？ | ✅ | 核心引擎、适配器/Provider、基础设施、扩展系统/UI 全覆盖 |
| 每个优化建议是否基于实际代码问题？ | ✅ | 每个建议都引用了具体文件、行数、API |
| 目标对齐分析是否有事实依据？ | ✅ | 基于对 2641 源文件的全面扫描结果 |
| 优化点优先级是否合理？ | ✅ | P0（架构基础）→ P1（模块独立）→ P2（扩展完善），依赖关系清晰 |
| 是否考虑了"包装不替代"原则？ | ✅ | 每个优化点都标注了原则符合性 |
| 是否有遗漏的重要问题？ | ⚠️ | Bridge 层（replBridge.ts 2455行, bridgeMain.ts 2993行）可能需要单独分析 |

---

## 七、后续行动建议

### 建议分期执行

**Phase A — 接口标准化（P0 并行批次 1）**：
- #7 SessionStorage 拆分
- #9 Shell 独立打包
- #10 Config 接口标准化
- #12 Memory 接口化
- #13 Telemetry 标准化

**Phase B — 适配器层（P0 并行批次 2）**：
- #2 Provider 接口统一
- #3 Auth 策略统一
- #5 Context 管线可插拔
- #1 Tool UI 解耦（可与 Phase A 并行）

**Phase C — 核心解耦（P0 依赖批次）**：
- #4 StreamAdapter 统一（依赖 #2）
- #8 QueryDeps 扩展
- #6 AppState 解耦（依赖 #1, #7）

**Phase D — 模块独立（P1）**：
- #11 Permission 解耦
- #14 Hook 解耦
- #15 REPL 拆分

**Phase E — 扩展完善（P2）**：
- #16-#21

每 Phase 完成后进行回归测试，确保现有 CLI 功能不受影响。
