# V3 任务计划：架构分层基础建设

**版本**: v3
**日期**: 2026-04-26
**执行范围**: 第一批（5 个低风险优化点）
**来源**: `auto-upgrade/v3/01-optimizer-research.md` 中的 O1, O2, O4, O6, O11

---

## 一、项目概述

**目标**：解除核心类型层对 React/Ink 的间接依赖，建立分层架构标准，为后续大规模重构奠定基础。

**成功标准**：
1. `Tool.ts` 不 import 任何 hooks/ 或 components/ 路径
2. `QueryEngine.ts` 不 import hooks/ 路径（CanUseToolFn）
3. `engine/` 层不 import 任何 hooks/ 路径
4. 产出《项目分层架构标准》文档
5. `bunx tsc --noEmit` 零错误
6. `bun test` 全部通过（2472 tests）

---

## 二、Agent Team 组成

| 角色 | 名称 | 职责 | 数量 |
|------|------|------|------|
| **team-lead** | architect | 任务协调 + 架构审核 + O4 分层标准文档编写 | 1 |
| **developer-1** | dev-types | O1 CanUseToolFn 类型提取 + O11 权限函数纯化 | 1 |
| **developer-2** | dev-state | O2 SpinnerMode 类型提取 + O6 AppState 分离 | 1 |

**团队协作方式**：
- architect 负责 code review 和架构一致性检查
- developer 各自在独立文件上工作，避免冲突
- 所有任务完成后由 architect 统一验证

---

## 三、任务阶段划分

```
阶段 A（并行执行）:
  T1: O4 分层架构标准 ─── architect
  T2: O1 CanUseToolFn ──── dev-types
  T3: O2 SpinnerMode ───── dev-state

阶段 B（并行执行，依赖阶段 A）:
  T4: O6 AppState 分离 ─── dev-state
  T5: O11 权限函数纯化 ── dev-types

阶段 C（验证）:
  T6: 集成验证 ─────────── architect
```

---

## 四、任务清单

### T1: 定义项目分层架构标准（O4）

| 属性 | 值 |
|------|-----|
| **执行角色** | architect |
| **优先级** | P0 |
| **依赖** | 无 |
| **输入** | `01-optimizer-research.md` 中的分层标准草案 |
| **预期产出** | `docs/architecture-layering-standard.md` |

**任务目标**：
制定清晰的目录分层规范文档，明确定义 L1-L4 四层架构及其 import 规则。

**具体工作**：
1. 编写 `docs/architecture-layering-standard.md`，包含：
   - 四层定义（L1 核心类型 / L2 核心引擎 / L3 服务工具 / L4 TUI）
   - 每层对应的目录列表
   - Import 规则矩阵（谁可以 import 谁）
   - 新增文件归属判定流程
   - 现有违规 import 清单（基于 Phase 1 扫描结果）
2. 更新 `docs/architecture-design.md` 引用新文档

**验收标准**：
- [ ] 文档包含完整的四层定义和 import 规则
- [ ] 每个 import 违规都有记录
- [ ] architect review 通过

---

### T2: 提取 CanUseToolFn 类型到独立文件（O1）

| 属性 | 值 |
|------|-----|
| **执行角色** | dev-types |
| **优先级** | P0 |
| **依赖** | 无 |
| **输入** | `hooks/useCanUseTool.tsx` 中的 `CanUseToolFn` 类型 |
| **预期产出** | `types/permissions.ts`（新文件，纯类型） |

**任务目标**：
将 `CanUseToolFn` 类型从 React hook 文件中提取到纯类型文件，使核心层不再间接依赖 React。

**具体工作**：
1. 在 `src/types/` 下创建或扩展一个纯类型文件（如 `types/permissions.ts`），将 `CanUseToolFn` 类型定义移入
2. `hooks/useCanUseTool.tsx` 改为从新类型文件 re-export `CanUseToolFn`
3. 更新所有 import `CanUseToolFn` 的文件（20 个），改为从新类型文件 import
4. 关键文件变更：
   - `src/Tool.ts` — 改为从 `types/permissions.ts` import
   - `src/QueryEngine.ts` — 改为从 `types/permissions.ts` import
   - `src/engine/bridge/OriginalQueryEngineBridge.ts` — 改为从 `types/permissions.ts` import

**验收标准**：
- [ ] `Tool.ts` 不 import 任何 `hooks/` 路径
- [ ] `QueryEngine.ts` 不 import `hooks/useCanUseTool`
- [ ] `OriginalQueryEngineBridge.ts` 不 import `hooks/useCanUseTool`
- [ ] `hooks/useCanUseTool.tsx` 仍可正常工作（re-export）
- [ ] `bunx tsc --noEmit` 零错误
- [ ] `bun test` 全部通过

---

### T3: 提取 SpinnerMode 类型到独立文件（O2）

| 属性 | 值 |
|------|-----|
| **执行角色** | dev-state |
| **优先级** | P0 |
| **依赖** | 无 |
| **输入** | `components/Spinner/types.ts` 中的 `SpinnerMode` 类型 |
| **预期产出** | `types/spinner.ts`（新文件，纯类型） |

**任务目标**：
将 `SpinnerMode` 类型从 `components/Spinner/` 提取到 `types/` 目录，使 Tool.ts 不再 import components/。

**具体工作**：
1. 在 `src/types/` 下创建 `types/spinner.ts`，将 `SpinnerMode` 和 `RGBColor` 类型定义移入
2. `components/Spinner/types.ts` 改为从 `types/spinner.ts` re-export
3. `components/Spinner.tsx` 改为从新位置 import
4. 关键文件变更：
   - `src/Tool.ts` — 改为从 `types/spinner.ts` import `SpinnerMode`
   - `src/types/toolContext.ts` — 检查是否需要更新 import
   - `src/components/Spinner/index.ts` — re-export

