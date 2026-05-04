# V20 任务计划

> 版本：V20
> 日期：2026-04-29
> 范围：去 UI 耦合 + 无用代码清理 + SDK 入口统一 + Provider 注入 + CLI 模块标记

---

## 一、项目概述

V20 聚焦 SDK 独立性：消除 UI 类型泄漏、清理死代码、统一入口、支持自定义 Provider。6 个优化点拆为 8 个可执行任务，4 波次执行。

**核心原则**：
- 不改核心 agent loop / tool_calling / skill / mcp / hook
- 不做代码目录重组
- 渐进式推进，每波次可独立验证

---

## 二、Agent Team 组成

| 角色 | 数量 | 职责 | 协作方式 |
|------|------|------|---------|
| team-lead | 1 | 任务分配、进度管理、统一 commit、merge | 分配任务、收集完成通知、触发下一波次 |
| architect | 1 | 架构审核、编译验证、回归测试 | 审核 T3/T6（复杂任务）、执行 T8（验证） |
| developer-1 | 1 | 死代码清理 + CLI 模块标记 | 执行 T1→T5，简单快速任务 |
| developer-2 | 1 | Tool 类型解耦 + initializeEngine 清理 | 执行 T2→T3→T6，类型密集任务 |
| developer-3 | 1 | SDK 入口统一 + Provider 注入 | 执行 T4→T7，API 层面任务 |

共 5 个 Agent。

---

## 三、任务阶段规划

### Wave 1：基础清理（2 任务并行）
**小目标**：清除死代码和 UI 类型依赖基础
- T1 死代码清理（developer-1）— 零风险
- T2 types/ 层 React 移除（developer-2）— 类型层基础

### Wave 2：核心重构（3 任务并行）
**小目标**：Tool 类型分离 + 入口对齐 + CLI 标记
- T3 Tool 接口 CoreTool/UITool 分离（developer-2）— 依赖 T2
- T4 SDK 入口统一（developer-3）— 依赖 T1
- T5 CLI 模块 @cli-only 标记（developer-1）— 依赖 T1

### Wave 3：能力扩展（2 任务并行）
**小目标**：启动路径清理 + Provider 可扩展
- T6 initializeEngine 清理（developer-2）— 依赖 T3
- T7 自定义 Provider 注入（developer-3）— 依赖 T4

### Wave 4：验证收尾（1 任务）
**小目标**：编译通过 + 回归通过
- T8 编译验证 + 回归测试（architect）— 依赖全部

---

## 四、任务清单

