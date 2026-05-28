# Agent Loop Rebuild — 总规划

> **从 IOU → 修复"独立 Agent Runtime Kernel"目标的完整工程计划**
> **作者**：claude-opus-4.7（接手 codex 9536 worktree）
> **日期**：2026-05-23
> **HEAD**：`0ce17cf docs(strategy): Engine Substrate Debt`

---

## 0. 上下文（从 IOU 到此处）

诊断报告 [`engine-substrate-debt.md`](../engine-substrate-debt.md) 已落地、用户已审。结论：

- 2026-05-22 两个剥离 commit（`52e5fb1` + `a9a894e`）把 engine 的 agent loop 删干净了
- 当前 `HeadlessQueryEngine` 只能跑"无工具单轮纯文本对话"，是 demo 不是 substrate
- Phase A 的 5 个 protocol + Phase B 的 11 个 kernel tools 单测都过，但端到端跑不通
- 用户拍板**走选项 A**：在 engine 里重新长出最小干净 agent loop，目标是"独立可分发的 Agent Runtime Kernel"，用户称为 substrate

## 1. 终极目标（必须时刻对齐）

`neptune-engine` 长成一个**可独立分发的 Agent Runtime Kernel**：

- 任何团队拿走这个包，能用它跑严肃的 agent 工作流
- 不需要 Claude Code 那一堆 product 代码
- engine 是 substrate（暴露错误，不代偿，给模型多次犯错的机会）
- product 只管业务体验（UI / 登录 / 远控 / Notebook 等）

类比：engine 之于 agent 应用 = Linux 内核之于发行版。

## 2. 第一性原理（每个 batch 都要回到这里）

1. **暴露错误，不代偿**：tool 抛错 → 包成 `tool_result is_error: true` 发回模型；API 抛错 → 上抛到上层决策。Engine 不替模型重试 prompt、不替模型决定如何挽救。
2. **给契约，不内置策略**：retry / compaction / budget / circuit breaker，engine 都给抽象 + 默认实现，product 可以替换 policy。
3. **per-session 隔离**：所有运行时状态都在 SessionContext 里，不再走全局变量。
4. **失败要响**：boundary check / oracle 对照 / 集成测试，全部 fail-loud，不静默 fallback。
5. **不抄业务**：langfuse / analytics / growthbook / queryTracking / advisor model / connector_text / `tengu_*` 埋点 / `USER_TYPE='ant'` 内部分支，全部不搬。

## 3. 方法论：有参考重写 + cc 做 oracle + 三层 milestone

### 3.1 有参考重写

- ❌ 不照搬 product 的 5269 行（噪音 + 业务粘连）
- ❌ 不凭空重写（会丢 corner case，比如 thinking signature 保留）
- ✅ 三步循环：① 读 cc 对应函数找算法 ② 写"算法纲要"（在 X 情况下做 Y 的规则）③ 重写最小干净版

### 3.2 cc 做 oracle

把 cc 的对应函数当 **真值机**：

- 同一段 SSE fixture 流，engine 实现和 cc 实现各跑一次，对比输出
- 同一组 message + tool_result，engine 序列化和 cc 序列化各跑一次，对比 byte 级别一致
- 同一组错误（429 / 529 / network），engine 错误分类和 cc 错误分类各跑一次，对比分支决策
- 详见 [`03-oracle-verification.md`](./03-oracle-verification.md)

### 3.3 三层 milestone

| 里程碑 | 包含 | 完成定义 |
|---|---|---|
| **M1 骨架层** | Batch 7-11 | 端到端 happy path 跑通；Phase B kernel tools 至少 3 个能跑 |
| **M2 鲁棒层** | Batch 12-13 | 能扛 429/network blip / 流卡死 |
| **M3 效率层** | Batch 14-16 | 能跑长会话不撞 200k 上限、不烧钱 |

每一层都是可独立交付的 substrate 状态。

## 4. Batch 总览（10 批，每批 20-30 文件 + 闭环验证 + commit + ff 进 develop）

