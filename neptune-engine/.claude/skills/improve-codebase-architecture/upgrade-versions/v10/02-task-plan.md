# V10 任务计划 — 物理分离切割 + 启动完善 + React 解耦 + 架构文档

> 版本: v10
> 创建时间: 2026-04-27
> 基于: 01-optimizer-research.md

---

## 一、项目概述

**目标**：完成框架 React 依赖解耦、initializeEngine 完善（不含 MCP）、导入路径规范化、架构文档补充，使 SDK 可独立运行。

**核心交付物**：
1. AppState 纯 JS 状态创建路径（零 React 运行时）
2. initializeEngine TODO 填充 + 设置加载 + Store 构建 + Session 恢复
3. 框架内 .tsx 文件从 18 个降至 ≤5 个
4. CLI→框架导入路径包引用化
5. 架构文档全面补充 + 目录归属分析

**不纳入**：MCP 配置提取（~680 行，推迟到 V11）

---

## 二、Agent Team 组成

| 角色 | 数量 | 职责 | 需要的能力 |
|------|------|------|-----------|
| **team-lead** | 1 | 任务协调、进度管理、质量把关 | 全局视野、决策能力 |
| **developer-1** | 1 | AppState 解耦 + initializeEngine 完善 | React/状态管理模式、大文件重构、store 设计 |
| **developer-2** | 1 | .tsx 清理 + React 移除 + 导入路径规范化 | 文件重构、import 路径管理、package.json 配置 |
| **analyst** | 1 | 目录归属分析 + state.ts 归属分析 | 代码分析、依赖追踪、架构评估（只读，不写代码） |
| **doc-writer** | 1 | 架构文档补充 + 最终文档更新 | 文档写作、架构理解 |

### 协作方式

- developer-1 专注核心解耦（O1 + O2），影响面最大，需最高质量
- developer-2 专注清理和规范化（O3 + O4 + O7），可并行推进
- analyst 纯分析，与开发并行，产出决策数据
- doc-writer 先补充当前架构文档，代码变更后更新
- team-lead 负责代码审核和最终质量验证

---

## 三、任务阶段规划

### 阶段 A：热身 + 分析（低风险，全面并行）
**目标**：快速产出 + 为后续任务准备决策数据
- T1: task .tsx 文件重命名（零风险，5 分钟）
- T2: 目录归属决策分析（纯分析）
- T3: state.ts 归属分析（纯分析）
- T4: 架构文档补充
**验收**：分析报告产出 + 文档更新

### 阶段 B：核心解耦（最高优先级）
**目标**：AppState React 解耦，解锁全部后续工作
- T5: AppState 纯 JS 状态创建路径
- T6: 框架 React hooks 消费者改造
**验收**：框架核心零 React hooks 运行时

### 阶段 C：启动完善（大工程）
**目标**：initializeEngine 可完整独立启动（不含 MCP）
- T7: initializeEngine TODO 填充（权限/工具过滤/命令/Agent）
- T8: 设置加载 + Store 构建 + Session 恢复提取
**验收**：initializeEngine() 可独立创建完整状态

### 阶段 D：清理 + 规范化
**目标**：React 依赖移除 + 导入路径包引用化
- T9: 框架 .tsx 文件 React 必要性评估 + 清理
- T10: package.json React 依赖移除
- T11: claude-code package.json exports 定义
- T12: CLI 导入路径包引用转换
**验收**：框架零 React 运行时 + CLI 通过包引用导入

### 阶段 E：收尾验证
**目标**：全面质量验证 + 文档更新
- T13: 全面质量验证
- T14: 最终文档更新
**验收**：tsc 零错误、测试通过、文档同步

---

## 四、任务清单

### T1: task .tsx 文件重命名

| 字段 | 内容 |
|------|------|
| **任务编号** | T1 |
| **任务名称** | task .tsx 文件重命名 |
| **任务目标** | 将 4 个不含 React 的 task .tsx 文件重命名为 .ts |
| **依赖关系** | 无 |
| **执行人** | developer-2 |
| **所属阶段** | A |

**具体操作**：
1. 重命名以下文件（git mv）：
   - `tasks/LocalAgentTask/LocalAgentTask.tsx` → `.ts`
   - `tasks/LocalShellTask/LocalShellTask.tsx` → `.ts`
   - `tasks/RemoteAgentTask/RemoteAgentTask.tsx` → `.ts`
   - `tasks/InProcessTeammateTask/InProcessTeammateTask.tsx` → `.ts`
2. 更新所有引用这些文件的 import 路径（.tsx → .js 或去掉扩展名）
3. 运行 `bunx tsc --noEmit` 验证

