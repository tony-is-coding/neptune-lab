# V8 任务计划 — 内部架构收尾

> 版本: v8
> 创建时间: 2026-04-27
> 基于: 01-optimizer-research.md

---

## 一、项目概述

**目标**：engine/ 完全零 CLI 依赖，消除框架→CLI 反向依赖，为 V9 核心启动提取扫清障碍。

**核心交付物**：
1. ICommandProvider 注入机制实现（commands.ts 解耦）
2. 框架→CLI 反向依赖从 19 文件 130 条减少至可控范围
3. 框架内 React 残留文件从 11 个减少至 5 个以下
4. 死代码和孤立模块清理完毕
5. 架构文档与代码状态同步

---

## 二、Agent Team 组成

| 角色 | 数量 | 职责 | 需要的能力 |
|------|------|------|-----------|
| **team-lead** | 1 | 任务协调、进度管理、质量把关 | 全局视野、决策能力 |
| **architect** | 1 | 架构设计、代码审核、方案评审 | TypeScript 高级类型、设计模式、分层架构 |
| **developer-1** | 1 | ICommandProvider 实现、UI 组件解耦 | TypeScript 接口设计、provider 模式、React 组件注册 |
| **developer-2** | 1 | Bridge/poorMode 依赖消除、SSE 提取、死代码清理 | 代码重构、依赖分析、安全删除 |
| **developer-3** | 1 | Notification 类型提取、buddy 删除、context/ 迁移 | 类型系统、React/Ink 解耦、迁移操作 |
| **tester** | 1 | 编译验证、测试验证、质量门槛检查 | tsc、bun test、lint:layers |
| **doc-writer** | 1 | 架构文档更新、归属标注 | 文档写作、架构理解 |

### 协作方式

- developer-1/2/3 并行开发，通过 architect 交叉审核
- tester 在每批任务完成后进行质量验证
- architect 对所有代码变更进行审核后才能 commit
- doc-writer 在所有代码变更完成后统一更新文档

---

## 三、任务阶段规划

### 阶段 A：热身清理（低风险、零依赖）
**目标**：快速产出成果，建立信心
- T1: 死代码清理
- T2: parseSSEFrames 提取
- T3: buddy/ 目录删除
**验收**：tsc 零错误、测试通过、3 个优化点完成

### 阶段 B：核心解耦（并行推进）
**目标**：消除最大的反向依赖点
- T4: ICommandProvider 注入机制实现（核心任务）
- T5: Bridge 循环依赖消除
- T6: poorMode 依赖消除
**验收**：tsc 零错误、测试通过、commands.ts 的 CLI 导入可被 provider 替代

### 阶段 C：类型与 UI 解耦（并行推进）
**目标**：消除核心文件的 React 间接依赖
- T7: Notification 类型提取
- T8: UI 组件反向依赖消除
**验收**：核心文件（Tool.ts、toolContext.ts 等）零 React 间接依赖

### 阶段 D：安全迁移（顺序执行）
**目标**：将确认无核心依赖的 CLI 模块迁移出框架
- T9: context/ 目录安全迁移
**验收**：src/context/ 不存在、CLI 功能正常、零反向依赖

### 阶段 E：收尾验证（统一更新）
**目标**：文档同步、质量验证
- T10: 归属文档更新
- T11: 全面质量验证
**验收**：lint:layers 零违规、tsc 零错误、全量测试通过、文档与代码一致

---

## 四、任务清单

### T1: 死代码清理
| 字段 | 内容 |
|------|------|
| **任务编号** | T1 |
| **任务名称** | 死代码清理 |
| **任务目标** | 删除所有确认无引用的孤立文件和误操作产物 |
| **依赖关系** | 无 |
| **执行人** | developer-2 |
| **所属阶段** | A |

**具体操作**：
1. 删除 `src/jobs/classifier.ts`（零引用，172 字节）
2. 删除 `claude-code-cli/src/migrations/src/` 嵌套目录（误操作产物，仅含 `export type logEvent = any`）
3. 搜索 `src/` 中其他零引用的孤立文件并确认删除

**验收标准**：
- [x] `jobs/classifier.ts` 已删除
- [x] `migrations/src/` 嵌套目录已删除
- [x] `bunx tsc --noEmit` 零错误
- [x] `bun test` 全部通过

---

