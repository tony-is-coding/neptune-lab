  # Neptune AgentOps 阶段一收尾报告

**日期**：2026-05-27
**状态**：阶段一上层（`neptune-ai/`）工作收尾，准备与 engine 团队（`9536` worktree）合并对接
**目标读者**：engine 解耦团队（用于上下层对接）、产品负责人（用于阶段验收）

---

## 1. 结论先行

**阶段一定位**：把已存在的运行、审计、智能体版本暴露为稳定平台事实契约，并补齐治理事实链。

**已交付的核心能力**：
- 平台事实链 7 类对象（Run / RunEvent / ToolInvocation / Artifact / EvidenceArtifact / PolicyDecision / AuditEvent）schema 与 API 完整
- 治理台、关账工作台、交付台三大主入口可用
- 配额硬拦截 + Run 级成本归因 + 错误信封统一 + SSE 实时事件流
- e2e 49/49 全绿，server 318/318 全绿

**剩余技术债**：
- ControlledEngine 仍是关账主路径的运行时（WAVE C 待做：把 syntheticRun 替换为真实 dispatch）
- 与 engine 公开 API 的协议层撞墙 1 项（AskUserQuestion 回写，已立 contract 文档）
- 若干前端硬编码 / mock 数据（CloseWorkbench 演示工作区、Home solutionPack 常量等）

**对接 engine 的关键文档**：[`docs/governance/engine-contract.md`](../governance/engine-contract.md) — 上层对 engine 公开 API 的依赖与诉求清单。

---

## 2. 阶段一已完成项（按 PR 时序）

| PR | 主题 | 类型 |
| --- | --- | --- |
| #15 | codex engine decoupling sync | 同步 |
| #16 | 平台事实 schema + 服务骨架 + 关账工作台前端 + 中文化 | feat |
| #17 | 阶段一 Architecture MVP 结项文档（technical-architecture / product-overview） | docs |
| #18 | PolicyDecision 治理决策事实链 [P0-A] | feat(governance) |
| #19 | 全套 Playwright e2e 端到端 49/49 绿 [P0-B] | test |
| #20 | 创建智能体页诚实化 + 中文化 [P0-1] | refactor(web) |
| #21 | AskUserQuestion 降级为只读预览 + engine 协议契约文档 [P0-2] | refactor(web,docs) |
| #22 | 清理 5 项已废弃死代码 [P1-3 wave 1] | refactor(server,web) |
| #23 | knowledge-service 删除 + Skill API 去重 [P1-3 wave 2] | refactor(server,web) |
| #24 | Run 级成本归因 [P1-2] | feat(server) |
| #25 | ControlledEngine 关账受控检查场景 [P1-1 WAVE B] | feat(server) |

净代码删除约 1900 行（死代码）+ 净新增约 700 行（治理事实 / 成本归因 / closing scenario）。

---

## 3. 业务层基础报错（事实采集 2026-05-27）

### 3.1 测试通过率（功能层 — 全绿）

- `neptune-ai/server`：**318/318 pass**, 1139 expect calls
- `neptune-ai/web` Playwright e2e：**49/49 pass**, 14 个 project（auth/governance/closing/sse-recovery/...）
- `neptune-ai/server/test/controlled-engine-closing.test.ts`：11/11 pass（WAVE B 新增）

### 3.2 TypeScript 编译错误（baseline）

`neptune-ai/server` `bunx tsc --noEmit` 仍有以下 baseline 错误，**全部归属 9536 团队 engine 解耦中产生**：

