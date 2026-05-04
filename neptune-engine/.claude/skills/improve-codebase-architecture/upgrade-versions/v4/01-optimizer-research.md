# V4 框架深度分析报告 — 架构分层进阶

> 生成时间：2026-04-26
> 聚焦范围：O3/O9/O10/O13 四个中等风险优化点
> 基于 V3 成果：核心类型层已解耦（Tool.ts/QueryEngine.ts/engine/ 不再依赖 hooks/components）

---

## 一、框架现状总结

### 1.1 V3 成果回顾

V3 完成了核心类型层的解耦，主要成果：
- `CanUseToolFn` 类型从 `hooks/useCanUseTool.tsx` 提取到 `types/permissions.ts`
- `SpinnerMode` 类型从 `components/Spinner/types.ts` 提取到 `types/spinner.ts`
- Tool.ts / QueryEngine.ts / engine/ 层不再直接 import hooks/ 或 components/ 路径（类型层面）
- 建立了 L1-L4 四层架构标准文档

### 1.2 当前残余问题

V3 解决了类型层面的解耦，但以下结构性问题仍然存在：
1. **QueryEngine.ts 仍通过 `require()` 懒加载 UI 组件** — 运行时耦合未消除
2. **无自动化工具防止层间违规** — 仅有文档规范，无 lint/barrier 守护
3. **engine/ 无统一公共入口** — 80 处外部引用散落各处，直接引用内部文件
4. **核心层仍有直接 console 输出** — 非 CLI 场景下干扰宿主输出

---

## 二、四个优化点的深度分析

### 优化 O3：QueryEngine.ts 移除 UI 组件懒加载

#### 现状分析

QueryEngine.ts 第 89-91 行存在唯一的 UI 组件懒加载：

```typescript
// Lazy: MessageSelector.tsx pulls React/ink; only needed for message filtering at query time
const messageSelector = (): typeof import('src/components/MessageSelector.js') =>
  require('src/components/MessageSelector.js')
```

**实际使用场景**（仅 2 处调用）：
- 第 474 行：`messageSelector().selectableUserMessagesFilter(msg)` — 过滤可回放的用户消息
- 第 647 行：`messageSelector().selectableUserMessagesFilter` — 过滤消息后做 file history snapshot

**关键发现**：`selectableUserMessagesFilter` 是一个**纯函数**，零 React/Ink 依赖。它的依赖仅为：
- `isSyntheticMessage` (来自 `src/utils/messages.js`)
- `isToolUseResultMessage` (来自 `src/utils/messages.js`)
- XML 标签常量 (来自 `src/constants/xml.js`)

#### 优化目标（Objective）

QueryEngine.ts 零 UI 组件依赖，所有消息过滤逻辑通过纯函数调用

#### 关键结果（Key Results）

- KR1: QueryEngine.ts 不再 `require` 任何 `components/` 路径
- KR2: `selectableUserMessagesFilter` 提取为独立纯函数模块 `src/utils/messageSelection.ts`
- KR3: `handlePromptSubmit.ts` 同步修改为从新模块导入（当前第 5 行仍直接 import components）

#### 预期收益

- QueryEngine 可在 headless/SDK 场景安全使用消息过滤
- 消除 `require()` 懒加载 hack，改为正常 ES import
- 减少模块加载开销（无需加载 React 运行时来获得一个纯过滤函数）

#### 对框架的影响

- 符合"包装不替代"原则 ✅ — 不改过滤逻辑，仅提取位置
- 正向：消除 L2 对 L4 的运行时依赖
- 负向：无
- 风险：**极低** — 纯函数提取，不改行为

#### 符合框架目标

嵌入业务应用、服务端任务系统（headless 场景需要消息过滤能力）

#### 依赖关系

无前置依赖，可立即开始

---

### 优化 O9：引入层间 import 规则（lint/barrier）

#### 现状分析

**工具链现状**：
- 项目全面采用 Biome（v2.4.10）作为 lint/format 工具
- 配置文件：`claude-code/biome.json`
- npm scripts：`lint` / `lint:fix` / `format`
- **Biome 不支持 `no-restricted-imports` 规则** — 这是 ESLint 独有的能力

**违规统计**：

| 区域 | 违规文件数 | 违规 import 数 | 严重程度 |
|------|-----------|--------------|---------|
| L2 → L4（P0 阻断性） | 3 个核心文件 | 4 处 | 🔴 高 |
| L2 → React | 3 个文件 | 3 处 | 🔴 高 |
| L3 → L4 | 40 个文件 | 65 处 | 🟡 中 |
| L3 → React（.ts 文件） | 21 个文件 | 23 处 | 🟡 中 |
| engine/（L2 新增） | **0** | **0** | 🟢 无 |