### T2: parseSSEFrames 提取到框架核心
| 字段 | 内容 |
|------|------|
| **任务编号** | T2 |
| **任务名称** | parseSSEFrames 提取 |
| **任务目标** | 将 SSE 解析纯函数从 CLI 包提取到框架 utils/，消除 Gemini 客户端的跨包依赖 |
| **依赖关系** | 无 |
| **执行人** | developer-2 |
| **所属阶段** | A |

**具体操作**：
1. 在 `src/utils/` 下创建 `sse.ts`，包含 `parseSSEFrames` 函数和 `SSEFrame` 类型
2. 从 `claude-code-cli/src/cli/transports/SSETransport.ts` 第 47-127 行复制函数定义
3. `src/services/api/gemini/client.ts` 改为从 `../../utils/sse.js` 导入
4. CLI 的 `SSETransport.ts` 也改为从框架导入（或保留本地副本 + 标注来源）
5. 迁移 `SSETransport.test.ts` 中 parseSSEFrames 的 3 个测试用例到 `utils/__tests__/sse.test.ts`

**验收标准**：
- [x] `src/utils/sse.ts` 存在且包含 parseSSEFrames + SSEFrame
- [x] gemini/client.ts 零 CLI 导入（`../../../../../claude-code-cli/` 路径消除）
- [x] `bunx tsc --noEmit` 零错误
- [x] SSE 解析测试通过

---

### T3: buddy/ 目录删除
| 字段 | 内容 |
|------|------|
| **任务编号** | T3 |
| **任务名称** | buddy/ 目录删除 |
| **任务目标** | 从框架核心删除纯 CLI 娱乐功能（宠物系统），清理外部引用 |
| **依赖关系** | 无 |
| **执行人** | developer-3 |
| **所属阶段** | A |

**具体操作**：
1. 删除 `src/buddy/` 整个目录（7 文件：companion.ts, companionReact.ts, CompanionCard.tsx, sprites.ts, types.ts, prompt.ts, useBuddyNotification.tsx）
2. 清理 `src/utils/messages.ts` 中对 `companionIntroText` 的引用（feature('BUDDY') 门控内）
3. 清理 `src/utils/attachments.ts` 中对 `getCompanionIntroAttachment` 的引用（feature('BUDDY') 门控内）
4. 清理 `claude-code-cli/src/commands/buddy/` 命令中对框架 buddy/ 的导入
5. 确认 buddy 相关的 feature('BUDDY') 引用不再导致运行时错误

**验收标准**：
- [x] `src/buddy/` 目录不存在
- [x] messages.ts 和 attachments.ts 中 buddy 引用已清理
- [x] `bunx tsc --noEmit` 零错误
- [x] `bun test` 全部通过

---

### T4: ICommandProvider 注入机制实现（核心任务）
| 字段 | 内容 |
|------|------|
| **任务编号** | T4 |
| **任务名称** | ICommandProvider 注入机制实现 |
| **任务目标** | 完成命令系统解耦，框架通过接口获取命令，CLI 在启动时注入实现 |
| **依赖关系** | 无（但工作量最大，建议优先启动） |
| **执行人** | developer-1 |
| **所属阶段** | B |

**具体操作**：
1. 在 `src/commands.ts` 中实现 `DefaultCommandProvider` 类：
   - 实现 ICommandProvider 的 14 个方法
   - 每个方法委托给 commands.ts 中现有的独立函数
   - 补充 `getRemoteSafeCommands()` 和 `getBridgeSafeCommands()` 实现
2. 修复 `setCommandProvider` 存根：
   - 参数类型从 `unknown` 改为 `ICommandProvider`
   - 内部存储到模块级变量
3. 修复 `getCommandProvider` 存根：
   - 返回类型改为 `ICommandProvider | null`
   - 返回已存储的 provider，未设置时返回 null
4. 在 CLI 启动路径注入 provider：
   - 在 `claude-code-cli/src/main.tsx` 中创建 `DefaultCommandProvider` 实例
   - 调用 `setCommandProvider(provider)` 注入
5. 在 QueryEngineConfig 构建时传入 `commandProvider`：
   - 确保 `getCommandProvider()` 的结果传入 config
6. 为 DefaultCommandProvider 编写单元测试

**验收标准**：
- [x] `DefaultCommandProvider` 类实现 14 个 ICommandProvider 方法
- [x] `setCommandProvider`/`getCommandProvider` 真实工作（非空桩）
- [x] CLI 启动时自动注入 provider
- [x] QueryEngine 通过 commandProvider 接口消费（不再直接依赖 commands.ts 内部命令列表）
- [x] DefaultCommandProvider 单元测试通过
- [x] `bunx tsc --noEmit` 零错误
- [x] CLI `--help` 和 `--version` 正常工作

