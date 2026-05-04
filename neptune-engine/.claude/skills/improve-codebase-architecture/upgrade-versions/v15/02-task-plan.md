# V15 任务计划

> 版本：V15
> 规划日期：2026-04-28
> 核心目标：性能/效果/架构深度优化 — AsyncGenerator 资源安全 + 类型统一 + 错误统一 + Session 生命周期
> 基于：01-optimizer-research.md 10 个优化点，取 P1 + 高价值 P2 = 7 任务
> 用户决策：类型渐进式过渡、错误全英文、Tool 统一用 ToolExtension

---

## 一、项目概述

V15 聚焦生产可靠性和开发者体验，从三个维度优化 SDK：
1. **资源安全**：修复 AsyncGenerator 资源泄漏、Session 生命周期清理遗漏
2. **类型统一**：消除 `as any` 逃逸、统一 Config 类型、结构化 Provider 配置
3. **错误统一**：错误信息全英文、统一使用 EngineError、添加修复建议

---

## 二、Agent Team 组成

| 角色 | 数量 | 职责范围 | 能力要求 |
|------|------|---------|---------|
| team-lead | 1 | 任务分配、进度管理、代码审核 | 协调能力、代码审核 |
| developer-1 | 1 | AsyncGenerator 清理 + Session 生命周期 + 内存保护 | TypeScript、AsyncGenerator、资源管理 |
| developer-2 | 1 | 类型统一 + 错误统一 + EventBus + Provider LLMRuntime | TypeScript 类型系统、API 设计 |

**团队规模**：3 人（1 lead + 2 developer）

**协作方式**：
- team-lead 负责任务分配和代码审核
- developer-1 专注资源安全和生命周期（改动集中在 engine/core）
- developer-2 专注类型和 API 设计（改动横跨 engine/ 多模块）
- 通过 TaskList 协调进度

---

## 三、任务阶段规划

### 阶段 A：资源安全（2 任务）

**目标**：修复 AsyncGenerator 资源泄漏 + Session 生命周期清理完整
**预期**：5+ 新测试用例，长时间运行的 SDK 不再累积资源泄漏

### 阶段 B：API 质量（2 任务）

**目标**：错误处理统一 + 类型体系统一
**预期**：错误信息全英文、as any 减少 50%、类型导出一致

### 阶段 C：功能增强（3 任务）

**目标**：内存保护 + EventBus 增强 + Provider LLMRuntime 统一接口
**预期**：sessionMessages 可控、EventBus API 一致、Provider 可插拔

---

## 四、任务清单

| 编号 | 任务名称 | 任务目标 | 依赖 | 执行人 | 验收标准 |
|------|---------|---------|------|--------|---------|
| T1 | AsyncGenerator 资源生命周期修复 | 修复 runInSessionContextAsync / waitForResultWithTimeout / Provider 适配器的资源泄漏 | 无 | developer-1 | ① wrapper generator 实现 .return()/.throw() ② waitForResultWithTimeout 超时时关闭 generator ③ Provider query() 添加 finally 清理 ④ 新增 5+ 测试用例 |
| T2 | 错误处理体系统一 | engine/ 所有错误统一为 EngineError + 英文 + 修复建议 | 无 | developer-2 | ① 中文错误全改英文 ② CircuitBreaker 使用 EngineError ③ classifyQueryError 改为结构化分类 ④ 新增 CIRCUIT_OPEN 等 EngineErrorCode |
| T3 | API 类型体系统一 | 统一 Config 类型、消除冲突导出、结构化 ProviderConfig | 无 | developer-2 | ① 废弃 bootstrap EngineConfig，统一用 AgentEngineConfig ② 删除 engine/ 多余 Tool 类型导出 ③ ProviderConfig.type 改为联合类型 ④ ProviderConfig.config 结构化 ⑤ AssistantTextEvent.content 改为 string ⑥ as any 减少 50% |
| T4 | Session 生命周期资源清理 | destroySession/destroy 中所有关联资源被正确清理 | T1 | developer-1 | ① destroySession 清理 sessionMetadata ② destroy 中移除外部 signal 监听器 ③ 清理 tokenBudgetStates ④ 新增 3+ 测试 |
| T5 | sessionMessages 内存保护 | 加载 transcript 时添加大小限制，防止 OOM | 无 | developer-1 | ① loadSession 添加最大消息数限制（默认 10000） ② 超限截断+日志警告 ③ 限制可配置 |
| T6 | EventBus API 增强 | 统一 subscribe/on API、修复 TTL timer 泄漏 | 无 | developer-2 | ① on() 支持 sessionId 过滤 ② subscribe 返回取消函数 ③ TTL timer 触发后自清理 ④ unsubscribe 函数同时清理 TTL timer |
| T7 | Provider LLMRuntime 统一接口 | 7 个 Provider 实现统一 LLMRuntime 接口，消除 as any[] | T3 | developer-2 | ① 定义 LLMRuntime 接口 ② 所有 Provider 实现该接口 ③ 消除 16 处 as any[] ④ ProviderRegistry.getRuntime() 查询 |

---

## 五、依赖关系图

```
T1 (AsyncGenerator) ──→ T4 (Session生命周期)

T2 (错误统一) ────→ 独立
T3 (类型统一) ──→ T7 (Provider LLMRuntime)
T5 (内存保护) ────→ 独立
T6 (EventBus) ────→ 独立
```

**关键路径**：T3 → T7（类型统一 → Provider 接口）

**可并行**：
- 阶段 A：T1 和 T2/T3 可并行（developer-1 做 T1，developer-2 做 T2+T3）
- 阶段 B：T4 依赖 T1，T2/T3 无依赖
- 阶段 C：T5/T6/T7 中，T5/T6 独立，T7 依赖 T3

---

## 六、执行时间线

### 阶段 A（并行启动）

- developer-1：T1 AsyncGenerator 修复
- developer-2：T2 错误统一

### 阶段 B（A 完成后）

- developer-1：T4 Session 生命周期（T1 完成后）
- developer-2：T3 类型统一（T2 可与 T3 连续执行）

### 阶段 C（B 进行中可并行启动独立任务）

- developer-1：T5 内存保护（无依赖，可早启动）
- developer-2：T6 EventBus（无依赖，T3 完成后做 T7）

---

## 七、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| AsyncGenerator .return() 实现复杂 | 中 | 参考标准 cleanup 模式，逐步测试 |
| 类型统一导致编译错误 | 中 | 保留 deprecated alias，渐进过渡 |
| Provider LLMRuntime 抽象不足 | 中 | 接口设计参考现有 adapter |
| T4 依赖 T1，T7 依赖 T3 | 低 | 关键路径任务优先，减少等待 |