**唯一亮点**：`src/engine/` 目录完全零违规，可作为 lint barrier 的第一个"绿区"。

**L2 核心文件 P0 违规明细**：
1. `QueryEngine.ts:90-91` — `require('src/components/MessageSelector.js')`（本次 O3 解决）
2. `Tool.ts:8` — `from 'react'`（Tool 接口依赖 React 类型，需后续 CoreTool/UITool 拆分）
3. `AppState.tsx:8` — `from 'react'`（核心状态被 React 绑定）
4. `query.ts:92` — 依赖 hooks 系统（间接依赖 AppState）

#### 优化目标（Objective）

建立自动化的层间 import 守护机制，防止新的违规引入

#### 关键结果（Key Results）

- KR1: 引入 ESLint（仅用于 `no-restricted-imports`），与现有 Biome 并行运行
- KR2: `src/engine/` 目录立即启用严格层间检查（零违规，可直接守护）
- KR3: 配置 npm script `lint:layers`，CI 可集成
- KR4: O3 完成后，`src/QueryEngine.ts` 纳入 lint 范围

#### 预期收益

- 防止未来引入层间违规 import
- CI 自动化守护架构约束
- IDE 实时提示违规 import

#### 对框架的影响

- 符合"包装不替代"原则 ✅ — 仅增加 lint 规则，不改代码
- 正向：架构守护自动化
- 负向：引入 ESLint 作为额外工具（仅 `no-restricted-imports` 一条规则）
- 风险：**极低** — engine/ 已零违规，不影响现有代码

#### 推荐方案

**Biome（主力）+ ESLint（层间 guard）双轨并行**：

| 维度 | Biome | ESLint |
|------|-------|--------|
| 格式化 | ✅ 已在用 | 不需要 |
| 通用 lint | ✅ 已在用 | 不需要 |
| `no-restricted-imports` | ❌ 不支持 | ✅ 原生支持 |
| CI 集成 | 已集成 | 需新增 `lint:layers` |

**ESLint 配置方案**（`eslint.config.mjs`，flat config 格式）：
- 对 `src/engine/**/*.ts` 启用最严格规则：禁止 import react / components / hooks / screens / keybindings
- 对 `src/QueryEngine.ts` / `src/query.ts` / `src/Tool.ts` 启用 L2 规则
- 渐进式扩大范围：每修复一个 P0 违规，就扩大 lint barrier 覆盖

#### 符合框架目标

架构守护机制，确保分层设计不被破坏

#### 依赖关系

无前置依赖，可与 O3 并行

---

### 优化 O10：engine/ 公共 API 导出规范化

#### 现状分析

**目录结构**：engine/ 共 39 个文件，7 个子模块：

| 子模块 | 文件数 | 职责 | 已有 index.ts |
|--------|--------|------|-------------|
| 顶层 | 6 | AgentEngine / EngineFacade / SessionManager / Session / types / errors | ❌ 无 |
| session/ | 6+index | Session 上下文 / AsyncLocalStorage / TokenBudget / 存储路径 / TranscriptParser | ✅ 有 |
| log/ | 10+index | LogUtil 单例 / 接口 / 格式化 / 输出 / 存储 | ✅ 有 |
| cc-runtime/ | 4+index | CCRuntime 接口 / DefaultCCRuntime / MockCCRuntime | ✅ 有 |
| bridge/ | 1 | OriginalQueryEngineBridge | ❌ 内部 |
| events/ | 1 | EventBus | ❌ 内部 |
| skill/ | 1 | SkillLoader | ❌ 内部 |
| storage/ | 3 | ISessionStore / InMemory / SQLite | ❌ 内部 |
| tools/ | 1 | ToolAdapter | ❌ 内部 |

**外部引用统计**（80 处）：

| 引用目标 | 次数 | 引用路径 |
|----------|------|----------|
| `engine/session/SessionContext.js` | 49 处 | `../../engine/session/SessionContext.js` 或 `src/engine/session/SessionContext.js` |
| `engine/log` (LogUtil) | 31 处 | `src/engine/log` |

**外部最常用的 2 个符号**：
1. `getSessionId()` — ~35 处引用
2. `getIsRemoteMode()` — ~20 处引用
3. `LogUtil` — ~31 处引用

**问题**：80 处外部引用全部绕过子模块 index.ts，直接引用源文件。路径深度不一致（2-4 层 `../`），维护困难。

