# V13 任务计划

> 版本：V13
> 创建日期：2026-04-28
> 核心目标：SDK 类型安全 + 发布就绪 + 资源管理 + Provider 弹性 + 轻量化
> 前置分析：`01-optimizer-research.md`（10 个优化点）

---

## 一、项目概述

基于 V13 深度分析报告的 10 个优化点，拆分为 10 个可执行任务，分 3 个阶段交付。每个阶段完成后进行回归验证。

**核心收益**：SDK 从"可用"升级为"可发布、类型安全、生产可靠"。

---

## 二、Agent Team 组成

| 角色 | 数量 | 职责 | 协作方式 |
|------|------|------|---------|
| team-lead | 1 | 任务分配、进度管理、代码审核 | 接收 agent 完成通知，审核后 merge |
| architect | 1（由 team-lead 兼任） | 高风险任务的架构评审（T3 资源管理、T6 Provider 弹性） | 审核 PR，确认设计符合架构原则 |
| developer-1 | 1 | 类型系统 + 资源管理 + React 切断 + 可观测性 + SDK 轻量化 | 完成任务后通知 team-lead，领取下一任务 |
| developer-2 | 1 | 发布就绪 + 错误处理 + Provider 弹性 + CC Runtime + 配置体验 | 完成任务后通知 team-lead，领取下一任务 |

**分工原则**：
- developer-1 侧重：类型系统、资源管理、构建优化（偏 SDK 核心）
- developer-2 侧重：构建发布、Provider 体系、API 设计（偏 SDK 对外）

---

## 三、任务阶段规划

### 阶段 A：SDK 基础能力修复（4 任务）

**目标**：修复 SDK 最关键的 4 个问题——类型安全、发布就绪、资源管理、错误处理

**交付标准**：
- `tsc` 零错误
- `bun test` 全部通过
- e2e_cli 功能正常

| 任务 | 开发者 | 并行度 |
|------|--------|--------|
| T1 类型安全加固 | developer-1 | 与 T2 并行 |
| T2 发布就绪度修复 | developer-2 | 与 T1 并行 |
| T3 资源管理闭环 | developer-1 | T1 完成后开始 |
| T4 错误处理规范化 | developer-2 | T2 完成后开始 |

### 阶段 B：SDK 质量增强（3 任务）

**目标**：切断 React 穿透、Provider 弹性、可观测性完善

**交付标准**：
- SDK `.d.ts` 零 React 引用
- Provider 重试/熔断可用
- 日志模块有完整测试

| 任务 | 开发者 | 并行度 |
|------|--------|--------|
| T5 React 类型穿透切断 | developer-1 | 依赖 T2 完成 |
| T6 Provider 弹性补齐 | developer-2 | 阶段 A 全部完成 |
| T7 可观测性完善 | developer-1 | T5 完成后开始，依赖 T4 |

### 阶段 C：SDK 交付完善（3 任务）

**目标**：统一 CC Runtime、SDK 轻量化、配置 DX 改进

**交付标准**：
- lint-layers 穿透 import 减少 50%+
- SDK 独立构建可用
- API 文档/示例可运行

| 任务 | 开发者 | 并行度 |
|------|--------|--------|
| T8 CC Runtime 统一层补全 | developer-2 | 依赖 T6 完成 |
| T9 SDK 轻量化与依赖拆分 | developer-1 | 依赖 T2 + T5 完成 |
| T10 SDK 配置与 DX 改进 | developer-2 | T8 完成后开始，依赖 T1 |

---

## 四、任务清单