| 错误 | 文件 | 归属 |
| --- | --- | --- |
| `@neptune/engine` 未导出 `LogUtil / MDC / LogLevel` | `src/utils/logger.ts:15-16` | engine |
| `@neptune/engine` 未导出 `NoOpTracingProvider / NoOpMetricsProvider / ITracingProvider / IMetricsProvider` | `src/services/observability/index.ts:11-12` | engine |
| `@neptune/engine` 未导出 `ITracingProvider / SpanStatus / Span` | `src/services/observability/langfuse-tracing-provider.ts:19-20` | engine |
| `@neptune/engine` 未导出 `createHeadlessCCRuntime` | `src/services/engine-factory.ts:13` | engine |
| `engine-factory.ts:134` 参数数量不匹配 | `src/services/engine-factory.ts:134` | engine |
| `OriginalQueryEngineBridge.ts:354` 参数隐式 any | `neptune-engine/src/engine/bridge/OriginalQueryEngineBridge.ts:354` | engine |

`neptune-ai/server` 仍存在的本仓 baseline 错误（**非 engine 归属，但在阶段一前已存在**）：

| 错误 | 文件 | 修复优先级 |
| --- | --- | --- |
| `routes/agents.ts:402` `formData` 不存在于 `FastifyRequest` | `src/routes/agents.ts:402` | 中 — 文件上传路径不可用，需补 `@fastify/multipart` 注册 |
| `services/plan/PlanManager.ts:355` `PlanStatus` 不能赋给 `'completed' \| 'failed'` | `src/services/plan/PlanManager.ts:355` | 低 — 类型收窄不一致，运行时无影响 |
| `services/skill.ts:278` Skill[] 不兼容（promptConfig 缺失） | `src/services/skill.ts:278` | 低 — 字段映射遗漏 |

**修复计划**：
- engine 归属错误：等 9536 团队完成 engine 解耦后自然消失，不在 a928 修复
- 本仓 3 项 baseline：建议另起 PR 集中处理（30-60min），不阻塞 engine 对接

`neptune-ai/web` `bunx tsc --noEmit`：**0 错**。

### 3.3 启动日志 warning（运行时）

无关键 warning。`prompt-assembler` 的 `Step not found for plan` 是 PlanManager 边界情况测试的预期 warn，不影响功能。

---

## 4. 待办事项（按价值密度排序）

### 🥇 Top 1 — 关账主路径全链路真实化（P1-1，剩 WAVE C + WAVE A）

**当前事实**：
- WAVE B 已落地（PR #25）：ControlledEngine 已支持 `[closing-check]` prompt 触发关账规则检查 SSE 流
- WAVE C 未做：`closing-workbench.generateChecks()` 仍走 `ensureSyntheticRun + 硬编码 finding`
- WAVE A 未做：`CloseWorkbench.tsx` 创建工作区按钮硬编码 "华东共享中心 2026-04 月结"，`mockDataset` 写死为 `general-ledger-basic`

**为何最高价值**：路线图 §11 把关账工作台定义为"用财务场景验证平台内核"的唯一手段。当前主路径 e2e 通过仅因为关账后端用 syntheticRun 凭空写 run/finding/evidence —— 是产品最大的欺骗。

**实施清单**（4-5h）：
- WAVE C：`generateChecks()` 调 `thread-manager.dispatch(buildClosingCheckPrompt(...))`，监听 SSE 流写 Finding/Evidence/Run；删除 `ensureSyntheticRun + createClosingAgent + createClosingSession + 硬编码 finding`
- WAVE A：CloseWorkbench 创建工作区表单接通用户输入；mockDataset 选择器暴露给用户

**依赖**：不依赖 9536（WAVE B 已落地，纯上层工作）

### 🥈 Top 2 — HumanReview decision 联动 Run / 关账状态（约 4-6h）

**当前事实**：`platform-facts.ts:427-473` HumanReview 决策只更新 review 行，**不影响 runs.status**，无 service 把 review 用作 dispatch 阻塞/恢复条件。

**为何重要**：Review approve/reject/waive 应该决定 Run 是否能继续 / 关账期间能否进入下一状态。当前完全断开 = 治理形同虚设。

**实施**：在 `humanReviewService.decide()` 后联动 Run 状态机；关账场景下 review 决策决定 period 状态迁移。

### 🥉 Top 3 — Memory documents 真实注入 LLM context（约 3-5h）

