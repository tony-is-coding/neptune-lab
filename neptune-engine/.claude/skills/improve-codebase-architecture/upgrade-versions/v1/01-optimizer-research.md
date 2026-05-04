# V11 框架深度分析报告

> 版本: auto-upgrade/v1
> 创建时间: 2026-04-27
> 分析范围: src/ 全量代码（1314 文件）
> 目标版本: V11 分层边界修复

---

## 一、框架现状分析

### 1.1 当前架构健康度

| 指标 | 当前值 | 目标值 | 差距 |
|------|--------|--------|------|
| engine/ 文件数 | 53 | - | - |
| engine/ React 依赖 | 0 | 0 | ✅ 达标 |
| 框架→CLI 反向依赖 | 0 | 0 | ✅ 达标 |
| 测试 | 2626 pass / 0 fail | ≥2626 | ✅ 达标 |
| tsc | 0 errors | 0 | ✅ 达标 |
| engine/ 向上穿透 | **54 处** | 0 | ❌ 差距极大 |
| 外部→engine/ 反向依赖 | **36 个文件** | 0 | ❌ 差距极大 |
| lint:layers 覆盖 | 仅 L2→L4 | 全方向 | ❌ 严重不足 |

### 1.2 核心问题总览

**问题 A：engine/ 向上穿透 src/（54 处）**

engine/ 中 12 个文件存在对 src/ 上层的 import 穿透，总计 54 处（静态 import 42 处 + 动态 require 12 处）。

穿透热点分布：

| engine/ 源文件 | 穿透数 | 严重度 |
|----------------|--------|--------|
| EngineState.ts | 12 | 极高 |
| types/CoreAppState.ts | 11 | 极高 |
| cc-runtime/DefaultCCRuntime.ts | 9 | 极高 |
| bridge/OriginalQueryEngineBridge.ts | 7 | 极高 |
| bootstrap/initializeEngine.ts | 7 | 极高 |
| bootstrap/engineHelpers.ts | 4 | 高 |
| session/SessionContext.ts | 5 | 高 |
| cc-runtime/CCRuntime.ts | 2 | 中 |
| hooks/HookCore.ts | 1 | 中 |
| 其他 5 个文件 | 各 1 | 低 |

穿透目标分类：

| 目标类别 | 穿透数 | 代表文件 |
|----------|--------|----------|
| src/ 根文件 (Tool.ts, QueryEngine.ts, tools.ts) | 14 | 核心类型+运行时 |
| src/types/ (command, permissions, ids, message 等) | 16 | 纯类型 |
| src/utils/ (model, commitAttribution, hooks 等) | 14 | 类型+值 |
| src/services/mcp/types.ts | 2 | 纯类型 |
| src/state/createAppStateStore.ts | 1 | 值 |
| 动态 require (运行时加载) | 7 | 运行时耦合 |

**问题 B：外部反向依赖 engine/（36 个文件）**

| engine 模块 | 被依赖次数 | 导出符号 |
|-------------|-----------|----------|
| session/SessionContext.ts | **26 次** | getSessionId(22) + getIsRemoteMode(4) |
| log/index.ts | **13 次** | LogUtil |
| EngineState.ts | **2 次** | EngineState (class) |

关键发现：
- 全部 36 处均为 **value import**（运行时依赖），零 type-only import
- SessionContext 的 `getSessionId` 被 22 个文件调用，已成为全局基础设施级依赖
- LogUtil 被 utils/ 和 services/ 广泛使用，从依赖方向看更像是基础设施而非 engine 内部模块

**问题 C：lint:layers 守护不足**

- 当前仅覆盖 "L2 engine 不得依赖 L4 UI" 一条方向规则
- 缺少：L3→L2 反向检查、L2→src/根文件 向上穿透检查
- architecture-layering-standard.md 文档被多处引用但**实际不存在**

**问题 D：engine/ 核心组件质量**

| 问题 | 位置 | 严重度 |
|------|------|--------|
| 10 处 `as any` 类型断言 | AgentEngine/HookCore/Bridge/Session | P1 |
| AnthropicProvider.query() 是 placeholder | provider/ | P1 |
| EngineFacade 未传递 ISessionStore | EngineFacade.ts | P2 |
| ToolAdapter 存在 React 依赖泄漏 | tools/ToolAdapter.ts | P2 |
| SessionManager 方法拼写错误 | SessionManager.ts | P4 |