---

### T5: Bridge 循环依赖消除
| 字段 | 内容 |
|------|------|
| **任务编号** | T5 |
| **任务名称** | Bridge 循环依赖消除 |
| **任务目标** | 消除 AppStateStore、product.ts、config.ts 对 CLI bridge/ 模块的 3 处反向依赖 |
| **依赖关系** | 无 |
| **执行人** | developer-2 |
| **所属阶段** | B |

**具体操作**：
1. `BridgePermissionCallbacks` 类型提取：
   - 在 `src/types/` 下创建 bridge 类型文件
   - 将 `BridgePermissionCallbacks` 从 `claude-code-cli/src/bridge/bridgePermissionCallbacks.js` 的类型定义提取到框架 types/
   - `AppStateStore.ts` 改为从框架 types/ 导入
2. `sessionIdCompat` 迁移：
   - 将 `sessionIdCompat` 函数从 `claude-code-cli/src/bridge/sessionIdCompat.js` 迁移到 `src/utils/` 或 `src/state/`
   - `constants/product.ts` 改为从框架内部导入
3. `bridgeEnabled` 功能：
   - 将 `bridgeEnabled` 状态从 `claude-code-cli/src/bridge/bridgeEnabled.js` 迁移到框架 `bootstrap/state.ts` 或新的状态点
   - `utils/config.ts` 改为从框架内部读取

**验收标准**：
- [x] AppStateStore 零 CLI bridge 导入
- [x] product.ts 零 CLI bridge 导入
- [x] config.ts 零 CLI bridge 导入
- [x] `bunx tsc --noEmit` 零错误
- [x] Bridge 功能（feature-gated）仍正常工作

---

### T6: poorMode 依赖消除
| 字段 | 内容 |
|------|------|
| **任务编号** | T6 |
| **任务名称** | poorMode 依赖消除 |
| **任务目标** | isPoorModeActive 状态由框架内管理，query 核心不再依赖 CLI 命令 |
| **依赖关系** | 无 |
| **执行人** | developer-3 |
| **所属阶段** | B |

**具体操作**：
1. 在 `src/bootstrap/state.ts` 中添加 `poorMode` 状态 getter/setter（遵循现有 ~100 getter/setter 模式）
2. 在 `src/utils/` 下创建 `poorModeState.ts`：
   - 导出 `isPoorModeActive()` 读取 bootstrap state
   - 导出 `setPoorModeActive(active: boolean)` 写入 bootstrap state
3. 修改 `query/stopHooks.ts`：将 `import('commands/poor/poorMode')` 替换为 `import('../../utils/poorModeState')` 或直接调用 `isPoorModeActive()`
4. 修改 `services/SessionMemory/sessionMemory.ts`：同样替换动态导入
5. CLI 的 `commands/poor/` 命令改为调用框架的 `setPoorModeActive()`

**验收标准**：
- [x] `query/stopHooks.ts` 零 CLI poorMode 导入
- [x] `services/SessionMemory/sessionMemory.ts` 零 CLI poorMode 导入
- [x] `isPoorModeActive()` 从框架内部读取状态
- [x] CLI 的 `/poor` 命令仍能正常切换状态
- [x] `bunx tsc --noEmit` 零错误

---

### T7: Notification 类型提取
| 字段 | 内容 |
|------|------|
| **任务编号** | T7 |
| **任务名称** | Notification 类型提取 |
| **任务目标** | 将 Notification 类型从 React 文件中提取到 types/ 层，消除核心文件的 React 间接依赖 |
| **依赖关系** | 无 |
| **执行人** | developer-3 |
| **所属阶段** | C |

**具体操作**：
1. 创建 `src/types/notification.ts`：
   - 定义 `Priority` 类型（'low' | 'medium' | 'high' | 'immediate'）
   - 定义 `BaseNotification` 接口（key, priority, timeoutMs, fold 等）
   - 定义 `TextNotification` 接口（继承 BaseNotification + text 字段）
   - 定义 `Notification = TextNotification`（纯数据版本，不含 JSX）
   - 不包含 `JSXNotification`（React.ReactNode 部分）
