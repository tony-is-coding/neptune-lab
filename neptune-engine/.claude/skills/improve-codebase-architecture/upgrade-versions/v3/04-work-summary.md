# V3 工作总结

**版本**: v3
**日期**: 2026-04-26
**核心主题**: 架构分层基础建设 — 核心类型层 TUI 解耦

---

## 一、版本概述

V3 完成了 Agent Engine 框架的**架构分层基础建设**，核心目标是解除框架核心类型层对 React/Ink TUI 框架的间接依赖。通过将 `CanUseToolFn` 和 `SpinnerMode` 等关键类型从 UI 层文件提取到独立的纯类型文件，使框架核心引擎层可在非 CLI 环境（Web、服务端、自动化脚本）中独立运行。同时产出了《项目分层架构标准》文档，为后续大规模重构建立规范基础。

---

## 二、变化清单

### 新增

| 产出物 | 说明 |
|--------|------|
| `src/types/permissions.ts` | 权限相关纯类型定义（CanUseToolFn 等），从 React hook 中解耦 |
| `src/types/spinner.ts` | SpinnerMode、RGBColor 纯类型定义，从 UI 组件中解耦 |
| `docs/architecture-layering-standard.md` | 项目分层架构标准文档（L1-L4 四层定义 + import 规则） |
| `auto-upgrade/v3/` | V3 全过程记录（需求、研究、计划、执行报告） |

### 修改（29 个文件 import 路径调整）

| 文件 | 变更说明 |
|------|----------|
| `src/Tool.ts` | CanUseToolFn 从 hooks/ → types/permissions.ts；SpinnerMode 从 components/ → types/spinner.ts |
| `src/QueryEngine.ts` | CanUseToolFn 从 hooks/ → types/permissions.ts |
| `src/engine/bridge/OriginalQueryEngineBridge.ts` | CanUseToolFn 从 hooks/ → types/permissions.ts |
| `src/hooks/useCanUseTool.tsx` | 新增 re-export，保持向后兼容 |
| `src/components/Spinner/types.ts` | 改为从 types/spinner.ts re-export |
| `src/types/toolContext.ts` | SpinnerMode import 路径更新 |
| `src/types/toolTypes.ts` | import 路径更新 |
| `docs/architecture-design.md` | 新增分层标准文档引用 |
| 其余 21 个文件 | CanUseToolFn import 路径统一迁移到 types/permissions.ts |

### 删除

无代码删除。仅 import 路径变更，运行时行为完全不变。

---

## 三、新增特性

### 特性 1: 核心类型层 TUI 解耦

**描述**: 框架核心类型（Tool、QueryEngine、engine/ 层）不再间接依赖 React/Ink。

**使用方式**: 
- SDK 用户可直接 import `types/permissions.ts` 中的 `CanUseToolFn` 类型，无需引入 React
- SDK 用户可直接 import `types/spinner.ts` 中的 `SpinnerMode` 类型，无需引入 Ink 组件

**影响范围**: 核心引擎层（engine/）、工具类型层（Tool.ts）、查询引擎层（QueryEngine.ts）

### 特性 2: 分层架构标准

**描述**: 新增 L1-L4 四层架构标准文档，明确每层的目录归属和 import 规则。

**层级定义**:
- **L1 核心类型层** (`types/`, `engine/types.ts`) — 无外部依赖
- **L2 核心引擎层** (`engine/`, `QueryEngine.ts`, `query.ts`) — 可 import L1，不 import hooks/components
- **L3 服务/工具层** (`services/`, `tools/`, `utils/`) — 可 import L1-L2
- **L4 TUI 层** (`components/`, `hooks/`, `screens/`, `main.tsx`) — 可 import L1-L3

**使用方式**: 新增代码时参照文档判定归属层级，遵循 import 规则

**影响范围**: 全项目开发规范

---

## 四、框架使用者改进

| 改进点 | 说明 |
|--------|------|
| SDK 独立性提升 | 核心类型层不再引入 React/Ink，SDK 可在纯 Node.js/Bun 环境使用 |
| 类型安全 | `CanUseToolFn` 等类型从 React hook 中独立，SDK 用户可直接使用 |
| 架构认知统一 | 分层标准文档为团队提供统一的架构语言 |

---

## 五、技术改进

| 维度 | 改进 |
|------|------|
| **依赖方向** | 核心层 → UI 层的违规 import 已清除（Tool.ts、QueryEngine.ts、engine/ 层） |
| **代码可维护性** | 类型定义集中在 `types/` 目录，不再散落在 hooks/ 和 components/ 中 |
| **向后兼容** | 原始文件保持 re-export，现有代码无需修改即可继续工作 |
| **测试回归** | 2644 tests 全部通过，0 失败，无回归问题 |
| **类型检查** | tsc --noEmit 零错误 |

---

## 六、已知问题和后续计划

### 已知问题

1. `QueryEngine.ts` 仍 import `utils/hooks/hookHelpers.js`（非 React hook，但路径名有误导性）
2. builtin-tools 包中 33 个工具的 UI.tsx 仍直接依赖 `@anthropic/ink`
3. REPL.tsx（2500+ 行）巨型组件未拆分
4. main.tsx（6970 行）巨型文件未拆分

### 后续计划

**V4 第二批优化**（中等风险）:
- O3: QueryEngine.ts 移除 MessageSelector 懒加载
- O9: 引入层间 import 规则（lint 自动化）
- O10: engine/ 公共 API 导出规范化
- O13: console 输出通道统一

**V5 第三批优化**（高工作量）:
- O5: builtin-tools CoreTool/UITool 物理分离（33 个工具）
- O7: REPL.tsx 拆分
- O8: main.tsx 拆分
- O12: services/tools/ TUI 依赖清理
- O14: CLI/SDK 双入口
- O15: utils/ 按层拆分

---

## 七、文档维护记录

| 操作 | 文档 | 说明 |
|------|------|------|
| 新增 | `docs/architecture-layering-standard.md` | L1-L4 分层标准 |
| 更新 | `docs/architecture-design.md` | 第十节新增分层标准引用 |
| 保留 | `.tmp_docs/v3-monitor-log.md` | V3 监控日志（过程文档） |
| 清理 | 无 | 无需清理的过期文档 |