**验收标准**：
- [ ] 4 个文件已重命名为 .ts
- [ ] 所有引用路径已更新
- [ ] `bunx tsc --noEmit` 零错误
- [ ] `bun test` 全部通过

---

### T2: 目录归属决策分析

| 字段 | 内容 |
|------|------|
| **任务编号** | T2 |
| **任务名称** | 目录归属决策分析 |
| **任务目标** | 分析 utils/ 和 services/ 中每个模块的 SDK/CLI 归属，输出决策表 |
| **依赖关系** | 无 |
| **执行人** | analyst |
| **所属阶段** | A |

**具体操作**：
1. 扫描 utils/ 下 807 个文件，按子目录分类分析：
   - 每个子目录的职责（bash/、computerUse/、permissions/、model/ 等）
   - 每个子目录的消费者分布（框架内/CLI 内）
   - 标注 SDK 核心 / CLI 专用 / 共享
2. 扫描 services/ 下 283 个文件，同样分析
3. 评估 outputStyles/、jobs/ 的归属
4. 输出决策表到 `.tmp_docs/v10-directory-attribution.md`

**验收标准**：
- [ ] 每个 utils/ 子目录有归属标注
- [ ] 每个 services/ 子目录有归属标注
- [ ] 决策表含：目录、文件数、SDK/CLI 归属、理由

---

### T3: state.ts 归属分析

| 字段 | 内容 |
|------|------|
| **任务编号** | T3 |
| **任务名称** | state.ts 归属分析 |
| **任务目标** | 分析 bootstrap/state.ts 中 ~100 个 getter/setter 的 SDK/CLI 归属 |
| **依赖关系** | 无 |
| **执行人** | analyst |
| **所属阶段** | A |

**具体操作**：
1. 列出 state.ts 中所有 export 的函数/变量
2. 对每个导出，分析消费者分布（框架内/CLI 内）
3. 标注：SDK 核心 / CLI 专用 / 共享
4. 输出归属分析表到 `.tmp_docs/v10-state-attribution.md`

**验收标准**：
- [ ] 每个导出有消费者统计
- [ ] 每个导出有归属标注
- [ ] 分析表含：导出名、框架消费者数、CLI 消费者数、归属

---

### T4: 架构文档补充

| 字段 | 内容 |
|------|------|
| **任务编号** | T4 |
| **任务名称** | 架构文档全面补充 |
| **任务目标** | 为 src/ 下每个目录补充详细的模块说明 |
| **依赖关系** | 无 |
| **执行人** | doc-writer |
| **所属阶段** | A |

**具体操作**：
1. 采集每个一级目录的模块信息：
   - 目录职责
   - 关键文件列表（top-5）
   - 依赖关系（上游/下游）
   - SDK 核心 / CLI 专用标注
2. 更新 `docs/architecture-design.md` 目录树，为每个模块添加职责描述
3. 在 `docs/project-purpose.md` 中补充完整的客户端/服务端/SDK 三层架构图

**验收标准**：
- [ ] architecture-design.md 每个目录有职责说明
- [ ] project-purpose.md 有完整的三层架构图
- [ ] 文档与当前代码一致

---

### T5: AppState 纯 JS 状态创建路径

| 字段 | 内容 |
|------|------|
| **任务编号** | T5 |
| **任务名称** | AppState 纯 JS 状态创建路径 |
| **任务目标** | 创建纯 JS 函数，SDK 可不依赖 React 创建和访问 AppState |
| **依赖关系** | 无 |
| **执行人** | developer-1 |
| **所属阶段** | B |

**具体操作**：
1. 创建 `state/createAppStateStore.ts`：
   - 导出 `createAppStateStore(initialState?, onChange?)` — 返回 AppStateStore 实例
   - 内部逻辑从 AppState.tsx 的 `useState(() => createStore(...))` 提取
   - 包含 bypass permissions 检查逻辑（从 useEffect 提取）
   - 包含 settings 变更监听（从 useEffect + useCallback 提取）
   - 包含 Mailbox 实例创建（从 useMemo 提取）

2. 修改 `state/AppState.tsx`：
   - AppStateProvider 内部调用 `createAppStateStore()` 获取 store
   - 保留 React Provider 包装（CLI 消费者不修改）
   - 重新导出纯 JS 函数供非 React 环境使用

3. 导出新的纯 JS API：
   - `getAppStateStore()` — 获取当前 store 实例（非 React 环境）
   - 或通过 initializeEngine 返回值获取