**验收标准**：
- [ ] `Tool.ts` 不 import 任何 `components/` 路径
- [ ] `types/toolContext.ts` 不 import `components/`
- [ ] Spinner 组件正常工作（re-export 保持兼容）
- [ ] `bunx tsc --noEmit` 零错误
- [ ] `bun test` 全部通过

---

### T4: AppState 数据层与 React Provider 分离（O6）

| 属性 | 值 |
|------|-----|
| **执行角色** | dev-state |
| **优先级** | P1 |
| **依赖** | T3（同一 developer 完成后顺序执行） |
| **输入** | `state/AppState.tsx` + `state/AppStateStore.ts` |
| **预期产出** | `state/AppStateStore.ts` 纯数据化 |

**任务目标**：
确保核心代码引用 AppState 类型时不引入 React。

**具体工作**：
1. 检查 `state/AppStateStore.ts` 是否已无 React import（当前可能已经干净）
2. 确认 `state/AppState.tsx` 仅做 React Provider 包装，不定义新类型
3. 将 `state/AppState.tsx` 中所有 re-export 改为直接从 `AppStateStore.ts` import
4. 如果发现核心文件（.ts）import 了 `AppState.tsx`（而非 `.js`），修正 import 路径到 `AppStateStore.ts`

**验收标准**：
- [ ] `AppStateStore.ts` 不 import React
- [ ] `AppState.tsx` 仅做 Provider 包装 + re-export
- [ ] 核心层 .ts 文件不 import `AppState.tsx`
- [ ] `bunx tsc --noEmit` 零错误
- [ ] `bun test` 全部通过

---

### T5: hasPermissionsToUseTool 纯函数化（O11）

| 属性 | 值 |
|------|-----|
| **执行角色** | dev-types |
| **优先级** | P1 |
| **依赖** | T2（同一 developer 完成后顺序执行） |
| **输入** | `utils/permissions/permissions.ts` + `hooks/useCanUseTool.tsx` |
| **预期产出** | `OriginalQueryEngineBridge.ts` 直接使用纯函数 |

**任务目标**：
确保 engine 层的权限检查路径完全不经过 React hook。

**具体工作**：
1. 确认 `hasPermissionsToUseTool()` 在 `utils/permissions/permissions.ts` 中已可独立使用
2. 确认 `OriginalQueryEngineBridge.ts` 的 bypass 模式直接构造 `canUseTool` 函数，不调用 hook
3. 如果 `OriginalQueryEngineBridge.ts` 仍通过 `hasPermissionsToUseTool` 间接引用 hook，修正为直接使用纯函数版本
4. 确保默认模式的 `canUseTool` 也不依赖 React

**验收标准**：
- [ ] `engine/` 层不 import 任何 `hooks/` 路径
- [ ] `OriginalQueryEngineBridge.ts` 的权限路径不经过 React hook
- [ ] `bunx tsc --noEmit` 零错误
- [ ] `bun test` 全部通过

---

### T6: 集成验证

| 属性 | 值 |
|------|-----|
| **执行角色** | architect |
| **优先级** | P0 |
| **依赖** | T2, T3, T4, T5 |
| **输入** | 所有已完成的代码变更 |
| **预期产出** | 验证报告 |

**任务目标**：
验证所有变更的集成一致性，确保无遗漏和回归。

**具体工作**：
1. 运行 `bunx tsc --noEmit` 确认零类型错误
2. 运行 `bun test` 确认全部测试通过
3. Grep 验证核心文件不再有违规 import：
   - `Tool.ts` 不 import hooks/ 或 components/
   - `QueryEngine.ts` 不 import hooks/
   - `engine/` 层不 import hooks/
4. 检查所有 re-export 链是否完整
5. 更新 `docs/architecture-design.md` 反映变更

**验收标准**：
- [ ] 所有 P0-P1 验收标准通过
- [ ] 文档已更新
- [ ] 无回归问题

---

## 五、关键路径分析

```
T1 ───────────────→ T6
T2 ──→ T5 ────────→ T6
T3 ──→ T4 ────────→ T6
```

**关键路径**：T2 → T5 → T6（或 T3 → T4 → T6，取决于实际执行时间）

**并行度**：
- 阶段 A：3 个任务并行（T1, T2, T3）
- 阶段 B：2 个任务并行（T4, T5）
- 阶段 C：1 个任务（T6）

**预计工作量**：
- T1: 文档编写，较小
- T2: 20 个文件 import 路径修改，中等
- T3: ~5 个文件 import 路径修改，较小
- T4: ~5 个文件检查和修正，较小
- T5: 1 个文件修正，最小
- T6: 验证 + 文档更新，中等

---

## 六、风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| T2 的 20 个 import 路径修改引入类型错误 | 中 | 中 | 每个文件修改后立即运行 tsc 验证 |
| re-export 链断裂导致现有功能异常 | 低 | 高 | 保持原文件的 re-export，仅改变 import 来源 |
| T4 发现 AppState.tsx 深度耦合 React | 中 | 低 | 本批次只做 re-export 路径修正，深度分离留给后续 |
| T5 发现 hasPermissionsToUseTool 不是纯函数 | 低 | 中 | 确认其实现，必要时提取纯函数版本 |

**总体风险等级**：低。所有变更都是类型移动和 import 路径调整，不改变运行时行为。
