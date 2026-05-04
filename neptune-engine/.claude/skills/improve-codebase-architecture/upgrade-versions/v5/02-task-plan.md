# V5 任务计划 — 核心层深度解耦

> 生成时间：2026-04-26
> 基于：01-optimizer-research.md
> 执行策略：严格串行（O1 → O6 → O14 → O15）
> O6 范围：全量 3 阶段

---

## 一、项目概述

V5 聚焦于 4 个核心层深度解耦优化点，按严格串行依赖链执行：
- **O1**: Tool 系统 CoreTool/UITool 完整分离（中风险）
- **O6**: AppState 核心状态与 UI 状态分离 — 全量 3 阶段（高风险）
- **O14**: Hook 系统与 UI 解耦（中风险）
- **O15**: REPL.tsx 拆分（中风险）

---

## 二、Agent Team 组成

| 角色 | 名称 | 职责 | 数量 |
|------|------|------|------|
| team-lead | team-lead | 协调者：任务分配、进度管理、集成验证、异常处理 | 1 |
| architect | architect | 架构审核：每个任务的设计方案审核、代码 review、接口设计审批 | 1 |
| 开发工程师 | dev-tooling | 负责 O1 Tool UI 分离（T1-T2） | 1 |
| 核心开发 | dev-core | 负责 O6（T3-T5）、O14（T6-T7）、O15（T8-T9） | 1 |

**团队规模**：4 人

**协作方式**：
- 每个任务完成后，architect 进行代码审核
- 审核通过后 team-lead 确认并推进下一个任务
- 严格串行，同一时间只有一个 developer 在编码

---

## 三、任务阶段划分

```
阶段 1: O1 Tool UI 分离
  T1: CoreTool/UITool 接口定义 + ToolAdapter 更新
  T2: 工具实现文件分离（22 个工具 + 全量验证）

阶段 2: O6 AppState 拆分（全量 3 阶段）
  T3: Phase 1 — A 类 18 个核心字段迁移到 EngineState
  T4: Phase 2 — B 类 12 个混合字段接口化 + 同步机制
  T5: Phase 3 — 核心逻辑层依赖方迁移（~61 文件）

阶段 3: O14 Hook UI 解耦
  T6: HookCore 提取 + HookContext 接口
  T7: HookBridge + hookEvents 适配

阶段 4: O15 REPL 拆分
  T8: Engine 层逻辑提取（~1273 行）
  T9: REPL.tsx UI 重构（目标 < 2000 行）

阶段 5: 集成验证
  T10: 全量验证（tsc + test + lint:layers）
```

---

## 四、任务清单

### T1: CoreTool/UITool 接口定义 + ToolAdapter 更新

| 维度 | 内容 |
|------|------|
| **编号** | T1 |
| **名称** | CoreTool/UITool 接口定义 + ToolAdapter 更新 |
| **目标** | 定义 CoreTool（29 核心方法，零 UI 依赖）和 UITool（18 个渲染方法）接口，更新 ToolAdapter 支持互转 |
| **执行角色** | dev-tooling |
| **输入** | 当前 Tool.ts 接口、ToolAdapter.ts 实现、47 个方法分类表 |
| **预期产出** | CoreTool 接口文件、UITool 接口文件、更新后的 ToolAdapter.ts |
| **依赖** | 无 |
| **验收标准** | 1. CoreTool 接口零 React/Ink import<br>2. UITool 接口包含所有 18 个渲染方法<br>3. ToolAdapter 支持 CoreTool ↔ Tool 双向转换<br>4. `bunx tsc --noEmit` 零错误 |
| **优先级** | P0 |

### T2: 工具实现文件分离

| 维度 | 内容 |
|------|------|
| **编号** | T2 |
| **名称** | 工具实现文件分离（~22 个工具 + 全量验证） |
| **目标** | 所有工具实现文件完成 CoreTool/UITool 分离，核心部分零 UI 依赖 |
| **执行角色** | dev-tooling |
| **输入** | T1 产出（CoreTool/UITool 接口），当前 ~50 个工具文件 |
| **预期产出** | ~22 个新增 UI.tsx 文件（尚未分离的工具），所有工具核心部分不含 React/Ink import |
| **依赖** | T1 |
| **验收标准** | 1. 所有 ~50 个工具的 core 部分不含 React/Ink import<br>2. `bunx tsc --noEmit` 零错误<br>3. `bun test` 全部通过<br>4. 28 个已有 UI.tsx 不受影响 |
| **优先级** | P0 |