#### 优化目标（Objective）

engine/ 有统一的公共 API 入口，外部代码通过 `from 'src/engine'` 统一引用

#### 关键结果（Key Results）

- KR1: 创建 `engine/index.ts` 统一入口，re-export 所有公共 API
- KR2: 分三层组织导出：核心 API / AgentEngine API / 扩展 API
- KR3: 新代码统一使用 `from 'src/engine'` 或 `from '../engine'`
- KR4: 现有 80 处引用标记为可渐进迁移（不强制一次性替换）

#### 导出分层方案

**第一层：核心公共 API（高频使用，49+31=80 处引用）**

```typescript
// Session 上下文访问器
export { getSessionId, getIsRemoteMode, getProjectRoot, ... } from './session/index.js'

// 日志系统
export { LogUtil } from './log/index.js'
export type { LogLevel, EngineLogger, ... } from './log/index.js'
```

**第二层：AgentEngine 核心 API（SDK 用户）**

```typescript
export { AgentEngine } from './AgentEngine.js'
export type { SessionStatus, SessionConfig, ... } from './types.js'
export { EngineError, EngineErrorCode } from './errors.js'
```

**第三层：扩展 API（高级用户/插件开发者）**

```typescript
export type { ISessionStore } from './storage/ISessionStore.js'
export { InMemorySessionStore } from './storage/InMemorySessionStore.js'
export { EventBus } from './events/EventBus.js'
export type { CCRuntime } from './cc-runtime/index.js'
```

**不应导出的内部实现**：EngineFacade / SessionManager / Session / Bridge / SessionContextStorage / TokenBudgetManager / TranscriptParser

#### 预期收益

- 降低接入成本：外部代码一行 `from 'src/engine'` 获取所有公共能力
- SDK 化准备：engine/ 具备独立 package 的导出结构
- 维护简便：内部重构不影响外部引用路径

#### 对框架的影响

- 符合"包装不替代"原则 ✅ — 仅增加导出入口，不改实现
- 正向：SDK 化、降低接入成本
- 负向：无
- 风险：**极低** — 纯新增文件，不影响现有代码

#### 符合框架目标

SDK 化、降低接入成本

#### 依赖关系

无前置依赖，可与 O3/O9 并行

---

### 优化 O13：console 输出通道统一

#### 现状分析

**核心层 console 调用统计**：

| 区域 | console 调用数 | 状态 |
|------|--------------|------|
| `engine/` 目录 | 3 处 | 1 处基础设施层（不替换）+ 2 处需替换 |
| `QueryEngine.ts` | 0 处 | ✅ 已干净 |
| `Tool.ts` | 0 处 | ✅ 已干净 |
| `types/` | 0 处 | ✅ 已干净 |

**需替换的 2 处调用**（`engine/events/EventBus.ts`）：

| 行号 | 调用 | 用途 |
|------|------|------|
| 57 | `console.warn(\`[EventBus] Hook for "${type}" threw error:\`, e)` | Hook 执行异常警告 |
| 74 | `console.warn(\`[EventBus] Listener for "${type}" threw error:\`, e)` | 监听器执行异常警告 |

**不应替换的调用**（`engine/log/ConsoleLogProvider.ts`）：
- 第 13 行 `console[level](formattedMessage)` — 日志框架输出终端
- 第 18 行 `console.log(message)` — UI 原样输出通道
- 这些是 LogUtil 体系的底层输出，替换会造成循环依赖

**LogUtil 实现状态**：✅ 完整实现（11 个文件）

| 能力 | 状态 |
|------|------|
| 单例模式 + 静态快捷方法 | ✅ |
| 子 logger（child） | ✅ |
| 级别过滤（debug/info/warn/error） | ✅ |
| 格式化策略可替换 | ✅ |
| 输出通道可替换 | ✅ |
| 文件持久化 | ✅ |
| 优雅关闭 | ✅ |

**已有替换记录**：`DefaultCCRuntime.ts` 中 3 处 `console.warn` 已替换为 `LogUtil.warn()`，`OriginalQueryEngineBridge.ts` 已导入 LogUtil。

**全项目统计**（console-replace-manifest.md）：131 处 console 调用，其中 52 处是 UI 输出（保留）。

#### 优化目标（Objective）

engine 核心层完全通过 LogUtil 进行日志输出，不再有直接的 console 依赖（除基础设施层）

#### 关键结果（Key Results）