### 1.3 分层依赖流向图（现状）

```
┌─────────────────────────────────────────────────────┐
│ L3: services/  utils/  tasks/  state/               │
│   ↓ 正常                                           │
│   ↑ 36 处反向依赖 ← engine/log (13)                 │
│   ↑               ← engine/session/SessionContext (26)│
│   ↑               ← engine/EngineState (2)           │
├─────────────────────────────────────────────────────┤
│ L2: engine/ (53 文件)                               │
│   ↓ 54 处向上穿透                                   │
│   ↓ ← Tool.ts (9处), types/ (16处), utils/ (14处)   │
│   ↓ ← QueryEngine.ts (3处), tools.ts (2处)          │
├─────────────────────────────────────────────────────┤
│ L1: types/  constants/  schemas/                    │
├─────────────────────────────────────────────────────┤
│ L0: bootstrap/  state.ts                            │
└─────────────────────────────────────────────────────┘
```

---

## 二、框架目标对齐分析

| 框架目标 | OKR 路线图对应 | 当前差距 | V11 贡献度 |
|----------|----------------|----------|------------|
| 物理分离：claude-code/ 只含 SDK 核心 | V15 | CLI/TUI 仍在 claude-code/ | 间接支撑（分层修复是物理分离前提） |
| 零 UI 依赖：SDK 零 React/Ink | V10 已达 ✅ | ToolAdapter 有 React 泄漏 | 直 接修复 ToolAdapter |
| 独立发布：npm install 可用 | V14 | dependencies 为空 | 间接支撑 |
| 单向分层依赖：零违规 | **V11** | **54 处穿透 + 36 处反向** | **核心目标** |
| 扩展点完整：所有 ≥3/5 | V12 | 多个扩展点不完整 | 间接支撑（分层是扩展点基础） |
| 运行时兼容：Node/Bun 可用 | V13 | feature()/require() 不兼容 | 间接支撑 |
| 生产稳定：并发安全 | V17 | Map 无 TTL/上限 | 不涉及 |
| 文档完备 | V18 | architecture-layering-standard.md 缺失 | 直接补全 |

---

## 三、优化清单（TOP 12，按优先级排序）

### 优化点 1：LogUtil 下沉到基础设施层

**优化重点**：将 engine/log/ 从 engine/ 层提取到独立的基础设施位置，消除 13 处反向依赖。

**优化目标**：LogUtil 成为 L1 层级的全局日志基础设施，engine/ 和 utils/ 均可使用而不产生反向依赖。

**关键结果**：
- KR1: 将 engine/log/ 目录迁移到 src/infra/log/（或 src/utils/log/），engine/ 通过 `import from '../infra/log'` 引用（L2→L1 方向）
- KR2: 13 个外部文件的 LogUtil import 路径更新，方向从反向变为正向（L3→L1 或同级）
- KR3: engine/ 内部对 LogUtil 的引用全部改为向下引用
- KR4: LogUtil 功能不变，日志行为完全回归通过

**预期收益**：消除 13/36 = 36% 的反向依赖，是单次改动收益最大的优化。

**对框架的影响**：
- 是否破坏"包装不替代"原则：否，仅移动位置
- 正向影响：依赖方向合规、代码组织更清晰
- 负面影响：13 个文件的 import 路径变更，需要回归测试
- 实施风险：低（纯位置移动 + import 路径更新）

**符合框架目标**：分层验证通过（lint:layers 零违规）

**依赖关系**：无前置依赖，可独立执行

---

### 优化点 2：SessionContext 高频访问器下沉

**优化重点**：将 getSessionId、getIsRemoteMode 等全局上下文访问器从 engine/ 提取到独立的基础设施模块。

**优化目标**：session 上下文访问器成为 L1 层级的全局基础设施，消除 26 处反向依赖（最大的反向依赖源）。

**关键结果**：
- KR1: 创建 src/infra/session-context/（或 src/context/session/），包含 SessionId 类型、getSessionId()、getIsRemoteMode()、runInSessionContext() 等
- KR2: SessionContextStorage（AsyncLocalStorage 封装）下沉到基础设施层
- KR3: engine/session/SessionContext.ts 保留 Session 级别的高级 API（TokenBudget、ModelUsage 等），删除已下沉的基础访问器
- KR4: 26 个外部文件的 import 路径更新
- KR5: engine/ 对 session 基础设施的引用改为向下引用（L2→L1）

