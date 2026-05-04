# V4 任务计划 — 架构分层进阶

> 生成时间：2026-04-26
> 基于：01-optimizer-research.md（4 个优化点深度分析）

---

## 一、项目概述

V4 聚焦 4 个中等风险优化点，全部为低风险机械性修改，无依赖关系，可全部并行执行。

**目标**：
- QueryEngine.ts 零 UI 组件依赖
- engine/ 有自动化层间 import 守护
- engine/ 有统一公共 API 入口
- engine 核心层 console 输出统一通过 LogUtil

**成功标准**：
- `bunx tsc --noEmit` 零错误
- `bun test` 全部通过
- `lint:layers` 检查 engine/ 目录零违规
- V3 成果不受影响

---

## 二、Agent Team 组成

| 角色 | 代号 | 职责 | 数量 |
|------|------|------|:----:|
| **架构师** | architect | 架构审核、代码 review、集成验证 | 1 |
| **核心开发** | dev-core | O3（QueryEngine UI 解耦）+ O13（console 通道统一） | 1 |
| **工具开发** | dev-tooling | O9（层间 import 规则）+ O10（engine 公共 API） | 1 |

**团队规模**：3 人

**协作方式**：
- T1/T2/T3/T4 全部并行执行
- 各 developer 完成后提交架构师 review
- 架构师最后执行集成验证（T5）

---

## 三、任务阶段划分

```
阶段 A（并行执行）：
  T1: O3 QueryEngine UI 解耦 ──────── dev-core
  T2: O9 层间 import 规则 ─────────── dev-tooling
  T3: O10 engine 公共 API ─────────── dev-tooling
  T4: O13 console 通道统一 ─────────── dev-core

阶段 B（审核验证）：
  T5: 集成验证 ───────────────────── architect
```

---

## 四、任务清单

### T1: O3 — QueryEngine UI 组件懒加载移除

**任务目标**：QueryEngine.ts 不再 require 任何 components/ 路径

**执行角色**：dev-core

**输入**：
- 01-optimizer-research.md 中 O3 分析结果
- `src/QueryEngine.ts` 第 89-91 行（懒加载 require）
- `src/components/MessageSelector.tsx` 第 893-938 行（selectableUserMessagesFilter 定义）

**预期产出**：
1. 新建 `src/utils/messageSelection.ts`，包含：
   - `selectableUserMessagesFilter` 纯函数（从 MessageSelector.tsx 提取）
   - 相关依赖：`isSyntheticMessage`, `isToolUseResultMessage` 来自 `utils/messages.js`
2. 修改 `src/QueryEngine.ts`：
   - 删除第 89-91 行的 `messageSelector` 懒加载定义
   - 添加 `import { selectableUserMessagesFilter } from './utils/messageSelection.js'`
   - 第 474 行改为直接调用 `selectableUserMessagesFilter(msg)`
   - 第 647 行改为直接调用 `selectableUserMessagesFilter`
3. 修改 `src/utils/handlePromptSubmit.ts`：
   - 第 5 行改为从 `./messageSelection.js` 导入
4. 修改 `src/components/MessageSelector.tsx`：
   - 改为从 `../utils/messageSelection.js` 导入 `selectableUserMessagesFilter`
   - 保持原有 re-export 以兼容其他消费者

**依赖关系**：无

**验收标准**：
- [ ] `grep -n "require.*components" src/QueryEngine.ts` 返回空
- [ ] `grep -n "MessageSelector" src/QueryEngine.ts` 返回空
- [ ] `src/utils/messageSelection.ts` 存在且不包含任何 React/Ink import
- [ ] `bunx tsc --noEmit` 零错误
- [ ] `bun test` 全部通过

**优先级**：P0

---

### T2: O9 — 层间 import 规则（ESLint lint barrier）

**任务目标**：engine/ 目录有自动化层间 import 守护机制

**执行角色**：dev-tooling

**输入**：
- 01-optimizer-research.md 中 O9 分析结果
- `claude-code/biome.json`（现有 lint 配置）
- `docs/architecture-layering-standard.md`（分层标准）

**预期产出**：
1. 安装 ESLint 为 devDependency（v9+ flat config）
2. 创建 `claude-code/eslint.config.mjs`，配置 `no-restricted-imports` 规则：
   - 对 `src/engine/**/*.ts`：禁止 import react / components / hooks / screens / keybindings
   - 对 `src/QueryEngine.ts`：禁止 import components / hooks（O3 完成后可启用）
3. 添加 npm script：`"lint:layers": "eslint src/engine/ --max-warnings 0"`
4. 验证 `bun run lint:layers` 通过（engine/ 零违规）

**依赖关系**：无

**验收标准**：
- [ ] `eslint.config.mjs` 存在且配置了 `no-restricted-imports`
- [ ] `bun run lint:layers` 执行成功（engine/ 零违规）
- [ ] 现有 `bun run lint`（Biome）不受影响
- [ ] `bunx tsc --noEmit` 零错误

**优先级**：P0

---

### T3: O10 — engine/ 公共 API 导出规范化

**任务目标**：engine/ 有统一的公共 API 入口

**执行角色**：dev-tooling

**输入**：
- 01-optimizer-research.md 中 O10 分析结果
- `src/engine/` 目录结构（39 个文件）
- `engine/session/index.ts` / `engine/log/index.ts` / `engine/cc-runtime/index.ts`（已有子模块入口）