| 编号 | 名称 | 目标 | 执行人 | 依赖 | 验收标准 |
|------|------|------|--------|------|---------|
| T1 | SDK API 类型安全加固 | query() 返回精确类型，事件类型映射，ISessionStore 类型修复 | developer-1 | 无 | ① `query()` 返回 `AsyncGenerator<QueryEvent>` ② `on()/once()` 支持 `EngineEventMap` 泛型 ③ ISessionStore 改用 SessionSnapshot 或导出 Session ④ tsc 零错误 ⑤ e2e_cli 正常 |
| T2 | SDK 发布就绪度修复 | package.json 配置修复，构建产物可发布 | developer-2 | 无 | ① exports.default 指向 dist/ ② 移除通配符导出 ③ `bun run build:sdk` 成功产出 dist/sdk/ + .d.ts ④ files 字段正确 ⑤ npm pack 后 import 验证通过 |
| T3 | 资源生命周期管理闭环 | 修复 Session 泄漏、查询中断、全局状态、关机行为 | developer-1 | T1 | ① destroyed Session 从 Map 移除或 GC 默认启动 ② destroy() 通过 AbortController 取消活跃查询 ③ tokenBudgetStates 改为实例属性 ④ gracefulShutdown 默认 exit:false ⑤ destroy 时序修复（engine:stopped 在 destroyed=true 之后）⑥ 回归测试通过 |
| T4 | 错误处理体系规范化 | 统一 EngineError，消除静默 catch，错误链支持 | developer-2 | T2 | ① 4 处原始 Error 改为 EngineError ② 8 处静默 catch 增加 debug/warn 日志 ③ EngineError 支持 cause 链 ④ 新增 TIMEOUT_ERROR 和 TOOL_ERROR 错误码 ⑤ 现有测试通过 |
| T5 | React 类型穿透切断 | SDK 零 React 类型依赖 | developer-1 | T2 | ① toolTypes.ts 拆分为核心+UI ② Tool.ts 的 React.ReactNode 改为 unknown ③ ToolAdapter 的 React 引用移除 ④ SDK .d.ts 中 grep react 结果为零 ⑤ CLI tsc 通过 |
| T6 | Provider 弹性能力补齐 | 重试、熔断、错误分类改进 | developer-2 | T4 | ① BaseProvider 新增 RetryConfig，RATE_LIMIT/NETWORK_ERROR 自动重试 ② 新增 CircuitBreaker 类 ③ AgentEngine.query() catch 使用 classifyError() ④ classifyError 增加 529/502/503 映射 ⑤ 新增对应测试用例 |
| T7 | 可观测性体系完善 | 日志测试、运行时级别调整、EventBus 保护 | developer-1 | T4, T5 | ① engine/log/ 完整单元测试（覆盖 LogProvider/JsonLog/MDC/child/级别） ② LogUtil 新增 setLevel() ③ EventBus 新增 maxListeners 限制（默认 50）④ EventBus.on() TTL timer 在 clear() 时一并清理 |
| T8 | CC Runtime 统一层补全 | 扩展 CCRuntime，收拢穿透 import | developer-2 | T6 | ① CCRuntime 新增 createFileStateCache() 和 hasPermissionsToUseTool() ② 新增 LLMRuntime 子接口封装 LLM API 调用 ③ bridge/ 的 4 处直接 CC import 通过 CCRuntime ④ lint-layers 穿透 import 减少 50%+ ⑤ 回归测试通过 |
| T9 | SDK 轻量化与依赖拆分 | SDK 核心依赖精简，独立构建入口 | developer-1 | T2, T5 | ① Provider SDK 移至 optionalDependencies ② CLI 依赖不打入 SDK 构建 ③ SDK build:sdk 独立入口可用 ④ mcp-chrome-bridge 移至 optional ⑤ SDK 包 < 2MB |
| T10 | SDK 配置与 DX 改进 | API 简化、ESM 兼容、EventBus 封装 | developer-2 | T1, T8 | ① SessionInfo/SessionMetadata 合并为统一类型 ② AgentEngineConfig tools/skills 提升到顶层 ③ collectText/waitForResult 改为 AgentEngine 方法 ④ create() 中 require() 改为 import() ⑤ getEventBus() 返回只读接口 ⑥ e2e_cli 更新后正常运行 |

---

## 五、执行时序图

```
时间线 →

developer-1: [T1 类型安全] → [T3 资源管理] → [T5 React切断] → [T7 可观测性] → [T9 SDK轻量化]
                                           ↑ T2完成               ↑ T4完成
developer-2: [T2 发布就绪] → [T4 错误处理] → [T6 Provider弹性] → [T8 CC Runtime] → [T10 配置DX]
                                                              ↑ T6完成              ↑ T1完成
```

---

## 六、风险评估与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| T3 资源管理 destroy 时序变更 | 现有行为可能被破坏 | architect 重点审核，回归测试 + e2e_cli 验证 |
| T5 React 类型拆分影响 CLI | CLI 的 Tool 类型引用需要更新 | 拆分后立即验证 CLI tsc |
| T10 API 签名变更 | e2e_cli 和示例代码需要同步更新 | 任务内包含 e2e_cli 适配 |
| T9 SDK 构建变更 | CI 流程可能需要调整 | 验证 npm pack 后 import 正常 |

---

## 七、预计产出

| 类别 | 数量 |
|------|------|
| 总任务数 | 10 |
| 涉及文件数 | ~70 |
| 新增测试用例 | ~100+ |
| 3 阶段交付 | A(4) → B(3) → C(3) |