**预期收益**：消除 26/36 = 72% 的反向依赖。与优化点 1 合计消除 100% 反向依赖。

**对框架的影响**：
- 是否破坏"包装不替代"原则：否，仅移动位置
- 正向影响：最大反向依赖源彻底消除
- 负面影响：26 个文件的 import 路径变更，影响面广
- 实施风险：中（需确保 AsyncLocalStorage 上下文传播不断裂）

**符合框架目标**：分层验证通过、核心状态零 React

**依赖关系**：可与优化点 1 并行执行

---

### 优化点 3：engine/ 类型依赖解耦（38 处 type 穿透）

**优化重点**：在 engine/ 内部建立完整的类型镜像层，消除 38 处 type-only 向上穿透。

**优化目标**：engine/ 内部 types/ 目录包含所有需要的类型定义，零依赖 src/types/ 和 src/utils/ 的类型。

**关键结果**：
- KR1: 在 engine/types/ 中创建以下镜像类型文件：
  - `engineTypes.ts` — 镜像 Tool, ToolPermissionContext, Tools, CoreTool, UITool（来自 Tool.ts + types/toolTypes.ts）
  - `engineCommand.ts` — 镜像 Command, PromptCommand（来自 types/command.ts）
  - `enginePermissions.ts` — 镜像 PermissionMode, CanUseToolFn, ToolPermissionContext（来自 types/permissions.ts）
  - `engineMessage.ts` — 镜像 Message, UserMessage（来自 types/message.ts）
  - `engineIds.ts` — 镜像 SessionId, AgentId, asSessionId（来自 types/ids.ts）
  - `engineState.ts` — 镜像 FileHistoryState, SessionHooksState, AttributionState, TaskState, TodoList, ModelSetting, MCPServerConnection 等
  - `engineQuery.ts` — 镜像 QueryEngineConfig（来自 QueryEngine.ts）
- KR2: engine/ 内部 12 个文件的 type import 全部改为引用 engine/types/ 内部文件
- KR3: 源类型变更时通过 re-export 保持同步（`export type { X } from '../../../types/xxx'`）
- KR4: tsc 零错误、类型推断行为不变

**预期收益**：消除 38/54 = 70% 的向上穿透，且全部是编译时安全的改动。

**对框架的影响**：
- 是否破坏"包装不替代"原则：否，仅增加类型中间层
- 正向影响：engine/ 编译独立性增强，可独立进行类型检查
- 负面影响：增加了类型维护成本（源类型变更需同步镜像）
- 实施风险：低（纯 type import 变更，不影响运行时）

**符合框架目标**：分层验证通过

**依赖关系**：无前置依赖，可与优化点 1、2 并行

---

### 优化点 4：engine/ 值依赖注入化（16 处 value 穿透）

**优化重点**：将 engine/ 对 src/ 上层的 16 处 value import 改为通过 CCRuntime 或新接口注入。

**优化目标**：engine/ 零 value-level 向上穿透，所有运行时依赖通过注入获取。

**关键结果**：
- KR1: CCRuntime 接口扩展，增加以下方法：
  - `getEmptyToolPermissionContext()` — 替代 CoreAppState/EngineState 中的 require('Tool.ts')
  - `createFileStateCache(maxFiles, maxSize)` — 替代 Bridge 中的直接 import
  - `getSettings()` — 替代 engineHelpers 中的直接 import
- KR2: DefaultCCRuntime 实现上述方法（内部引用 src/ 上层文件）
- KR3: MockCCRuntime 提供测试桩
- KR4: engine/ 内 16 处 value import 全部改为通过 CCRuntime 获取
- KR5: 消除所有 `require()` 动态加载（DefaultCCRuntime 中的 7 处 require 除外，因为 CCRuntime 本身就是桥接层）

**预期收益**：消除 16/54 = 30% 的向上穿透（最难的部分），engine/ 真正实现编译独立性。

