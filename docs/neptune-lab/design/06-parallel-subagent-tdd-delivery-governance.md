# Neptune 并行研发执行规约

日期：2026-05-22

状态：实施规约

上游依据：

- `docs/neptune-lab/design/01-product-architecture.md`
- `docs/neptune-lab/design/03-service-api-design.md`
- `docs/neptune-lab/design/05-implementation-roadmap.md`
- `docs/strategy/neptune-agentops-platform-strategy.md`

## 0. 结论

本文不是流程建议，而是 Architecture MVP 的研发执行门禁。Neptune 当前阶段的目标不是继续堆聊天功能，而是把 `Project -> Version -> Run -> Evidence -> Review -> Audit -> Cost` 这条生产事实链补成可被前端、后端和测试稳定消费的产品能力。

执行判断：

1. 所有产品功能优先落在 `neptune-ai/server`、`neptune-ai/web` 和必要的 `shared/types/neptune-ai`。
2. 默认不修改 `neptune-engine`。任何需要修改 runtime 才能完成的产品切片，先视为边界设计错误。
3. 所有研发必须 TDD：先写能失败的测试，再实现，再跑最小验证，再做回归。
4. subagent 可以并行，但必须按文件所有权拆分，不能多个 agent 同时编辑同一文件。
5. 开发阶段允许粗糙，但不允许偏离架构方向：事实链、中文 UI、错误信封、审计/策略/成本责任不能后补成装饰。

## 1. 当前模块地图

### 1.1 已有骨架

| 层 | 已有模块 | 当前价值 |
| --- | --- | --- |
| `shared/types/neptune-ai` | `RunDto`、`RunEventDto`、`ToolInvocationDto`、`ArtifactDto`、`EvidenceArtifactDto`、`PolicyDecisionDto`、`HumanReviewDto`、`AuditEventDto`、`AgentVersionSummaryDto`、`CostSummaryDto`、`Close*Dto`、`ApiErrorEnvelope` | 前后端稳定 DTO 的基础已经存在 |
| `neptune-ai/server` 基础 | auth、tenant、user、agent、skill、thread、billing | 仍是产品入口和旧会话能力基础 |
| `neptune-ai/server` 平台事实 | `RunService`、`RunFactService`、`ArtifactEvidenceService`、`PolicyDecisionService`、`HumanReviewService`、`AuditEventService`、`PlatformCostService`、`AgentVersionService`、`RunAdmissionService` | Controlled Run 事实链的核心骨架 |
| `neptune-ai/server` 方案包 | `ClosingWorkbenchService`、closing routes、finding/review/report API | 中国 ERP 月结关账 MVP 的业务验证入口 |
| `neptune-ai/web` 页面 | 交付/智能体配置、协作调试、治理台、关账工作台、技能/材料管理 | 中文产品入口已开始成形 |
| `neptune-ai/web` 测试 | auth、navigation、chat、SSE recovery、governance、closing、skill-memory governance | 可作为每个前端切片的最小验证入口 |

### 1.2 第一优先级缺口

| 缺口 | 为什么重要 | 默认落点 |
| --- | --- | --- |
| `CustomerProject` / Project API | 设计主链路从客户项目开始，不能长期用 tenant/thread 代替项目上下文 | `shared`、`server`、`web` |
| `RunControl` 正式 API | Run 应成为中心对象，chat 只作为调试入口 | `shared`、`server`、`web` |
| `Run SSE Runtime Event Envelope` | 前端需要消费运行事实流，而不是只消费聊天消息流 | `shared`、`server`、`web` |
| `Evidence Import` / 下载授权 | 证据必须成为可追溯事实，不是 transcript 附件 | `shared`、`server`、`web` |
| `ConnectorRegistry` / ConnectorVersion | 关账和企业集成需要真实数据边界与凭证引用 | `shared`、`server`、`web` |
| `ControlRuleVersion` | 关账规则必须版本化，否则历史报告不可解释 | `shared` 摘要、`server` 内部规则 DSL |
| 页面级聚合 API | 治理台、交付台、关账工作台不应长期在前端拼接过多底层 API | `server`、`web` |
| 统一错误信封 | 用户和治理方必须看见中文原因、错误码、请求编号和恢复入口 | `shared`、`server`、`web` |

## 2. TDD 执行顺序

每个切片必须按下面顺序执行：

1. 写失败测试。
   - Server 切片先写 contract/integration test。
   - Frontend 切片先写 Playwright 或可测试 formatter/API client 单测。
   - Shared DTO 切片先写消费方编译或 contract 断言。
2. 运行测试确认 RED。
   - 失败必须来自目标能力缺失，不是拼写、环境或 fixture 错误。
3. 做最小实现。
   - 只实现当前测试表达的产品行为。
   - 不顺手重构无关文件。
4. 运行最小验证确认 GREEN。
5. 只在 GREEN 后重构。
6. 运行切片回归和边界检查。
7. 自查是否触碰 `neptune-engine`。

禁止：

- 先做页面，再补测试。
- 为了通过测试删除真实断言。
- 用 mock 页面证明产品完成。
- 用 transcript、日志或 trace 替代 `AuditEvent`、`EvidenceArtifact`、`PolicyDecision`。

## 3. 并行 subagent 协作模型

### 3.1 文件所有权

并行前必须给每个 subagent 指定独立所有权：