2. 修改 4 个核心文件的导入：
   - `Tool.ts` — 改为从 `./types/notification.js` 导入
   - `types/toolContext.ts` — 改为从 `./notification.js` 导入
   - `state/AppStateStore.ts` — 改为从 `../types/notification.js` 导入
   - `services/api/claude.ts` — 改为从 `../../types/notification.js` 导入
3. 修改 `context/notifications.tsx`：
   - 从 `../types/notification.js` 导入纯数据类型
   - 扩展 `JSXNotification`（含 React.ReactNode）用于 CLI 渲染
   - `useNotifications` hook 的类型签名兼容两套 Notification
4. 验证核心文件编译时不接触 React 类型

**验收标准**：
- [x] `src/types/notification.ts` 存在，零 React 依赖
- [x] Tool.ts、toolContext.ts、AppStateStore.ts、claude.ts 从 types/ 导入 Notification
- [x] 4 个核心文件的 Notification 导入路径不含 `context/`（React 目录）
- [x] `bunx tsc --noEmit` 零错误
- [x] CLI 通知功能正常

---

### T8: UI 组件反向依赖消除
| 字段 | 内容 |
|------|------|
| **任务编号** | T8 |
| **任务名称** | UI 组件反向依赖消除 |
| **任务目标** | 8 个框架文件不再直接导入 CLI 的 React/Ink 组件 |
| **依赖关系** | 可与 T7 并行 |
| **执行人** | developer-1 |
| **所属阶段** | C |

**具体操作**：
1. 扩展 `src/utils/swarm/componentRegistry.ts`（V7 已创建）：
   - 添加 UI 组件注册点：`renderBashModeProgress`、`renderMessageResponse`、`renderComputerUseApproval` 等
   - 每个注册点是 `(props) => void` 的函数类型（框架只定义接口，不导入 React）
2. CLI 启动时注册组件实现：
   - 在 `claude-code-cli/src/main.tsx` 中调用注册函数，注入 Ink 组件
3. 框架文件改为通过注册表获取：
   - `utils/processUserInput/processBashCommand.tsx` — 通过 registry 获取 BashModeProgress
   - `utils/claudeInChrome/toolRendering.tsx` — 通过 registry 获取 MessageResponse
   - `utils/computerUse/toolRendering.tsx` — 通过 registry 获取 MessageResponse
   - `utils/computerUse/wrapper.tsx` — 通过 registry 获取 ComputerUseApproval
4. `SuggestionItem` 类型提取到 `types/` 层：
   - 从 `claude-code-cli/src/components/PromptInput/PromptInputFooterSuggestions.js` 提取类型
   - `utils/bash/shellCompletion.ts` 和 `utils/suggestions/directoryCompletion.ts` 改为从 types/ 导入
5. `IdeOnboardingDialog`、`InvalidConfigDialog`、`ManagedSettingsSecurityDialog` 等通过动态 import + 注册模式解耦
6. `KeybindingSetup` 通过注册模式解耦（`services/remoteManagedSettings/securityCheck.tsx`）

**验收标准**：
- [x] 框架核心文件（utils/）零 CLI UI 组件直接导入
- [x] SuggestionItem 类型在 types/ 层定义
- [x] ComponentRegistry 提供 UI 组件注册/获取接口
- [x] CLI 启动时注入 UI 组件实现
- [x] `bunx tsc --noEmit` 零错误
- [x] CLI UI 渲染正常（BashMode、ComputerUse 等组件正常显示）

---

### T9: context/ 目录安全迁移
| 字段 | 内容 |
|------|------|
| **任务编号** | T9 |
| **任务名称** | context/ 目录安全迁移 |
| **任务目标** | 将确认无核心依赖的 context/ React Context 迁移到 CLI 包 |
| **依赖关系** | T7（Notification 类型提取必须先完成） |
| **执行人** | developer-3 |
| **所属阶段** | D |

**前置审计（迁移前必须完成）**：
1. 扫描 `src/context/` 中所有文件的被引用关系
2. 确认除了 Notification（T7 已提取）外，无其他核心文件依赖 context/ 的导出
3. 如发现新的核心依赖，先提取类型再迁移

**具体操作**：
1. 将 `src/context/` 下所有文件迁移到 `claude-code-cli/src/context/`
2. 更新 CLI 内所有对 context/ 的导入路径
3. 更新 `src/state/AppState.tsx` 的引用（如果它是连接 context/ 的桥梁）
4. 确认 `services/mcp/MCPConnectionManager.tsx` 的迁移归属（它使用 useNotifications hook）
5. 删除 `src/context/` 目录