### T3: O6 Phase 1 — A 类核心字段迁移

| 维度 | 内容 |
|------|------|
| **编号** | T3 |
| **名称** | AppState A 类 18 个核心字段迁移到 EngineState |
| **目标** | 创建 EngineState，迁移 18 个纯核心字段，AppState 委托 EngineState |
| **执行角色** | dev-core |
| **输入** | AppState.tsx 字段分类表，engine/ 目录结构 |
| **预期产出** | EngineState.ts（18 个核心字段），AppState.tsx 修改为委托 EngineState |
| **依赖** | T2（O1 完成后开始） |
| **验收标准** | 1. EngineState.ts 零 React 依赖<br>2. AppState 的 A 类 getter/setter 委托 EngineState<br>3. 现有行为 100% 不变（AppState facade 透明）<br>4. `bunx tsc --noEmit` 零错误<br>5. `bun test` 全部通过 |
| **优先级** | P0 |

### T4: O6 Phase 2 — B 类混合字段接口化

| 维度 | 内容 |
|------|------|
| **编号** | T4 |
| **名称** | B 类 12 个混合字段接口化 + 同步机制 |
| **目标** | 定义混合字段 interface，实现 EngineState 和 AppState 的双向同步 |
| **执行角色** | dev-core |
| **输入** | T3 产出（EngineState + A 类字段），B 类字段清单 |
| **预期产出** | 混合字段 interface 定义，同步机制实现（EventBus 或观察者模式） |
| **依赖** | T3 |
| **验收标准** | 1. 混合字段有明确的 interface 定义<br>2. EngineState 和 AppState 数据一致<br>3. 同步机制不引入性能问题<br>4. `bunx tsc --noEmit` 零错误<br>5. `bun test` 全部通过 |
| **优先级** | P0 |

### T5: O6 Phase 3 — 核心依赖方迁移

| 维度 | 内容 |
|------|------|
| **编号** | T5 |
| **名称** | 核心逻辑层依赖方迁移（~61 文件） |
| **目标** | 核心逻辑层的 61 个文件从 AppState 迁移到直接使用 EngineState |
| **执行角色** | dev-core |
| **输入** | T3+T4 产出（完整 EngineState），核心依赖方清单 |
| **预期产出** | ~61 个文件修改为直接使用 EngineState（而非 AppState React Context） |
| **依赖** | T4 |
| **验收标准** | 1. 核心逻辑层文件不再依赖 React Context 获取核心状态<br>2. UI 层仍通过 AppState 正常工作<br>3. `bunx tsc --noEmit` 零错误<br>4. `bun test` 全部通过 |
| **优先级** | P0 |

### T6: HookCore 提取 + HookContext 接口

| 维度 | 内容 |
|------|------|
| **编号** | T6 |
| **名称** | HookCore 提取 + HookContext 接口定义 |
| **目标** | 从 hooks.ts 提取纯逻辑层（15 个 execute 函数），定义 HookContext 接口替代 ToolUseContext |
| **执行角色** | dev-core |
| **输入** | hooks.ts（5177 行），executeHooksOutsideREPL 分析结果 |
| **预期产出** | HookCore 模块（纯逻辑，零 UI 依赖），HookContext 接口文件 |
| **依赖** | T5（O6 完成后开始） |
| **验收标准** | 1. HookCore 模块零 React 依赖<br>2. HookContext 接口不包含 UI 类型<br>3. 15 个 execute 函数逻辑完整迁移<br>4. `bunx tsc --noEmit` 零错误 |
| **优先级** | P0 |

### T7: HookBridge + hookEvents 适配

| 维度 | 内容 |
|------|------|
| **编号** | T7 |
| **名称** | HookBridge 适配层 + hookEvents 机制改造 |
| **目标** | hookEvents 缓冲机制改为 EventBus 适配，ToolUseContext 通过 HookContext 桥接 |
| **执行角色** | dev-core |
| **输入** | T6 产出（HookCore + HookContext），现有 hookEvents 实现 |
| **预期产出** | HookBridge 模块，hookEvents → EventBus 适配 |
| **依赖** | T6 |
| **验收标准** | 1. hookEvents 不再直接依赖 UI 渲染<br>2. HookBridge 提供统一 API<br>3. UI 层 hook 渲染通过订阅实现<br>4. `bunx tsc --noEmit` 零错误<br>5. `bun test` 全部通过 |
| **优先级** | P0 |