**当前事实**：用户上传 `category='memory'` 的 documents 在 server 全无消费者；`thread-manager.fetchAgentDocuments` 只查 `category='knowledge'`。

**短期方案**：把 memory 类型也加入 fetchAgentDocuments 注入；用 prompt block 区分两者。

**长期方案**：路线图 §11 要求 MemoryRecord 独立表（来源/过期/审计），这是更大工程（1-2 day），不在阶段一范围。

### 🟦 P2（次要）

| 项 | 复杂度 | 备注 |
| --- | --- | --- |
| Run cancel 不可中断 + complete 覆盖 cancelled | 2-3h | `run.ts:248-271` 没 abort 通道；`run.ts:198-211` complete() 不校验 status |
| CloseWorkbench 前端硬编码 payload | 与 WAVE A 合做 | 已在 Top 1 清单 |
| `routes/agents.ts:formData`、`PlanManager.ts:355`、`skill.ts:278` baseline 编译错误 | 30-60min | 集中一波处理 |
| Login / Collaborate / EmptyCollaborateView 中文化收尾 | 4-6h | 违反 AGENTS.md 中文优先 |
| Object storage 接入 Artifact（替换 `memory://` URI） | 1-2 day | 文档承诺"对象存储 + DB 元数据"，目前文件本体在内存 |

---

## 5. 与 9536 engine 团队对接锚

### 5.1 上层依赖的 engine 公开 API（已稳定，不希望破坏）

详见 [`docs/governance/engine-contract.md`](../governance/engine-contract.md) §2。摘要：

- `AgentEngine.create(config, runtime)` / `engine.createSession({workspace})` / `engine.query(sessionId, input, options)`
- `engine.on('query:complete', payload)` 监听 token usage
- `extensions.permissions.delegate: PermissionDelegate` 注入权限
- `extensions.skills: SkillExtension[]` 注入技能
- `memoryRoot: string` 隔离

### 5.2 上层撞墙的 engine 接口诉求

详见 [`docs/governance/engine-contract.md`](../governance/engine-contract.md) §3。优先级：

| 紧迫度 | 诉求 | 影响 |
| --- | --- | --- |
| **高** | AskUserQuestion 异步回写（3 个候选方案） | 当前用户答案被 server 吞，前端已降级为预览 UI |
| 中 | ToolInvocation 标准化事件 | 当前用 SSE 事件流推断 |
| 低 | Token 使用预估钩子 | per-call quota 拦截无法做 |

### 5.3 engine 解耦带来的 baseline 编译错误

§3.2 列出的 9 个 `@neptune/engine` 未导出错误，**等 9536 解耦完成后自然消失**。a928 不修。

### 5.4 合并对接前 a928 不会动的边界

- `neptune-engine/` 任何文件
- `neptune-engine-product/` 任何文件
- `9536` worktree 的工作

---

## 6. 阶段一指标

| 指标 | 数字 |
| --- | --- |
| 已合 PR | 11 个（#15 – #25） |
| server 测试 | 318/318 pass（1139 expect calls） |
| web e2e 测试 | 49/49 pass（14 个 project） |
| 净代码增量 | +700（feat） / -1900（清理） |
| 治理文档 | 4 份（api-error-envelope / run-event-stream / policy-decision / engine-contract） |
| 设计文档 | 7 份（01-product-architecture 至 06-parallel-subagent / + 母版） |
| **不修改 neptune-engine** 边界 | ✅ 全程零侵入 |

---

## 7. 阶段二启动建议

**第一步**：a928 与 9536 worktree 在 develop 上同步，跑完整集成测试，确认上下层契约对齐。

**第二步**：恢复 P1-1 WAVE C + WAVE A，让关账主路径真实化（无依赖 9536 落地，同步进行）。

**第三步**：跟进 9536 团队对 [`engine-contract.md §3.1`](../governance/engine-contract.md) AskUserQuestion 回写接口的实现进度，落地后接通前端。

**第四步**：解决 §3.3 本仓 baseline 编译错误 + Top 2 HumanReview 联动 + Top 3 Memory 注入。