**验收标准**：
- [ ] `createAppStateStore()` 零 React 导入
- [ ] AppState.tsx 的 Provider 内部调用纯 JS 函数
- [ ] CLI 117 个消费者不受影响
- [ ] `bunx tsc --noEmit` 零错误
- [ ] `bun test` 全部通过

---

### T6: 框架 React hooks 消费者改造

| 字段 | 内容 |
|------|------|
| **任务编号** | T6 |
| **任务名称** | 框架 React hooks 消费者改造 |
| **任务目标** | 框架内 6 个 React hooks 消费者改为直接使用 store API |
| **依赖关系** | T5 |
| **执行人** | developer-1 |
| **所属阶段** | B |

**具体操作**：
1. 修改以下 6 个文件（从 useAppState 改为直接 store API）：
   - `utils/teleport.tsx` — `useAppState` → 直接 `store.getState()`
   - `utils/permissions/bypassPermissionsKillswitch.ts` — `useAppState` → 直接 store
   - `utils/permissions/src/state/AppState.ts` — 评估是否为重复文件
   - `services/remoteManagedSettings/securityCheck.tsx` — `useAppState` → 直接 store
   - `services/mcp/useManageMCPConnections.ts` — `useAppState` → 直接 store
   - `state/AppState.tsx` — 自身保留 Provider，但确保不直接使用 hooks

2. 对于需要订阅状态变化的场景：
   - 使用 `store.subscribe()` 替代 `useSyncExternalStore`
   - 或通过注入机制传入 store 实例

**验收标准**：
- [ ] 6 个框架文件零 `useAppState`/`useSetAppState` 调用
- [ ] 框架核心逻辑零 React hooks 运行时依赖
- [ ] CLI 117 个消费者不受影响
- [ ] `bunx tsc --noEmit` 零错误

---

### T7: initializeEngine TODO 填充

| 字段 | 内容 |
|------|------|
| **任务编号** | T7 |
| **任务名称** | initializeEngine TODO 填充 |
| **任务目标** | 实现 5 个 TODO：权限上下文初始化、工具过滤、命令加载、Agent 加载 |
| **依赖关系** | T5 |
| **执行人** | developer-1 |
| **所属阶段** | C |

**具体操作**：
1. **权限上下文初始化**（L363 TODO）：
   - 从 main.tsx:2701-2714 提取 `initializeToolPermissionContext` 逻辑
   - 去除 Commander options 依赖，改为接收 EngineConfig 参数
   - 实现 `createToolPermissionContext(config)` 函数

2. **coordinator mode 工具过滤**（L372 TODO）：
   - 从 main.tsx:2883-2890 提取工具过滤逻辑
   - 约 10 行，低复杂度

3. **SyntheticOutputTool**（L373 TODO）：
   - 从 main.tsx:2904-2930 提取
   - 约 30 行，低复杂度

4. **命令加载**（L385 TODO）：
   - 从 main.tsx:~2966 提取
   - 调用 `getCommandProvider()` 获取命令列表

5. **Agent 加载**（L389 TODO）：
   - 从 main.tsx:~2970 提取
   - 加载 agent 定义

**验收标准**：
- [ ] initializeEngine.ts 零 TODO
- [ ] 5 个逻辑块全部实现
- [ ] `bunx tsc --noEmit` 零错误

---

### T8: 设置加载 + Store 构建 + Session 恢复提取

| 字段 | 内容 |
|------|------|
| **任务编号** | T8 |
| **任务名称** | 设置加载 + Store 构建 + Session 恢复提取 |
| **任务目标** | 从 main.tsx 提取设置加载（~160行）、Store 构建（~210行）、Session 恢复（~60行）到 initializeEngine |
| **依赖关系** | T5 + T7 |
| **执行人** | developer-1 |
| **所属阶段** | C |

**具体操作**：
1. **设置加载**（~160 行）：
   - 从 main.tsx L714-807, L1280-1349 提取
   - 创建 `loadEngineSettings(config)` 函数
   - 去除 Commander options 依赖

2. **Store 构建**（~210 行）：
   - 使用 T5 创建的 `createAppStateStore()` 
   - 从 main.tsx L4282-4402 提取 AppState 初始化逻辑
   - 构建 `getDefaultAppState()` + 字段赋值

3. **Session 恢复**（~60 行）：
   - 从 main.tsx 提取 transcript.jsonl 读取和解析逻辑
   - 创建 `restoreSession(sessionId, cwd)` 函数

**验收标准**：
- [ ] initializeEngine 包含完整的设置→权限→工具→Store→Session 链
- [ ] `bunx tsc --noEmit` 零错误
- [ ] `bun test` 全部通过

---