**验收标准**：
- [x] 迁移前审计完成：context/ 的所有核心依赖已提取到 types/
- [x] `src/context/` 目录不存在
- [x] 零反向依赖：`src/` 中无文件导入 `claude-code-cli/src/context/`
- [x] CLI 功能正常（通知、统计、FPS、语音等 Context 正常工作）
- [x] `bunx tsc --noEmit` 零错误

---

### T10: 归属文档更新
| 字段 | 内容 |
|------|------|
| **任务编号** | T10 |
| **任务名称** | 归属文档更新 |
| **任务目标** | 更新架构文档反映 V8 变化，明确模块归属和迁移状态 |
| **依赖关系** | T1-T9 全部完成 |
| **执行人** | doc-writer |
| **所属阶段** | E |

**具体操作**：
1. 更新 `docs/architecture-design.md`：
   - 目录树中标注已迁移模块（buddy/ 已删除、context/ 已迁移）
   - 标注 ICommandProvider 接入状态（已实现）
   - 标注残留 React 文件清单和后续迁移计划
2. 更新 `docs/okr-roadmap.md`：
   - V8 KR 完成状态
   - 更新 V9 前置条件达成情况
3. 更新 `docs/cli-usage.md`：
   - 反映 context/ 迁移、buddy 删除等变化
   - 更新框架→CLI 依赖现状统计

**验收标准**：
- [x] architecture-design.md 目录树与实际代码一致
- [x] okr-roadmap.md V8 状态标注完成
- [x] 文档中无过时信息（如"20 处反向依赖"已更新为实际数值）

---

### T11: 全面质量验证
| 字段 | 内容 |
|------|------|
| **任务编号** | T11 |
| **任务名称** | 全面质量验证 |
| **任务目标** | V8 质量门槛：lint + tsc + 测试 + CLI 功能验证 |
| **依赖关系** | T1-T10 全部完成 |
| **执行人** | tester |
| **所属阶段** | E |

**具体操作**：
1. `cd claude-code && bunx tsc --noEmit` — 零错误
2. `cd claude-code && bun test` — 全量测试通过
3. `cd claude-code && bun run lint:layers` — 零违规
4. `cd claude-code-cli && bun run src/entrypoints/cli.tsx --help` — CLI 正常
5. `cd claude-code-cli && bun run src/entrypoints/cli.tsx --version` — 版本号正常
6. 框架→CLI 反向依赖最终统计：
   - 统计剩余反向依赖数量
   - 与 V7 的 19 文件 130 条对比
7. React 残留统计：
   - 统计 src/ 中剩余的 React 文件数量
   - 与 V7 的 11 个对比

**验收标准**：
- [x] tsc 零错误
- [x] bun test 全部通过
- [x] lint:layers 零违规
- [x] CLI --help/--version 正常
- [x] 反向依赖数量显著减少（目标：从 19 文件减至 10 以下）
- [x] React 残留文件减少（目标：从 11 个减至 5 以下）

---

## 五、任务依赖关系图

```
阶段 A（热身）
  T1 (死代码清理) ──── 无依赖
  T2 (SSE 提取)   ──── 无依赖
  T3 (buddy 删除) ──── 无依赖

阶段 B（核心解耦，3 个可并行）
  T4 (ICommandProvider) ──── 无依赖，工作量最大
  T5 (Bridge 消除)    ──── 无依赖
  T6 (poorMode 消除)  ──── 无依赖

阶段 C（类型/UI 解耦，2 个可并行）
  T7 (Notification 提取) ──── 无依赖
  T8 (UI 组件消除)     ──── 无依赖，可与 T7 并行

阶段 D（安全迁移）
  T9 (context/ 迁移) ──── 依赖 T7

阶段 E（收尾）
  T10 (文档更新) ──── 依赖 T1-T9
  T11 (质量验证) ──── 依赖 T1-T10
```

---

## 六、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| T4 ICommandProvider 实现工作量大 | 可能阻塞阶段 B | 优先启动，architect 提前审核接口设计 |
| T8 UI 组件解耦涉及运行时渲染 | 可能破坏 CLI UI | 保留回退方案，先注册后替换 |
| T9 context/ 迁移可能遗漏核心依赖 | 迁移后编译失败 | 前置审计 + T7 先行提取类型 |
| T5 Bridge 是 feature-gated | 难以验证 | 开启 BRIDGE_MODE feature 测试 |
