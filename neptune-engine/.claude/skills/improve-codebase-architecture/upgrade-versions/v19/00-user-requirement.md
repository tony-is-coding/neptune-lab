# V19 用户需求

## 需求来源
- OKR 路线图：`docs/okr-roadmap.md` — V7+ 规划
- V18 遗留：`auto-upgrade/v18/04-work-summary.md`
- 架构纲领：`claude-code/ARCHITECTURE.md`
- 架构设计：`docs/architecture-design.md`

## 核心需求

### 1. Provider 运行时接入（V18 延后 #5）
**问题**：7 个 ProviderAdapter 已实现但运行时未调用。AgentEngine 的 LLM 调用链绕过 ProviderAdapter，直接走 CC 内部路径。
**目标**：AgentEngine.query() → ProviderAdapter → CircuitBreaker → executeWithRetry → 实际 API 调用
**优先级**：P1
**风险**：高（涉及核心 LLM 调用路径变更）

### 2. 穿透依赖持续治理（V18 KR5 未达标）
**问题**：engine/ 穿透依赖从 88 条降至 ~62 条，目标 < 10 未达成
**目标**：继续消除 value import 穿透，推进至 < 30 条
**优先级**：P1
**风险**：低（机械性改动）

### 3. 架构治理持续优化
- 文档更新（13 个文档需更新）
- 预存编译错误修复
- Bridge 层 `as any` / `as unknown as` 类型改善
**优先级**：P2

## 参考文档
- `docs/okr-roadmap.md`
- `docs/architecture-design.md`
- `claude-code/ARCHITECTURE.md`
- `auto-upgrade/v18/04-work-summary.md`