| 编号 | 任务名称 | 任务目标 | 执行人 | 依赖 | 风险 | 验收标准 |
|------|---------|---------|--------|------|------|---------|
| T1 | 死代码和废弃模块清理 | 删除所有零引用的废弃目录、stub 文件、残留注释 | developer-1 | 无 | 极低 | ① 删除 assistant/、coordinator/、jobs/、utils/dxt/、utils/vendor/ripgrep/、proactive/useProactive.ts ② 删除 engine/compat/NoOpAnalytics.ts（重复实现）③ 清理 7 处 buddy 残留注释（AppStateStore.ts、messages.ts、attachments.ts、config.ts）④ engine/types/appstate-audit-report.md 移至 docs/ 或删除 ⑤ `tsc --noEmit` 通过 |
| T2 | types/ 层 React 类型依赖移除 | 消除 types/ 目录中的 React/Ink import，SDK 类型层零 UI 依赖 | developer-2 | 无 | 低 | ① types/textInputTypes.ts 移除 `import type React from 'react'` 和 `import type { Key } from '@anthropic/ink'`，用 `unknown` / 自定义 Key 类型替代 ② types/command.ts 的 `LocalJSXCommandCall` 返回类型从 `React.ReactNode` 改为 `unknown` ③ types/spinner.ts 的 `SpinnerMode = any` 改为 `SpinnerMode = string` ④ `tsc --noEmit` 通过 |
| T3 | Tool 接口 CoreTool/UITool 分离 | 将 Tool.ts 的 7 个 render*() 方法从核心类型分离，SDK 用户只面对 CoreTool | developer-2 | T2 | 中 | ① Tool.ts 中的 7 个 render*() 方法从主接口分离到 UITool 扩展接口 ② engine/types/tool.ts 屏障文件重新导出 CoreTool 而非完整 Tool ③ QueryEngine.ts 的 Tool 引用改为 CoreTool（如可行） ④ CLI 层通过 types/toolTypes.ui.ts 获取 UITool ⑤ architect 审核通过 ⑥ `tsc --noEmit` 通过 |
| T4 | SDK 入口统一 | engine/index.ts 和 src/index.ts 导出对齐，消除 20+ 项差异 | developer-3 | T1 | 极低 | ① config 模块（IConfigProvider、UnifiedConfig、normalizeConfig、ConfigDiagnostics）从 engine/index.ts 公共导出 ② 日志实现类（MDC、JsonLogFormatter、ConsoleLogProvider、FileLogStore）补齐到 engine/index.ts ③ ProviderType 补齐到 src/index.ts ④ 两入口文件添加分区注释（核心 API / 扩展 API / CLI 专用） ⑤ `tsc --noEmit` 通过 |
| T5 | CLI 专用模块 @cli-only 标记 | 为所有 CLI 专用模块添加明确标记，为后续物理分离做准备 | developer-1 | T1 | 极低 | ① 以下目录的 index.ts / 主要文件添加 `@cli-only` JSDoc 标记：outputStyles/、proactive/、utils/suggestions/、utils/processUserInput/、utils/claudeInChrome/、utils/deepLink/、services/tips/、services/autoDream/、services/PromptSuggestion/、services/skillSearch/ ② services/mcp/ 中 MCPConnectionManager.tsx 标记 CLI 专用 ③ services/compact/ 中 compactWarningHook.ts 标记 CLI 专用 ④ tasks/pillLabel.ts 标记 CLI 专用 |
| T6 | initializeEngine @deprecated 路径清理 | SDK 启动路径零 CLI 依赖 | developer-2 | T3 | 中 | ① AgentEngine.create() 中 `(config as Record<string, unknown>).cwd` 运行时嗅探替换为显式 config 字段 ② initializeEngine() 中 CLI 专用的 getTools/getCommands/permissionSetup 分支标记为 CLI-only 或提取 ③ buildQueryEngineConfigFromOptions() @deprecated 函数清理 ④ architect 审核通过 ⑤ `tsc --noEmit` 通过 |
| T7 | 自定义 Provider 注入机制 | SDK 用户可注册自定义 Provider 并被 AgentEngine 使用 | developer-3 | T4 | 低 | ① AgentEngineConfig 新增 `providerRegistry?: ProviderRegistry` 字段 ② OriginalQueryEngineBridge.createProviderWithConfig() 从硬编码 switch 改为先查 registry 再 fallback ③ CircuitBreaker 配置字段加入 AgentEngineConfig（failureThreshold、resetTimeoutMs） ④ ProviderAdapter 接口从 src/index.ts 补齐导出 ⑤ `tsc --noEmit` 通过 |
| T8 | 编译验证 + 回归测试 | 确认全部改动不破坏现有功能 | architect | T1-T7 | — | ① `tsc --noEmit` 非测试文件零新增错误 ② engine/ 目录零 React/Ink import 验证 ③ engine/index.ts 和 src/index.ts 差异验证（仅 CLI 专用项合理差异） ④ 死代码目录确认已删除 ⑤ CLI 标记确认已添加 |

---

## 五、依赖关系图

```
T1 死代码清理 ────→ T4 SDK 入口统一 ────→ T7 Provider 注入
      │                                         
      ├──→ T5 CLI 模块标记                      
      │                                         
T2 React 类型移除 → T3 Tool 接口分离 → T6 initializeEngine 清理
                                              │
      T1 ─ T2 ─ T3 ─ T4 ─ T5 ─ T6 ─ T7 ──→ T8 编译验证
```

**关键路径**：T2 → T3 → T6 → T8（类型解耦链，最长 4 步）
**并行机会**：T1 和 T2 可完全并行；T4/T5/T3 可并行

---

## 六、开发分支

- 分支名：`optimize/v20-sdk-independence`
- 基于：main 分支
- 所有团队成员共享同一分支