### T9: 框架 .tsx 文件 React 必要性评估 + 清理

| 字段 | 内容 |
|------|------|
| **任务编号** | T9 |
| **任务名称** | 框架 .tsx 文件 React 必要性评估 + 清理 |
| **任务目标** | 评估剩余 .tsx 文件的 React 必要性，尽可能清理或解耦 |
| **依赖关系** | T6 |
| **执行人** | developer-2 |
| **所属阶段** | D |

**具体操作**：
1. 逐文件评估以下 .tsx 文件的 React 用途：
   - `utils/staticRender.tsx` — Ink render，评估是否可移到 CLI
   - `utils/highlightMatch.tsx` — React 导入，评估是否可移除
   - `utils/status.tsx` — React 导入，评估是否可移除
   - `utils/statusNoticeDefinitions.tsx` — React 导入，评估是否可移除
   - `utils/plugins/performStartupChecks.tsx` — React 导入，评估是否可移除
   - `utils/processUserInput/processSlashCommand.tsx` — React 导入，评估是否可移除
   - `services/mcp/MCPConnectionManager.tsx` — 条件导入，评估是否可改为 .ts
2. 对可以移除 React 的文件，执行清理
3. 对 CLI 专用的文件（如 staticRender），评估迁移可行性
4. 更新所有引用路径

**验收标准**：
- [ ] 每个剩余 .tsx 文件有评估结论（保留 React / 可移除 / 应迁移）
- [ ] 可移除 React 的文件已清理
- [ ] `bunx tsc --noEmit` 零错误

---

### T10: package.json React 依赖移除

| 字段 | 内容 |
|------|------|
| **任务编号** | T10 |
| **任务名称** | package.json React 依赖移除 |
| **任务目标** | 确认框架内无 React 运行时后，将 react 从 dependencies 移除 |
| **依赖关系** | T6 + T9 |
| **执行人** | developer-2 |
| **所属阶段** | D |

**具体操作**：
1. 全量扫描 `grep -r "from 'react'" src/` 确认零结果（排除类型定义文件）
2. 确认 `.tsx` 文件中无 React 运行时使用
3. 在 `claude-code/package.json` 中将 `react` 从 `dependencies` 移到 `peerDependencies` 或 `devDependencies`
4. 验证 `bunx tsc --noEmit` 仍通过

**验收标准**：
- [ ] `claude-code/package.json` dependencies 中无 `react`
- [ ] `grep -r "from 'react'" src/` 仅剩类型定义文件
- [ ] `bunx tsc --noEmit` 零错误
- [ ] `bun test` 全部通过

---

### T11: claude-code package.json exports 定义

| 字段 | 内容 |
|------|------|
| **任务编号** | T11 |
| **任务名称** | claude-code package.json exports 定义 |
| **任务目标** | 定义 claude-code/package.json 的 exports 字段，支持包引用导入 |
| **依赖关系** | T10 |
| **执行人** | developer-2 |
| **所属阶段** | D |

**具体操作**：
1. 在 `claude-code/package.json` 中定义 `exports` 字段：
   ```json
   {
     "exports": {
       ".": "./src/index.ts",
       "./state": "./src/state/AppStateStore.ts",
       "./engine": "./src/engine/index.ts",
       "./engine/bootstrap": "./src/engine/bootstrap/index.ts",
       "./utils/*": "./src/utils/*.ts",
       "./services/*": "./src/services/*.ts",
       "./types/*": "./src/types/*.ts"
     }
   }
   ```
2. 定义常用路径的别名导出
3. 验证 CLI 可通过包引用路径导入

**验收标准**：
- [ ] package.json exports 字段定义完整
- [ ] CLI 可通过 `from 'claude-code'` 导入
- [ ] `bunx tsc --noEmit` 零错误

---

### T12: CLI 导入路径包引用转换

| 字段 | 内容 |
|------|------|
| **任务编号** | T12 |
| **任务名称** | CLI 导入路径包引用转换 |
| **任务目标** | 将 CLI 中 117 个文件的相对路径导入改为包引用 |
| **依赖关系** | T11 |
| **执行人** | developer-2 |
| **所属阶段** | D |

**具体操作**：
1. 分析 CLI 中所有 `from '*/src/*'` 导入
2. 按导入目标分类（state/、engine/、utils/、services/、types/ 等）
3. 批量替换为包引用路径：
   - `from '../../../src/state/AppState.js'` → `from 'claude-code/state'`
   - `from '../../src/engine/index.js'` → `from 'claude-code/engine'`
   - 其他高频导入类似处理
4. 验证所有 CLI 功能正常