### T8: Engine 层逻辑提取

| 维度 | 内容 |
|------|------|
| **编号** | T8 |
| **名称** | REPL 核心逻辑提取到 engine 层（~1273 行） |
| **目标** | 将 REPLQueryEngine、REPLSessionManager、REPLPermissionManager、REPLContextBuilder 提取到 engine 层 |
| **执行角色** | dev-core |
| **输入** | REPL.tsx（6314 行），engine ↔ UI 回调接口设计 |
| **预期产出** | 4 个 engine 层模块，清晰的回调接口 |
| **依赖** | T7（O14 完成后开始） |
| **验收标准** | 1. 提取的 engine 层代码零 React/Ink 依赖<br>2. engine 层逻辑可独立测试<br>3. 回调接口清晰（UI 订阅 engine 事件）<br>4. `bunx tsc --noEmit` 零错误 |
| **优先级** | P1 |

### T9: REPL.tsx UI 重构

| 维度 | 内容 |
|------|------|
| **编号** | T9 |
| **名称** | REPL.tsx UI 编排重构 |
| **目标** | REPL.tsx 只保留 UI 编排逻辑，目标 < 2000 行 |
| **执行角色** | dev-core |
| **输入** | T8 产出（engine 层模块），当前 REPL.tsx |
| **预期产出** | 重构后的 REPL.tsx（< 2000 行，纯 UI 编排） |
| **依赖** | T8 |
| **验收标准** | 1. REPL.tsx < 2000 行<br>2. 所有核心逻辑委托 engine 层<br>3. UI 渲染行为不变<br>4. `bunx tsc --noEmit` 零错误<br>5. `bun test` 全部通过 |
| **优先级** | P1 |

### T10: 集成验证

| 维度 | 内容 |
|------|------|
| **编号** | T10 |
| **名称** | 全量集成验证 |
| **目标** | 验证所有优化点的集成效果，确保 V3/V4 成果不受影响 |
| **执行角色** | team-lead |
| **输入** | T1-T9 全部产出 |
| **预期产出** | 验证报告（tsc 零错误、test 全通过、lint:layers 零违规） |
| **依赖** | T9 |
| **验收标准** | 1. `bunx tsc --noEmit` 零错误<br>2. `bun test` 全部通过<br>3. `lint:layers` 零违规<br>4. engine/ 目录零 UI 依赖<br>5. CoreTool 接口零 React 依赖 |
| **优先级** | P0 |

---

## 五、关键路径分析

```
T1 ──→ T2 ──→ T3 ──→ T4 ──→ T5 ──→ T6 ──→ T7 ──→ T8 ──→ T9 ──→ T10
 O1     O1     O6-P1   O6-P2   O6-P3   O14     O14     O15     O15    验证
```

**关键路径**：T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10（严格串行）

**关键瓶颈**：T5（O6 Phase 3，~61 文件迁移）和 T2（~22 个工具文件分离）工作量最大

---

## 六、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| O6 T3-T5 AppState 迁移引入回归 | 高 | AppState 保留为 facade，渐进式迁移，每步验证测试 |
| T2 大量工具文件修改遗漏 | 中 | 56% 已有 UI.tsx 模板可参考，逐个验证 |
| T6-T7 Hook 系统改动影响 REPL | 中 | T6-T7 完成后 T8-T9 才开始，有验证间隔 |
| T8-T9 回调接口设计不合理 | 中 | 先设计接口经 architect 审核，再实现 |
| 全流程串行，单个任务卡住影响全局 | 中 | 每个任务有明确验收标准，卡住时 team-lead 介入 |

---

## 七、验收总标准

### 代码验收
- `bunx tsc --noEmit` 零错误
- `bun test` 全部通过
- `lint:layers` 零违规
- engine/ 目录零 UI 依赖
- CoreTool 接口零 React 依赖

### 文档验收
- `docs/architecture-design.md` 更新（反映新的模块结构）
- `auto-upgrade/v5/03-execution-report.md` 执行报告

### 目标验收
- Tool 核心逻辑可脱离 React/Ink 运行
- AppState 核心状态可在非 React 环境使用
- Hook 系统核心逻辑零 UI 依赖
- REPL.tsx < 2000 行