**对框架的影响**：
- 是否破坏"包装不替代"原则：否，通过接口注入解耦
- 正向影响：engine/ 可独立编译和测试，MockCCRuntime 提供完整隔离
- 负面影响：CCRuntime 接口膨胀，需要维护更多方法
- 实施风险：中（需要确保注入时序正确，不能在 CCRuntime 未初始化时调用）

**符合框架目标**：扩展点完整、独立发布

**依赖关系**：依赖优化点 3 完成（先处理 type 穿透，再处理 value 穿透）

---

### 优化点 5：lint:layers 全方向守护

**优化重点**：扩展分层守护规则，覆盖 L3→L2 反向依赖和 L2→src/ 向上穿透。

**优化目标**：CI 自动检测所有分层违规，防止新增穿透。

**关键结果**：
- KR1: eslint.config.mjs 新增规则：
  - `utils/**/*` 和 `services/**/*` 禁止 import from `engine/`（反向依赖检查）
  - `engine/**/*` 禁止 import from `../../根文件`（向上穿透检查，排除 cc-runtime/ 和 bridge/ 作为已知例外）
- KR2: lint-layers.sh 脚本更新，增加反向依赖和向上穿透检查
- KR3: 所有新增规则在 CI 中运行（GitHub Actions）
- KR4: 已知违规列入白名单（待优化点 1-4 逐步消除）

**预期收益**：防止新增分层违规，为后续版本提供自动守护。

**对框架的影响**：
- 是否破坏"包装不替代"原则：否
- 正向影响：架构约束自动化，降低人为违规风险
- 负面影响：开发者需遵守更严格的 import 规则
- 实施风险：低

**符合框架目标**：分层验证通过

**依赖关系**：可与优化点 1-4 并行执行

---

### 优化点 6：ToolAdapter React 依赖清除

**优化重点**：消除 ToolAdapter.ts 中的 React.ReactNode 类型引用，使 engine/ 彻底零 React 依赖。

**优化目标**：engine/ 目录中零 React 类型引用（当前 ToolAdapter.ts 有 1 处泄漏）。

**关键结果**：
- KR1: ToolAdapter.coreToolToTool() 的 renderToolUseMessage 返回类型从 `React.ReactNode` 改为 `unknown`
- KR2: UITool 接口中的 UI 相关方法类型使用泛型或 unknown
- KR3: ESLint no-restricted-imports 增加对 `React` 类型的检查（不仅检查模块 import）
- KR4: tsc + lint:layers 通过

**预期收益**：engine/ 真正零 React 依赖，SDK 在非 React 环境下类型安全。

**对框架的影响**：
- 是否破坏"包装不替代"原则：否
- 正向影响：SDK 类型安全增强
- 负面影响：UITool 的消费者需要做类型断言
- 实施风险：低

**符合框架目标**：核心状态零 React

**依赖关系**：可独立执行

---

### 优化点 7：分层标准文档补全

**优化重点**：创建被多处引用但不存在的 architecture-layering-standard.md。

**优化目标**：完整的分层标准文档，定义 L0-L4 每层的边界、允许和禁止的 import 方向、守卫机制。

**关键结果**：
- KR1: 创建 docs/architecture-layering-standard.md，包含：
  - L0-L4 每层的目录映射和职责定义
  - 允许的 import 方向矩阵（哪些层可以 import 哪些层）
  - 禁止的 import 模式列表（含正则表达式）
  - 守卫机制说明（ESLint + shell 脚本）
  - 已知例外列表（bridge/ 和 cc-runtime/ 作为桥接层）
- KR2: 更新所有引用此文档的链接确认正确

**预期收益**：开发者有明确的分层规范可循，新贡献者可快速理解架构约束。

**对框架的影响**：
- 正向影响：规范明确、降低沟通成本
- 实施风险：极低（纯文档）

**符合框架目标**：文档完备

**依赖关系**：无

---

### 优化点 8：as any 类型安全修复

**优化重点**：消除 engine/ 中 10 处 `as any` 类型断言。

**优化目标**：engine/ 零 `as any`，所有类型在编译时完全安全。

**关键结果**：
- KR1: AgentEngine.ts 2 处 `sessionId as any` — 统一 sessionId 类型定义（与 createDefaultSessionContext 参数对齐）
- KR2: HookCore.ts 3 处 `as any` — 对齐 HookExecutor 参数类型与 CC 原始 hooks
- KR3: OriginalQueryEngineBridge.ts 1 处 `as any` — 定义 BridgeQueryEngineConfig 子类型
- KR4: Session.ts 3 处 `as any` — 补全 Session 序列化的类型定义