| subagent 类型 | 推荐文件范围 | 不允许 |
| --- | --- | --- |
| 后端平台事实 worker | `neptune-ai/server/src/services/<domain>.ts`、对应 `routes`、对应 `test` | 同时编辑前端页面 |
| Shared DTO worker | `shared/types/neptune-ai/api/<domain>.ts`、`shared/types/neptune-ai/index.ts` | 改 server runtime 行为 |
| 前端页面 worker | `neptune-ai/web/src/pages/<Page>.tsx`、相关 API client | 改 server schema |
| E2E worker | `neptune-ai/web/tests/<feature>.spec.ts`、必要 helper | 改产品实现绕过失败 |
| 文档 worker | `docs/neptune-lab/design/*.md` | 改代码 |

如果两个 subagent 需要同一文件，不能并行编辑。主 agent 必须拆成顺序任务，或由一个 subagent 拥有该文件。

### 3.2 生命周期

每个 subagent 必须遵守：

```text
spawn_agent -> wait_agent -> consume result -> close_agent
```

`wait_agent` 不是资源清理。完成、废弃或被替代的 subagent 都必须显式关闭。

### 3.3 合并原则

- 主 agent 负责最终集成，不能盲信 subagent 结果。
- subagent 可以提供 patch，但主 agent 必须运行针对性验证。
- subagent 发现的“建议”不等于完成，必须落成测试、代码或文档证据。

## 4. 并行切片队列

这些切片可以作为下一批并行研发队列，但不能无序抢跑。顺序遵守“事实链先于体验层，治理门禁先于业务自动化”。

| 优先级 | 切片 | shared DTO | Server | Web | 验收测试 |
| --- | --- | --- | --- | --- | --- |
| P0 | 统一错误信封 | 已有 `ApiErrorEnvelope` | REST/SSE 均输出稳定信封 | HTTP/SSE 错误展示中文原因和请求编号 | `sse-recovery`、`governance` |
| P0 | ProjectService | 必须 | Project CRUD、归档、租户隔离、审计 | 项目选择和交付台入口 | server contract + navigation |
| P0 | RunControl API | 必须 | `POST /runs`、`GET /runs/:id`、cancel/retry、admission | 运行详情/调试入口 | server run contract + governance |
| P1 | Evidence Import | 必须扩展 | import、hash、schema error、download auth、audit | 证据中心、关账证据绑定 | server import + closing E2E |
| P1 | ConnectorRegistry | 必须 | connector/version/credentialRef/health check | 连接器注册和状态 | server contract + governance |
| P1 | Run SSE Envelope | 必须 | `runId/requestId/sequence/eventType` stream | 运行时间线实时渲染 | SSE contract + Playwright |
| P2 | ControlRuleVersion | 摘要必须，内部 DSL server-local | 规则版本、checklist 绑定、报告 snapshot | 规则配置和报告溯源 | closing contract + E2E |
| P2 | 页面级聚合 API | 可 server-local 起步 | Delivery/Governance/Close app services | 减少页面拼底层 API | 页面 E2E + contract |

## 5. API 与数据模型原则

1. 跨前后端消费的对象必须进入 `shared/types/neptune-ai`。
2. 仅服务内部演进、尚未稳定的规则 DSL、connector provider detail、idempotency internals 可以 server-local。
3. 所有写操作必须有：
   - auth；
   - tenant/resource ownership；
   - role 或能力检查；
   - state guard；
   - policy/quota/admission；
   - audit event；
   - 可测试错误信封。
4. 所有核心读 API 必须支持租户隔离和分页。
5. prompt、credential、MCP auth、secret、完整 connector auth config 不进入 API 响应。

## 6. 前端与中文 UI 门禁

新增或修改用户可见体验时必须满足：

- 导航、标题、按钮、空状态、错误态、权限态中文优先。
- 用户主路径使用 `智能体`，`Agent` 只保留在代码/API/技术括注中。
- `Controlled Run` 的用户表达优先是 `运行记录`、`受控运行`、`运行详情`，不要把 `Conversation` 作为产品中心。
- 治理拒绝必须显示：
  - 中文原因；
  - 请求编号；
  - 可行动入口，例如成本概览、策略决策、审计事件。
- 前端样式遵守 `neptune-ai/DESIGN.md`：
  - 页面背景使用 Parchment；
  - 中性色暖调；
  - 卡片 Ivory；
  - 避免冷蓝灰和纯白页面背景；
  - 标题 Serif 不使用 700+。

## 7. Playwright 与验证门禁

当前主 Playwright 配置是：

```text
neptune-ai/web/playwright.config.ts
baseURL: http://localhost:3004
API:     http://localhost:3000/api/v1
```

常用项目：

| 触达范围 | 必跑项目 |
| --- | --- |
| auth/session | `auth`、`auth-401` |
| navigation/sidebar | `navigation` |
| chat/SSE/error envelope | `sse-recovery`、必要时 `controlled-chat` |
| governance/platform facts | `governance` |
| closing workspace | `closing-workbench` |
| skill/memory governance | `skill-memory-governance` |

测试质量规则：

- 禁止新增 `waitForTimeout()`。
- 优先使用 `waitForResponse()`、`expect.poll()`、可见性断言和 API 断言。
- route mock 只用于错误态、边界态和不可控外部依赖；完成态必须尽量消费真实 server API。
- 测试断言优先断中文产品文案。

## 8. Done Definition

一个切片只有同时满足以下条件，才算完成：

1. 设计方向符合 `docs/neptune-lab/design`。
2. 不触碰 `neptune-engine`，除非用户另行明确批准。
3. 有先失败后通过的测试证据。
4. 前端/后端/shared 契约一致。
5. 中文 UI、错误态、空状态和权限态可验证。
6. 关键动作写入审计或明确说明豁免原因。
7. `git diff --check` 通过。
8. `git diff --name-only | rg '^neptune-engine/' || true` 无输出。
9. 残留风险明确写入最终汇报或后续任务。