- KR1: `EventBus.ts` 的 2 处 `console.warn` 替换为 `LogUtil.warn()`
- KR2: 更新 `console-replace-manifest.md` 清单，标记已完成项和遗漏项
- KR3: engine/ 核心层 console 调用减少（仅剩 ConsoleLogProvider 基础设施层）

#### 预期收益

- engine 核心层输出完全通过 LogUtil 管理
- 非 CLI 场景下，宿主应用可自定义日志输出通道
- 日志级别可配置，避免干扰宿主输出

#### 对框架的影响

- 符合"包装不替代"原则 ✅ — LogUtil 底层仍使用 console，只是统一了入口
- 正向：框架轻量、嵌入业务应用
- 负向：无
- 风险：**极低** — 仅 2 处调用替换

#### 符合框架目标

框架轻量、嵌入业务应用

#### 依赖关系

无前置依赖，可与 O3/O9/O10 并行

---

## 三、框架目标对齐分析

| 优化点 | 嵌入业务应用 | 多 Session 并发 | 服务端复用 | SDK 化 | 架构守护 |
|--------|:----------:|:------------:|:--------:|:-----:|:------:|
| O3 QueryEngine UI 解耦 | ✅ | — | ✅ | ✅ | — |
| O9 层间 import 规则 | — | — | — | — | ✅ |
| O10 engine 公共 API | — | — | — | ✅ | — |
| O13 console 通道统一 | ✅ | — | ✅ | — | — |

---

## 四、优化点依赖关系

```
O3: QueryEngine UI 解耦 ────── 无前置，可立即开始
O9: 层间 import 规则 ───────── 无前置，可立即开始
O10: engine 公共 API ───────── 无前置，可立即开始
O13: console 通道统一 ──────── 无前置，可立即开始

     ↓ 全部可并行 ↓

O3 完成后 → O9 可扩展 lint 范围至 QueryEngine.ts
```

**关键路径**：无。四个优化点完全独立，可全部并行执行。

---

## 五、实施风险评估

| 优化点 | 风险等级 | 主要风险 | 缓解措施 |
|--------|:-------:|---------|---------|
| O3 | 🟢 极低 | 纯函数提取，不改行为 | 现有测试回归验证 |
| O9 | 🟢 极低 | 仅增加 lint 规则 | engine/ 已零违规，不影响现有代码 |
| O10 | 🟢 极低 | 仅新增 index.ts | 渐进式迁移，不强制替换现有引用 |
| O13 | 🟢 极低 | 仅 2 处调用替换 | LogUtil 已完整实现 |

**总体风险评估**：四个优化点均为低风险机械性修改，适合并行执行。

---

## 六、自我检验记录

| 检验项 | 结果 | 备注 |
|-------|:----:|------|
| 是否完整阅读了所有核心文档？ | ✅ | project-purpose.md, architecture-design.md, CLAUDE.md, architecture-layering-standard.md |
| 每个优化建议是否基于实际代码分析？ | ✅ | 4 个并行 agent 深度扫描，每个建议引用具体文件和行号 |
| 目标对齐分析是否有事实依据？ | ✅ | 基于实际引用统计和代码依赖分析 |
| 是否考虑了"包装不替代"原则？ | ✅ | 4 个优化点均标注了原则符合性 |
| 是否考虑了与 V3 成果的兼容性？ | ✅ | V3 的类型解耦成果不受影响，本次是运行时层面和工具链层面的增强 |
| 是否有遗漏的重要问题？ | ⚠️ | L2 其他 P0 违规（Tool.ts React 依赖、AppState React 依赖）不在本次范围，留待后续批次 |

---

## 七、后续行动建议

### 本批次执行计划

四个优化点完全独立，建议全部并行执行：

1. **O3**: 创建 `src/utils/messageSelection.ts`，提取 `selectableUserMessagesFilter`，修改 QueryEngine.ts 和 handlePromptSubmit.ts 的 import
2. **O9**: 安装 ESLint，创建 `eslint.config.mjs`，配置 `no-restricted-imports`，先守护 engine/ 目录
3. **O10**: 创建 `engine/index.ts` 统一入口，分三层组织导出
4. **O13**: EventBus.ts 2 处 console.warn 替换为 LogUtil.warn()，更新 manifest

### 后续批次预览

本批次完成后，建议继续 V3 研究报告中的第三批优化：
- O1: Tool 系统 CoreTool/UITool 完整分离（高工作量）
- O6: AppState 核心状态与 UI 状态分离（高工作量）
- O7: SessionStorage 巨型文件拆分（中等工作量）
- O14: Hook 系统与 UI 解耦（高工作量）