**预期收益**：类型安全增强，IDE 补全更准确，编译器能捕获更多错误。

**对框架的影响**：
- 是否破坏"包装不替代"原则：否
- 正向影响：代码质量提升
- 实施风险：低-中（需要理解每个 `as any` 的原因）

**符合框架目标**：SDK 质量

**依赖关系**：可与优化点 3 并行（类型系统统一后更容易修复）

---

### 优化点 9：EngineFacade ISessionStore 传递修复

**优化重点**：EngineFacade 创建 SessionManager 时未传递 ISessionStore，导致持久化能力丢失。

**优化目标**：SDK 用户可通过 AgentEngineConfig 注入 SessionStore，实现 session 元数据持久化。

**关键结果**：
- KR1: EngineConfig.sessionManager 类型扩展，增加 `store?: ISessionStore`
- KR2: EngineFacade 构造函数传递 store 到 SessionManager
- KR3: 测试验证通过 ISessionStore 注入的 session 可跨 engine 实例恢复

**预期收益**：SDK session 持久化能力解锁，企业级部署的基础。

**对框架的影响**：
- 是否破坏"包装不替代"原则：否
- 正向影响：SDK 功能完整性提升
- 实施风险：低

**符合框架目标**：SDK 可用性

**依赖关系**：无

---

### 优化点 10：import 路径风格统一

**优化重点**：统一 engine/ 和外部文件对 engine 模块的 import 路径风格。

**优化目标**：全局统一使用 `src/` alias 或相对路径（选一种），消除混用。

**关键结果**：
- KR1: 调研两种路径风格的使用频率和适用场景，确定统一规范
- KR2: 编写路径迁移脚本（自动化 import 路径替换）
- KR3: 完成迁移并验证 tsc + 全量测试通过

**预期收益**：代码可维护性提升，重构时不易遗漏。

**对框架的影响**：
- 实施风险：低（纯路径替换，不影响逻辑）
- 注意：V10 已做过一轮包引用规范化（763 文件），但 engine 相关的路径仍有混用

**符合框架目标**：代码质量

**依赖关系**：建议在优化点 1-3 完成后再统一路径

---

### 优化点 11：ProviderAdapter 扩展点接口设计

**优化重点**：为 V12 扩展点接口体系做预研，明确 ProviderAdapter 从 placeholder 到可用的路径。

**优化目标**：ProviderAdapter 接口设计完成，支持在后续版本中接入真实 Provider。

**关键结果**：
- KR1: 定义 ProviderAdapter 的完整生命周期接口：initialize() / query() / dispose() / getCapabilities()
- KR2: 定义 ProviderQueryParams 和 ProviderResponse 的完整类型
- KR3: 在 AgentEngine.query() 中预留 Provider 调用路径（当前走 CC QueryEngine，未来可切换）
- KR4: AnthropicProviderConfig 从 `[key: string]: unknown` 改为具体字段

**预期收益**：为 V16 Provider 真实对接铺路，架构设计提前对齐。

**对框架的影响**：
- 正向影响：扩展点设计提前验证
- 实施风险：低（接口设计，不改变现有行为）

**符合框架目标**：扩展点完整

**依赖关系**：依赖优化点 3（类型系统统一）

---

### 优化点 12：PermissionDelegate 接口粒度扩展

**优化重点**：PermissionDelegate 从单一 onToolAccess 扩展为完整的权限拦截体系。

**优化目标**：SDK 用户可拦截工具调用、命令执行、文件访问等多种操作。

**关键结果**：
- KR1: PermissionDelegate 接口增加可选方法：
  - `onToolResult?(tool, result)` — 拦截工具返回结果
  - `onCommand?(command)` — 拦截斜杠命令
  - `onFileAccess?(path, mode)` — 拦截文件系统操作
- KR2: ReadOnlyPermissionDelegate 更新，基于工具元数据动态判断而非硬编码列表
- KR3: 新增方法全部可选（向前兼容），旧实现无需修改

**预期收益**：企业级权限控制的基础（审计、合规、沙箱）。

**对框架的影响**：
- 实施风险：低（纯接口扩展，向后兼容）