**验收标准**：
- [ ] CLI 零 `src/` 相对路径导入
- [ ] 所有导入改为包引用
- [ ] `bunx tsc --noEmit` 零错误
- [ ] `bun test` 全部通过

---

### T13: 全面质量验证

| 字段 | 内容 |
|------|------|
| **任务编号** | T13 |
| **任务名称** | 全面质量验证 |
| **任务目标** | V10 质量门槛：tsc + 测试 + React 审计 + CLI 功能 |
| **依赖关系** | T1-T12 全部完成 |
| **执行人** | team-lead |
| **所属阶段** | E |

**具体操作**：
1. `bunx tsc --noEmit` — 零错误
2. `bun test` — 全量测试通过
3. React 审计：
   - `grep -r "from 'react'" src/` — 仅剩类型定义文件
   - `find claude-code/src -name '*.tsx' | wc -l` — ≤5 个
4. initializeEngine 验证：
   - 零 TODO
   - 可独立创建完整状态链
5. CLI 功能验证：
   - 包引用导入正常
   - CLI 交互模式正常
6. React 依赖：
   - `claude-code/package.json` dependencies 无 react

**验收标准**：
- [ ] tsc 零错误
- [ ] bun test 全部通过
- [ ] 框架 React 运行时导入 ≤ 3 处（仅保留必要的类型定义文件）
- [ ] initializeEngine 零 TODO
- [ ] CLI 零相对路径导入
- [ ] package.json dependencies 无 react

---

### T14: 最终文档更新

| 字段 | 内容 |
|------|------|
| **任务编号** | T14 |
| **任务名称** | 最终文档更新 |
| **任务目标** | 更新所有文档反映 V10 变更 |
| **依赖关系** | T13 |
| **执行人** | doc-writer |
| **所属阶段** | E |

**具体操作**：
1. 更新 `docs/architecture-design.md`：
   - 目录树反映 .tsx 清理、exports 定义
   - 更新 AppState 模块说明（纯 JS 路径 + React Provider 壳）
   - 更新 initializeEngine 说明（完整版）
2. 更新 `docs/okr-roadmap.md`：
   - V10 KR 完成状态
   - 更新 V11 前置条件（MCP 提取）
3. 更新 `docs/project-purpose.md`：
   - 反映三层架构图变化
4. 记录目录归属分析结论

**验收标准**：
- [ ] 所有文档与代码一致
- [ ] V10 OKR 状态已更新
- [ ] 无过时信息

---

## 五、任务依赖关系图

```
阶段 A（热身 + 分析，全部并行）
  T1 (task .tsx 重命名)       ──── 无依赖
  T2 (目录归属分析)           ──── 无依赖（只读）
  T3 (state.ts 分析)          ──── 无依赖（只读）
  T4 (架构文档补充)           ──── 无依赖

阶段 B（核心解耦）
  T5 (AppState 纯 JS 路径)    ──── 无依赖，核心任务
  T6 (React hooks 消费者改造) ──── 依赖 T5

阶段 C（启动完善）
  T7 (initializeEngine TODO) ──── 依赖 T5
  T8 (设置+Store+Session)    ──── 依赖 T5 + T7

阶段 D（清理 + 规范化）
  T9 (.tsx 评估清理)          ──── 依赖 T6
  T10 (React 依赖移除)        ──── 依赖 T6 + T9
  T11 (exports 定义)           ──── 依赖 T10
  T12 (导入路径转换)           ──── 依赖 T11

阶段 E（收尾）
  T13 (质量验证)              ──── 依赖 T1-T12
  T14 (文档更新)              ──── 依赖 T13
```

---

## 六、关键路径

```
T5 → T6 → T9 → T10 → T11 → T12 → T13 → T14
```

**最长路径**：AppState 解耦 → hooks 改造 → .tsx 清理 → React 移除 → exports 定义 → 导入转换 → 验证 → 文档

**可并行路径**：
- T1/T2/T3/T4 与 T5 并行（阶段 A 无依赖）
- T7 可在 T6 完成后立即开始（不依赖 T9）

---

## 七、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| AppState 解耦影响 CLI 117 个消费者 | 高 | AppState.tsx 保留 Provider 壳，CLI 消费者不修改 |
| 导入路径转换影响 117 个 CLI 文件 | 中 | 分批替换，先高频路径后低频路径，每批验证 |
| initializeEngine Store 构建依赖 AppState 解耦 | 中 | T8 严格依赖 T5，确保解耦先完成 |
| .tsx 清理可能发现意外的 React 依赖 | 低 | 逐文件评估，不确定的保留不动 |