| Batch | 主题 | 体量 | 里程碑 |
|---|---|---|---|
| 7 | SSE 解析 + content_block 累积器 | ~500 行 + 测试 | M1 |
| 8 | MessageSerializer + Provider SDK 接入 | ~400 行 | M1 |
| 9 | ToolDispatcher 串行 + ToolUseContext 构造 | ~350 行 | M1 |
| 10 | AgentLoop multi-turn while + stop_reason | ~300 行 | M1 |
| 11 | UsageTracker + HookSurface + Cancellation | ~300 行 | M1 |
| 12 | withRetry + 错误分类 + non-streaming fallback + fallbackModel | ~450 行 | M2 |
| 13 | streamWatchdog + stallDetection | ~250 行 | M2 |
| 14 | prompt caching API + 默认 cache breakpoint policy | ~300 行 | M3 |
| 15 | CompactionPolicy 接口 + 默认 microcompact 实现 | ~400 行 | M3 |
| 16 | BudgetTracker + CircuitBreaker 抽象 | ~350 行 | M3 |

详见 [`02-tasks.md`](./02-tasks.md)。

## 5. 工作纪律

每个 batch 收尾都要满足：

```bash
# 验证三件套
bash neptune-engine/scripts/verify-runtime-boundaries.sh    # boundary 0 反向依赖
cd neptune-engine && bunx tsc --noEmit --pretty false       # engine kernel 0 错
cd neptune-engine && bun test src/engine                    # 不回归现有测试

# 端到端 demo（M1 完成后才有）
cd neptune-engine && bun test src/engine/agent-loop/__tests__/e2e

# Oracle 对照（每个 batch 都要做）
cd neptune-engine && bun test src/engine/agent-loop/__tests__/oracle
```

每个 batch commit 后用 `git -C /Users/terrence_tan/startups/neptune-lab merge --ff-only codex/engine-decoupling-cleanup` ff 进 develop。

## 6. 失败回滚机制

每个 batch 都有独立 commit，发现根本性错误时直接 `git revert` 该 batch。**不允许在 batch 内部"小步快跑"凑数 commit**（会让回滚困难）。

## 7. 风险与对策

| 风险 | 对策 |
|---|---|
| Anthropic SDK 升级破坏类型 | engine 内部用自己的 SSE 类型，不直接暴露 SDK 类型 |
| 新 SSE 事件（thinking 2.0）没覆盖 | 所有未识别事件 fail-loud + log，给上层 hook 注入 |
| 实现和 cc 行为不一致（subtle bug） | oracle 对照机制（详见 03） |
| Phase B kernel tools 接口契约变化 | Phase B 测试都跑通 = 契约不变；变化时立即更新 Phase B |
| 工作量超预期（>4 周） | 每完成一个 milestone 重评估；可暂停在 M2 / M3 |

## 8. 不在本计划内（明确拒绝清单）

- ❌ 不抄 langfuse / analytics / growthbook / `tengu_*` 埋点
- ❌ 不抄 VCR (`withStreamingVCR`)
- ❌ 不抄 advisor model（subagent 业务模型）
- ❌ 不抄 connector_text / `USER_TYPE='ant'` 内部分支
- ❌ 不抄 `headlessProfilerCheckpoint` / `queryCheckpoint` 业务追踪
- ❌ 不抄 LSP defer
- ❌ 不抄 `getMessagesAfterCompactBoundary` 等业务方法
- ❌ 不动 product 层（product 编不过不修）
- ❌ 不引入新的全局变量
- ❌ 不引入循环依赖

## 9. 文档清单

| 文档 | 内容 |
|---|---|
| [`00-plan.md`](./00-plan.md) | 本文档：总规划 |
| [`01-design.md`](./01-design.md) | 整体设计：模块结构、接口、数据流 |
| [`02-tasks.md`](./02-tasks.md) | Batch 7-16 任务清单（每 batch 文件级粒度） |
| [`03-oracle-verification.md`](./03-oracle-verification.md) | oracle 验证机制 |
| [`engine-substrate-debt.md`](../engine-substrate-debt.md) | 上一份 IOU（事实链 + 缺失清单） |