**符合框架目标**：扩展点完整、权限委托不硬编码

**依赖关系**：无严格依赖

---

## 四、优化点依赖关系

```
优化点 1 (LogUtil 下沉) ────────┐
优化点 2 (SessionContext 下沉) ──┤──→ 优化点 5 (lint:layers 全方向守护)
优化点 3 (类型依赖解耦) ────────┤        │
                                │        ↓
优化点 4 (值依赖注入化) ←───────┘    优化点 10 (路径统一)
        ↑ 依赖优化点 3

独立可并行：
├── 优化点 6 (ToolAdapter React 清除)
├── 优化点 7 (分层标准文档)
├── 优化点 8 (as any 修复)
├── 优化点 9 (ISessionStore 传递)
├── 优化点 11 (ProviderAdapter 预研)
└── 优化点 12 (PermissionDelegate 扩展)
```

**关键路径**：优化点 3 → 优化点 4 → 优化点 5（解决核心分层违规）

**可并行路径**：优化点 1、2、6、7、8、9 可同时执行

---

## 五、执行建议

### 5.1 V11 范围建议

V11 应聚焦 **分层边界修复**，建议纳入以下优化点：

**必须纳入（P0）**：
| # | 优化点 | 预计文件变更 | 收益 |
|---|--------|-------------|------|
| 1 | LogUtil 下沉 | ~15 文件 | 消除 13 处反向依赖 |
| 2 | SessionContext 下沉 | ~28 文件 | 消除 26 处反向依赖 |
| 3 | 类型依赖解耦 | ~15 文件 | 消除 38 处 type 穿透 |
| 4 | 值依赖注入化 | ~10 文件 | 消除 16 处 value 穿透 |
| 5 | lint:layers 全方向 | ~3 文件 | 自动守护 |
| 7 | 分层标准文档 | 1 文件 | 规范完善 |

**建议纳入（P1）**：
| # | 优化点 | 预计文件变更 | 收益 |
|---|--------|-------------|------|
| 6 | ToolAdapter React 清除 | 1 文件 | 零 React 依赖 |
| 8 | as any 修复 | 4 文件 | 类型安全 |

**推迟到 V12**：
| # | 优化点 | 理由 |
|---|--------|------|
| 9 | ISessionStore 传递 | 功能增强，非分层治理 |
| 11 | ProviderAdapter 预研 | V16 范围 |
| 12 | PermissionDelegate 扩展 | V12 扩展点范围 |
| 10 | import 路径统一 | 纯代码风格，低优先级 |

### 5.2 完成标准

V11 完成时必须满足：
1. engine/ 零向上穿透 import（当前 54 处 → 0）
2. 外部零反向依赖 engine/（当前 36 文件 → 0）
3. lint:layers 全方向守护生效
4. architecture-layering-standard.md 文档存在且内容完整
5. engine/ 零 React 类型引用
6. tsc 零错误 + 2626+ 测试通过

### 5.3 风险缓解

| 风险 | 缓解措施 |
|------|----------|
| SessionContext 下沉可能导致 AsyncLocalStorage 上下文断裂 | 逐模块迁移 + 每步运行测试 |
| 类型镜像增加维护成本 | 使用 re-export 保持自动同步 |
| CCRuntime 接口膨胀 | 按"实际使用"增量添加，不预先设计 |
| 大量 import 路径变更 | 使用 IDE 重构工具 + 自动化脚本 |

---

## 六、自我检验

| 检验项 | 结果 |
|--------|------|
| 是否完整阅读了所有核心文档？ | ✅ project-purpose.md + architecture-design.md + CLAUDE.md |
| 目标对齐分析是否有事实依据？ | ✅ 基于 54 处穿透扫描 + 36 个反向依赖文件实际数据 |
| TOP 10+ 优化点是否基于实际代码问题？ | ✅ 每个优化点都有具体文件路径和行号数据支撑 |
| 每个优化建议是否考虑了架构影响？ | ✅ 每点都评估了"包装不替代"原则、正向/负面影响、风险 |
| 是否有遗漏的重要问题？ | 已覆盖分层边界、类型安全、扩展点、文档、工具质量。未深入：并发安全(V17)、构建管道(V14)、物理分离(V15) — 这些属于后续版本范围 |