**预期产出**：
1. 创建 `src/engine/index.ts`，分三层组织导出：
   - **第一层：核心公共 API**（高频使用）
     - re-export session 上下文访问器（`getSessionId`, `getIsRemoteMode` 等）from `./session/index.js`
     - re-export `LogUtil` from `./log/index.js`
   - **第二层：AgentEngine 核心 API**（SDK 用户）
     - re-export `AgentEngine` from `./AgentEngine.js`
     - re-export 类型定义 from `./types.js`
     - re-export 错误体系 from `./errors.js`
   - **第三层：扩展 API**（高级用户）
     - re-export 存储接口 from `./storage/`
     - re-export CCRuntime from `./cc-runtime/index.js`
     - re-export EventBus from `./events/EventBus.js`
     - re-export SkillLoader from `./skill/SkillLoader.js`
     - re-export ToolAdapter from `./tools/ToolAdapter.js`
2. **不修改现有引用**（渐进式迁移策略）

**依赖关系**：无

**验收标准**：
- [ ] `src/engine/index.ts` 存在
- [ ] 包含三层导出结构，re-export 所有公共 API
- [ ] 不导出内部实现（EngineFacade / SessionManager / Bridge 等）
- [ ] `bunx tsc --noEmit` 零错误
- [ ] 现有 80 处外部引用不受影响

**优先级**：P0

---

### T4: O13 — console 输出通道统一

**任务目标**：engine 核心层完全通过 LogUtil 进行日志输出

**执行角色**：dev-core

**输入**：
- 01-optimizer-research.md 中 O13 分析结果
- `src/engine/events/EventBus.ts` 第 57 行、第 74 行
- `src/engine/log/LogUtil.ts`（已完整实现）
- `docs/feature-design/global-log-optimizer/console-replace-manifest.md`

**预期产出**：
1. 修改 `src/engine/events/EventBus.ts`：
   - 添加 `import { LogUtil } from '../log/index.js'`
   - 第 57 行 `console.warn(...)` 替换为 `LogUtil.warn(...)`
   - 第 74 行 `console.warn(...)` 替换为 `LogUtil.warn(...)`
2. 更新 `docs/feature-design/global-log-optimizer/console-replace-manifest.md`：
   - 标记 `OriginalQueryEngineBridge.ts` 的 3 处为「已完成替换」
   - 补充 `EventBus.ts` 的 2 处（遗漏项）
   - 补充 `ConsoleLogProvider.ts` 说明（基础设施层，不替换）

**依赖关系**：无

**验收标准**：
- [ ] `grep -n "console\.\(log\|warn\|error\)" src/engine/events/EventBus.ts` 仅剩 LogUtil 调用（无直接 console）
- [ ] engine/ 核心层 console 调用仅剩 ConsoleLogProvider.ts（基础设施层）
- [ ] `bunx tsc --noEmit` 零错误
- [ ] `bun test` 全部通过
- [ ] console-replace-manifest.md 已更新

**优先级**：P0

---

### T5: 集成验证

**任务目标**：验证所有变更的集成正确性，确保无回归

**执行角色**：architect

**输入**：
- T1-T4 的所有产出物
- V4 成功标准

**预期产出**：
1. 执行完整验证：
   - `bunx tsc --noEmit` 零错误
   - `bun test` 全部通过
   - `bun run lint:layers` 通过
   - `bun run lint`（Biome）不受影响
2. 验证 O3 成果：`grep -r "require.*components" src/QueryEngine.ts` 为空
3. 验证 O9 成果：`bun run lint:layers` 零违规
4. 验证 O10 成果：`engine/index.ts` 存在且导出正确
5. 验证 O13 成果：engine 核心 console 仅剩 ConsoleLogProvider
6. 更新 `docs/architecture-layering-standard.md`（如有必要）

**依赖关系**：T1 + T2 + T3 + T4 全部完成

**验收标准**：
- [ ] 所有 V4 成功标准满足
- [ ] V3 成果不受影响
- [ ] 集成验证报告记录所有检查结果

**优先级**：P0

---

## 五、关键路径分析

```
T1 (O3) ────┐
T2 (O9) ────┤
T3 (O10) ───┼──→ T5 (集成验证)
T4 (O13) ───┘
```

**关键路径**：max(T1, T2, T3, T4) + T5

**并行度**：T1-T4 全部并行（4 个任务 2 个 developer 交替执行）
- dev-core：T1 → T4（或 T4 → T1）
- dev-tooling：T2 → T3（或 T3 → T2）

**预估工作量**：
- T1: 小（提取 1 个纯函数 + 改 3 处 import）
- T2: 小（安装 + 配置 ESLint）
- T3: 中（创建 index.ts，梳理 39 个文件的导出结构）
- T4: 极小（改 2 处调用 + 更新文档）
- T5: 小（运行验证命令 + review）

---

## 六、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|:----:|:----:|---------|
| ESLint 与 Biome 配置冲突 | 低 | 中 | ESLint 仅配置一条规则，不重叠 |
| selectableUserMessagesFilter 提取后行为变化 | 极低 | 中 | 纯函数提取，不改逻辑；测试回归 |
| engine/index.ts 循环依赖 | 极低 | 中 | 不导出内部实现，仅 re-export 公共 API |
| LogUtil.warn 签名不兼容 | 极低 | 低 | LogUtil.warn(msg, attrs?) 已实现 |

**总体风险**：极低。四个任务均为机械性修改，不涉及架构变更。
