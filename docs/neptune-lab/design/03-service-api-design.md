# Neptune 前后台服务与 API 设计

日期：2026-05-22

状态：设计草案

参考文档：

- `docs/strategy/neptune-agentops-platform-strategy.md`
- `docs/superpowers/specs/2026-05-22-neptune-agentops-product-architecture-design.md`

---

## 0. 结论

Neptune 的服务与 API 设计必须围绕 **Controlled Run 的生产事实链**，而不是围绕聊天会话。前台可以保留对话式输入和流式输出，但服务端契约必须优先证明：谁在什么租户和项目下、用哪个版本、访问了哪些证据、触发了哪些策略、产出什么发现、由谁复核或批准、花费多少成本、留下哪些审计事实。

第一阶段采用一个部署单元内的清晰服务分层，不提前拆微服务：

```text
neptune-ai/web
  -> REST / SSE / typed DTO
neptune-ai/server
  -> 业务应用服务
  -> 方案包服务
  -> 平台内核服务
  -> Engine Adapter
neptune-engine
  -> Runtime Kernel
```

核心设计判断：

1. `平台内核服务` 承载跨行业 AgentOps 生产能力：租户、项目、权限、连接器、智能体版本、运行、证据、策略、复核、审计、成本、评估和发布元数据。
2. `业务应用服务` 承载用户可见工作台体验：交付台、治理台、关账工作台的页面编排、列表查询、状态动作和中文业务文案。
3. `方案包服务` 承载中国 ERP 财务月结关账的行业语义：会计期间、检查清单、控制规则、财务证据、异常发现、复核、关账报告。
4. `Engine Adapter` 是产品层和 runtime 的硬边界：只传通用执行上下文、工具、MCP、policy/artifact hook，不把财务、ERP、关账、凭证等业务概念传入 `neptune-engine`。
5. 所有写操作必须先经过租户、权限、配额、策略和版本前置检查；所有关键结果必须写入 `AuditEvent`，并能被 Run、Evidence、Finding、Review、Report 串回同一条事实链。

---

## 1. 服务总览与关系

### 1.1 服务分层图

```text
┌────────────────────────────────────────────────────────────────────┐
│                         neptune-ai/web                             │
│  交付台 / 治理台 / 关账工作台                                      │
└───────────────────────────────┬────────────────────────────────────┘
                                │ REST / SSE
┌───────────────────────────────▼────────────────────────────────────┐
│                         业务应用服务                               │
│  页面编排、工作台查询、用户动作、中文状态、权限感知的数据裁剪        │
└───────────────────────────────┬────────────────────────────────────┘
                                │ 调用业务对象与平台对象
┌───────────────────────────────▼────────────────────────────────────┐
│                         方案包服务                                 │
│  CloseWorkspace / AccountingPeriod / Checklist / ControlRule        │
│  Evidence / Finding / CloseReview / CloseReport                     │
└───────────────────────────────┬────────────────────────────────────┘
                                │ 映射为通用生产事实
┌───────────────────────────────▼────────────────────────────────────┐
│                         平台内核服务                               │
│  Tenant / Project / AgentRegistry / Connector / Run / Artifact      │
│  Policy / Review / Audit / CostQuota / Eval / Release               │
└───────────────────────────────┬────────────────────────────────────┘
                                │ 只传通用 runtime context
┌───────────────────────────────▼────────────────────────────────────┐
│                         Engine Adapter                             │
│  将 Run plan、工具、MCP、策略钩子、artifact 钩子转换为 engine 调用     │
└───────────────────────────────┬────────────────────────────────────┘
                                │ runtime API / events
┌───────────────────────────────▼────────────────────────────────────┐
│                         neptune-engine                             │
│  LLM / tools / MCP / streaming / trace / artifact generation        │
└────────────────────────────────────────────────────────────────────┘
```

### 1.2 主链路

```text
CustomerProject
  -> CloseWorkspace
  -> AgentTemplateVersion
  -> ConnectorVersion
  -> ControlRuleVersion
  -> Run
  -> RunEvent / ToolInvocation / PolicyDecision
  -> Artifact / EvidenceArtifact
  -> Finding
  -> HumanReview / Approval / Waiver
  -> CloseReadinessReport
  -> AuditEvent
  -> UsageRecord / Cost
```

关键约束：

- 历史 Run 的解释不能被后续配置覆盖。
- 任何 Run 必须绑定具体 Agent、Connector、Rule、Template、Model、Policy 版本或摘要。
- 任何 Evidence 必须有来源、hash、导入人、关联 Run 或业务对象。
- 任何 Review / Approval / Waiver 必须有 actor、reason、decision、时间和关联事实。

---

## 2. 平台内核服务

### 2.1 服务清单

| 服务 | 职责 | 拥有数据 | 暴露 API | 依赖 | 审计事实 |
| --- | --- | --- | --- | --- | --- |
| `TenantService` | 租户识别、租户配置、计费状态、租户级限制 | `Tenant`、`TenantConfig`、`BillingConfig` | 租户详情、租户配置读取 | Identity、CostQuota | 租户配置变更、计费状态变更 |
| `IdentityAccessService` | 用户、角色、项目成员、权限判断 | `User`、`RoleBinding`、`ProjectMember` | 当前用户、成员管理、权限检查 | Tenant、Project | 成员增删、角色变更、拒绝访问 |
| `ProjectService` | 客户项目、环境、业务工作区归属 | `CustomerProject`、`ProjectEnvironment` | 项目 CRUD、项目概览 | Tenant、Identity | 项目创建、归档、成员变更 |
| `AgentRegistryService` | 智能体模板、状态、项目绑定 | `AgentTemplate`、`AgentProjectBinding` | 模板 CRUD、绑定项目、复制版本 | Project、SkillRegistry | 模板创建、启停、项目绑定 |
| `AgentVersionService` | 不可变智能体运行快照 | `AgentTemplateVersion`、`VersionHash` | 版本列表、版本详情、版本 diff | AgentRegistry | 版本创建、版本用于 Run |
| `SkillRegistryService` | 技能版本、依赖、启停、绑定 | `Skill`、`SkillVersion`、`AgentSkillBinding` | 技能 CRUD、绑定智能体 | AgentRegistry | 技能上传、停用、绑定 |
| `ConnectorRegistryService` | Connector、版本、凭证引用、健康检查 | `Connector`、`ConnectorVersion`、`CredentialRef` | 连接器注册、测试、版本查询 | Project、Policy | 连接器注册、测试结果、凭证引用变更 |
| `RunControlService` | Run lifecycle、取消、重试、运行详情 | `Run`、`RunEvent`、`RunInputSnapshot` | 发起 Run、查询 Run、取消 Run、重试 Run | AgentVersion、Policy、CostQuota、EngineAdapter | Run 创建、状态变化、失败原因 |
| `ArtifactEvidenceService` | 通用 artifact 与证据元数据 | `Artifact`、`EvidenceArtifact`、`ArtifactLink` | artifact 查询、证据查询、下载授权 | Run、Project、Policy | artifact 生成、证据导入、下载 |
| `PolicyService` | 工具、MCP、模型、数据出域、路径访问决策 | `PolicyDecision`、`PolicyRule` | 策略决策查询、策略预检 | Tenant、Identity、Connector | allow/deny/review_required 决策 |
| `ReviewService` | 通用人工复核、批准、退回、豁免 | `HumanReview`、`ReviewDecision` | 复核队列、提交决策 | Project、Identity、Audit | 提交复核、批准、退回、豁免 |
| `AuditTrailService` | append-only 审计事件、查询、导出 | `AuditEvent` | 审计列表、详情、导出 | 所有写服务 | 所有关键动作的责任事实 |
| `CostQuotaService` | 用量记录、成本估算、配额和并发硬拦截 | `UsageRecord`、`QuotaState`、`CostSnapshot` | 成本概览、配额预检、用量查询 | Tenant、Run、EngineAdapter | 配额拒绝、成本记录、阈值告警 |
| `ObservabilityService` | requestId/runId/traceId 关联、运行指标 | `TraceLink`、`MetricSample` | 运行观测详情、trace link | Run、EngineAdapter | 观测链路创建、trace 关联 |
| `EvalService` | 评估集、回归结果、验收 gate | `EvalRun`、`EvalCase`、`EvalResult` | 评估运行、结果查询 | AgentVersion、Solution Pack | 评估发起、结果固化 |
| `ReleaseService` | 本地 release 元数据、版本通道、影响报告 | `ReleaseVersion`、`CompatibilityRecord` | 版本查询、影响报告 | AgentVersion、Connector、Solution Pack | release 导入、升级建议、影响确认 |

### 2.2 平台内核边界

平台内核可以知道 `Run`、`EvidenceArtifact`、`PolicyDecision`、`HumanReview`、`AuditEvent`，但不应该知道 `未过账凭证`、`科目余额表`、`关账就绪报告` 的业务规则含义。

平台内核的职责是保证生产事实完整：

- 谁触发；
- 在哪个租户、项目和工作区；
- 使用哪个不可变版本；
- 访问了什么连接器和证据；
- 触发了什么策略；
- engine 返回了什么运行事件；
- 生成了什么 artifact；
- 谁复核或批准；
- 成本和配额如何消耗；
- 审计链是否完整。

---

## 3. 业务应用服务

业务应用服务不拥有核心事实表，而是面向前台页面组织数据、动作和状态。它们可以聚合平台内核与方案包的数据，但不绕过底层服务直接写核心事实。

| 服务 | 面向入口 | 职责 | 拥有数据 | 暴露 API | 依赖 | 审计事实 |
| --- | --- | --- | --- | --- | --- | --- |
| `DeliveryConsoleService` | 交付台 | 客户项目、智能体模板、技能、最近运行、待配置项聚合 | 页面偏好、筛选条件 | 交付概览、项目运行摘要、待处理配置 | Project、AgentRegistry、Run、Skill、Connector | 页面无审计；触发动作由下游服务审计 |
| `RunDebugService` | 交付台 / 运行调试 | 发起试运行、查看流式输出、工具调用、artifact、错误 | 调试输入草稿 | 试运行创建、运行详情聚合 | RunControl、EngineAdapter、Artifact、Audit | 试运行发起、取消、重试 |
| `GovernanceConsoleService` | 治理台 | 运行记录、审计事件、版本、成本、策略决策聚合 | 页面筛选条件 | 治理概览、运行记录列表、审计导出 | Run、Audit、AgentVersion、CostQuota、Policy | 审计导出 |
| `CloseWorkspaceAppService` | 关账工作台 | 期间总览、检查清单、异常、证据、复核、报告页面编排 | 工作台视图偏好 | 关账工作台概览、状态聚合 | Solution Pack、Review、Artifact、Run | 业务动作由 Solution Pack 审计 |

前台 API 命名原则：

- 面向页面的 API 可以用中文业务对象对应的英文资源名，例如 `/close-workspaces`、`/findings`。
- 面向治理事实的 API 使用平台对象名，例如 `/runs`、`/audit-events`、`/policy-decisions`。
- 不提供 `/chat` 作为生产主入口；对话式试运行应挂在 `/runs` 或 `/run-debug` 下。

---

## 4. 方案包服务

第一 Solution Pack 是中国 ERP 财务月结关账。它使用行业语义驱动用户价值，但所有生产事实必须映射回 Platform Core。

| 服务 | 职责 | 拥有数据 | 暴露 API | 依赖 | 审计事实 |
| --- | --- | --- | --- | --- | --- |
| `CloseWorkspaceService` | 某客户、组织、账套、期间的关账工作区 | `CloseWorkspace`、`WorkspaceScope` | 创建工作区、工作区详情、归档 | Project、Identity | 工作区创建、范围变更、归档 |
| `AccountingPeriodService` | 会计期间、账套、检查范围、期间状态 | `AccountingPeriod` | 期间列表、期间详情、锁定/解锁 | CloseWorkspace、Policy | 期间创建、状态变更 |
| `CloseChecklistService` | 检查清单模板实例化与执行状态 | `CloseChecklist`、`ChecklistItem` | 清单查询、状态更新、发起检查 | ControlRule、RunControl | 清单生成、控制项状态变更 |
| `ControlRuleService` | 财务控制规则、严重性、owner、reviewer、approver | `ControlRule`、`ControlRuleVersion` | 规则列表、规则配置、版本查询 | AgentVersion、Policy | 规则创建、规则版本固化 |
| `FinancialEvidenceService` | 财务证据导入、归类、hash、业务索引 | `FinancialEvidence`、`EvidenceSourceSnapshot` | 导入证据、证据列表、证据详情 | ArtifactEvidence、Connector | 证据导入、证据关联、下载 |
| `FindingService` | 异常发现、影响范围、处理状态、证据引用 | `Finding`、`FindingEvidenceLink` | 异常列表、指派、标记处理、提交复核 | Run、Evidence、Review | 异常创建、状态变更、责任人变更 |
| `CloseReviewService` | 财务复核、退回、批准、豁免 | `CloseReview`、`Waiver` | 复核队列、复核提交、豁免批准 | ReviewService、Identity | 复核提交、批准、退回、豁免 |
| `CloseReportService` | 关账就绪报告、证据索引、审计摘要 | `CloseReadinessReport`、`ReportSnapshot` | 生成报告、报告详情、导出 | Run、Finding、Evidence、Audit | 报告生成、导出 |
| `CloseAcceptanceService` | 样例数据、验收用例、规则回归 | `AcceptanceDataset`、`AcceptanceCase` | 验收集查询、验收运行 | Eval、Release | 验收运行、验收结果 |

Solution Pack 不应该直接调用 `neptune-engine`。发起关账检查时，它先生成业务计划和版本快照，再通过 `RunControlService` 创建通用 `Run`，由 `Engine Adapter` 调用 runtime。

---

## 5. Engine Adapter

### 5.1 职责

`EngineAdapter` 是 `neptune-ai/server` 内的 runtime 边界层。它负责把平台 Run 转换为 engine 可执行输入，并把 engine 事件转换回平台事实。

| 方向 | 输入 | 输出 | 说明 |
| --- | --- | --- | --- |
| server -> engine | `RunExecutionContext`、model config、tool descriptors、MCP server refs、policy hook、artifact hook | engine execution handle | 不传财务对象，只传通用上下文和工具 |
| engine -> server | runtime event、tool event、artifact event、usage event、error event | `RunEvent`、`ToolInvocation`、`Artifact`、`UsageRecord`、`AuditEvent` | 产品层负责持久化和审计 |

### 5.2 Adapter 输入契约草案

```json
{
  "runId": "run_123",
  "tenantId": "tenant_123",
  "projectId": "proj_123",
  "requestId": "req_123",
  "agentVersionRef": {
    "agentId": "agent_123",
    "versionId": "agtver_123",
    "versionHash": "sha256:..."
  },
  "model": {
    "provider": "openai-compatible",
    "model": "gpt-5-mini",
    "policyRef": "policy_model_default"
  },
  "tools": [
    {
      "name": "query_erp_snapshot",
      "connectorVersionId": "connver_123",
      "permissionScope": ["evidence:read"]
    }
  ],
  "artifactPolicy": {
    "allowedTypes": ["table", "file", "report", "evidence"],
    "requireHash": true
  },
  "runtimeInput": {
    "instruction": "执行本次检查计划并返回结构化结果。",
    "contextRefs": ["artifact_001", "evidence_001"]
  }
}
```

禁止字段：

- `accountingPeriodName` 等财务专属字段；
- `voucherNumber`、`generalLedgerAccount` 等 ERP 专属字段；
- `closeReadinessReport` 等业务报告对象。

这些内容只能作为产品层 artifact、evidence 或 tool input 的业务 payload 存在，由 server 持有和解释。

---

## 6. REST Endpoint 草案

### 6.1 通用规则

| 规则 | 约定 |
| --- | --- |
| API 前缀 | `/api/v1` |
| 租户来源 | 由 auth session / token 解析，必要时允许 `X-Tenant-Id` 但必须校验用户归属 |
| 幂等键 | 写操作支持 `Idempotency-Key`，Run 创建、证据导入、报告生成必须支持 |
| 请求追踪 | 所有响应返回 `requestId`，SSE 首个事件也必须包含同一 `requestId` |
| 分页 | `?pageSize=50&cursor=...` |
| 时间格式 | ISO 8601 |
| 删除策略 | 默认软删除或归档；审计事实不可删除 |
| 导出 | 导出操作写审计，返回导出任务或一次性下载授权 |

### 6.2 Platform Core Endpoints

| 方法 | Endpoint | 用途 | 前置检查 | 主要审计 |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/me` | 当前用户、租户、角色、可见项目 | auth | 无 |
| `GET` | `/api/v1/projects` | 客户项目列表 | `project:read` | 无 |
| `POST` | `/api/v1/projects` | 创建客户项目 | `project:create`、租户配额 | `project.created` |
| `GET` | `/api/v1/projects/{projectId}` | 项目详情 | `project:read` | 无 |
| `PATCH` | `/api/v1/projects/{projectId}` | 更新项目元数据 | `project:update` | `project.updated` |
| `POST` | `/api/v1/projects/{projectId}/archive` | 归档项目 | `project:archive` | `project.archived` |
| `GET` | `/api/v1/agents` | 智能体模板列表 | `agent:read` | 无 |
| `POST` | `/api/v1/agents` | 创建智能体模板 | `agent:create`、项目权限 | `agent.created` |
| `GET` | `/api/v1/agents/{agentId}` | 智能体模板详情 | `agent:read` | 无 |
| `PATCH` | `/api/v1/agents/{agentId}` | 更新草稿配置 | `agent:update` | `agent.updated` |
| `POST` | `/api/v1/agents/{agentId}/versions` | 固化不可变版本 | `agent:version:create` | `agent.version.created` |
| `GET` | `/api/v1/agents/{agentId}/versions` | 版本列表 | `agent:version:read` | 无 |
| `GET` | `/api/v1/agent-versions/{versionId}` | 版本详情和脱敏摘要 | `agent:version:read` | 无 |
| `GET` | `/api/v1/connectors` | 连接器列表 | `connector:read` | 无 |
| `POST` | `/api/v1/connectors` | 注册连接器 | `connector:create`、凭证策略 | `connector.created` |
| `POST` | `/api/v1/connectors/{connectorId}/test` | 连接器健康检查 | `connector:test`、数据出域策略 | `connector.tested` |
| `GET` | `/api/v1/runs` | 运行记录列表 | `run:read` | 无 |
| `POST` | `/api/v1/runs` | 创建受控运行 | `run:create`、agent version、connector、policy、quota | `run.created` |
| `GET` | `/api/v1/runs/{runId}` | 运行详情 | `run:read` | 无 |
| `POST` | `/api/v1/runs/{runId}/cancel` | 取消运行 | `run:cancel`、状态可取消 | `run.cancel_requested` |
| `POST` | `/api/v1/runs/{runId}/retry` | 复制上下文重试 | `run:create`、quota、版本可用 | `run.retry_created` |
| `GET` | `/api/v1/runs/{runId}/events` | 运行事件列表 | `run:read` | 无 |
| `GET` | `/api/v1/runs/{runId}/tool-invocations` | 工具调用列表 | `run:read` | 无 |
| `GET` | `/api/v1/artifacts` | artifact 列表 | `artifact:read` | 无 |
| `GET` | `/api/v1/artifacts/{artifactId}` | artifact 元数据 | `artifact:read` | 无 |
| `POST` | `/api/v1/artifacts/{artifactId}/download-url` | 下载授权 | `artifact:download`、数据策略 | `artifact.download_granted` |
| `GET` | `/api/v1/evidence-artifacts` | 证据 artifact 列表 | `evidence:read` | 无 |
| `GET` | `/api/v1/policy-decisions` | 策略决策列表 | `policy:read` | 无 |
| `POST` | `/api/v1/policy-decisions/precheck` | 显式策略预检 | `policy:precheck` | `policy.prechecked` |
| `GET` | `/api/v1/reviews` | 通用复核队列 | `review:read` | 无 |
| `POST` | `/api/v1/reviews/{reviewId}/decisions` | 提交复核决策 | `review:decide`、状态可决策 | `review.decided` |
| `GET` | `/api/v1/audit-events` | 审计事件列表 | `audit:read` | 无 |
| `POST` | `/api/v1/audit-events/export` | 导出审计事件 | `audit:export`、导出策略 | `audit.export_requested` |
| `GET` | `/api/v1/cost/summary` | 成本概览 | `cost:read` | 无 |
| `GET` | `/api/v1/quota/status` | 配额状态 | `quota:read` | 无 |

### 6.3 Business App Endpoints

| 方法 | Endpoint | 用途 | 依赖服务 |
| --- | --- | --- | --- |
| `GET` | `/api/v1/delivery/overview` | 交付概览：项目、最近运行、待配置项 | Project、Run、Agent、Connector |
| `GET` | `/api/v1/delivery/projects/{projectId}/summary` | 单项目交付摘要 | Project、Run、Agent、Skill |
| `POST` | `/api/v1/run-debug/runs` | 发起试运行 | RunControl |
| `GET` | `/api/v1/run-debug/runs/{runId}` | 试运行调试详情 | Run、Artifact、ToolInvocation |
| `GET` | `/api/v1/governance/overview` | 治理概览：运行、审计、成本、策略 | Run、Audit、Cost、Policy |
| `GET` | `/api/v1/governance/runs` | 治理台运行记录 | Run、AgentVersion、Cost |
| `GET` | `/api/v1/governance/audit-events` | 治理台审计事件 | Audit |
| `GET` | `/api/v1/governance/policy-decisions` | 治理台策略决策 | Policy |
| `GET` | `/api/v1/governance/cost-summary` | 治理台成本概览 | CostQuota |

### 6.4 Solution Pack Endpoints

| 方法 | Endpoint | 用途 | 前置检查 | 主要审计 |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/close-workspaces` | 关账工作区列表 | `close:workspace:read` | 无 |
| `POST` | `/api/v1/close-workspaces` | 创建关账工作区 | `close:workspace:create`、project 权限 | `close_workspace.created` |
| `GET` | `/api/v1/close-workspaces/{workspaceId}` | 工作区详情 | `close:workspace:read` | 无 |
| `GET` | `/api/v1/close-workspaces/{workspaceId}/overview` | 期间总览聚合 | `close:workspace:read` | 无 |
| `GET` | `/api/v1/close-workspaces/{workspaceId}/periods` | 会计期间列表 | `close:period:read` | 无 |
| `POST` | `/api/v1/close-workspaces/{workspaceId}/periods` | 创建会计期间 | `close:period:create` | `accounting_period.created` |
| `GET` | `/api/v1/accounting-periods/{periodId}` | 会计期间详情 | `close:period:read` | 无 |
| `POST` | `/api/v1/accounting-periods/{periodId}/lock` | 锁定期间范围 | `close:period:lock` | `accounting_period.locked` |
| `GET` | `/api/v1/accounting-periods/{periodId}/checklist` | 检查清单 | `close:checklist:read` | 无 |
| `POST` | `/api/v1/accounting-periods/{periodId}/check-runs` | 发起关账检查 Run | `close:run:create`、rule、connector、evidence、quota | `close_run.created`、`run.created` |
| `GET` | `/api/v1/control-rules` | 控制规则列表 | `close:rule:read` | 无 |
| `POST` | `/api/v1/control-rules` | 创建控制规则 | `close:rule:create` | `control_rule.created` |
| `POST` | `/api/v1/control-rules/{ruleId}/versions` | 固化规则版本 | `close:rule:version:create` | `control_rule.version_created` |
| `POST` | `/api/v1/financial-evidence/imports` | 导入 CSV/Excel/ERP 快照证据 | `evidence:import`、文件策略、配额 | `financial_evidence.imported` |
| `GET` | `/api/v1/financial-evidence` | 财务证据列表 | `evidence:read` | 无 |
| `GET` | `/api/v1/financial-evidence/{evidenceId}` | 财务证据详情 | `evidence:read` | 无 |
| `GET` | `/api/v1/findings` | 异常发现列表 | `finding:read` | 无 |
| `GET` | `/api/v1/findings/{findingId}` | 异常详情 | `finding:read` | 无 |
| `PATCH` | `/api/v1/findings/{findingId}` | 指派、标记处理、补充说明 | `finding:update` | `finding.updated` |
| `POST` | `/api/v1/findings/{findingId}/submit-review` | 提交复核 | `finding:submit_review` | `finding.review_submitted` |
| `GET` | `/api/v1/close-reviews` | 关账复核队列 | `close:review:read` | 无 |
| `POST` | `/api/v1/close-reviews/{reviewId}/approve` | 批准 | `close:review:approve` | `close_review.approved` |
| `POST` | `/api/v1/close-reviews/{reviewId}/reject` | 退回 | `close:review:reject` | `close_review.rejected` |
| `POST` | `/api/v1/close-reviews/{reviewId}/waive` | 豁免 | `close:review:waive`、高风险二次确认 | `close_review.waived` |
| `POST` | `/api/v1/close-reports` | 生成关账就绪报告 | `close:report:create`、所有阻断项状态检查 | `close_report.created` |
| `GET` | `/api/v1/close-reports/{reportId}` | 报告详情 | `close:report:read` | 无 |
| `POST` | `/api/v1/close-reports/{reportId}/export` | 导出报告 | `close:report:export` | `close_report.exported` |

---

## 7. SSE 事件协议

### 7.1 连接

运行流式事件使用 SSE，不把 SSE 设计成聊天专属协议。

```text
GET /api/v1/runs/{runId}/stream
Accept: text/event-stream
```

连接前置检查：

- 用户已认证；
- 用户属于 run 所在租户；
- 用户有 `run:read` 或对应业务权限；
- run 未被租户隔离策略隐藏；
- 如果 run 关联敏感 evidence，用户还必须满足 evidence read policy。

### 7.2 通用事件信封

```json
{
  "eventId": "evt_123",
  "eventType": "run.output.delta",
  "schemaVersion": "2026-05-22",
  "requestId": "req_123",
  "tenantId": "tenant_123",
  "projectId": "proj_123",
  "runId": "run_123",
  "occurredAt": "2026-05-22T10:30:00.000Z",
  "sequence": 42,
  "payload": {},
  "auditRef": "audit_123"
}
```

约束：

- `sequence` 在单个 Run 内单调递增。
- client 断线重连时使用 `Last-Event-ID`，服务端按 `eventId` 或 `sequence` 尽量补发。
- SSE payload 不直接发送未授权证据全文；敏感内容只发送 artifact/evidence 引用。
- 终态事件必须与 REST `Run.status` 一致。

### 7.3 事件类型

| eventType | 触发时机 | payload 关键字段 | 是否持久化为 RunEvent |
| --- | --- | --- | --- |
| `run.started` | Run 进入运行中 | `agentVersionId`、`model`、`startedAt` | 是 |
| `run.plan.created` | 生成执行计划 | `planSummary`、`stepCount` | 是 |
| `run.output.delta` | runtime 输出增量 | `textDelta`、`channel` | 可按策略采样 |
| `run.output.completed` | 输出片段完成 | `messageId`、`contentRef` | 是 |
| `tool.invocation.started` | 工具调用开始 | `toolInvocationId`、`toolName`、`policyDecisionId` | 是 |
| `tool.invocation.completed` | 工具调用成功 | `toolInvocationId`、`durationMs`、`artifactRefs` | 是 |
| `tool.invocation.failed` | 工具调用失败 | `toolInvocationId`、`error` | 是 |
| `artifact.created` | artifact 生成 | `artifactId`、`artifactType`、`hash` | 是 |
| `evidence.linked` | evidence 与 Run/Finding 关联 | `evidenceId`、`sourceType` | 是 |
| `finding.created` | 生成异常发现 | `findingId`、`severity`、`evidenceRefs` | 是 |
| `review.requested` | 需要人工复核 | `reviewId`、`reason`、`assignee` | 是 |
| `policy.decision` | 策略决策发生 | `policyDecisionId`、`decision`、`reason` | 是 |
| `usage.updated` | 用量更新 | `inputTokens`、`outputTokens`、`estimatedCost` | 是 |
| `run.completed` | Run 成功完成 | `completedAt`、`artifactRefs`、`usage` | 是 |
| `run.failed` | Run 失败 | `failedAt`、`error`、`recoverability` | 是 |
| `run.cancelled` | Run 被取消 | `cancelledAt`、`cancelledBy` | 是 |
| `heartbeat` | 保活 | `serverTime` | 否 |

### 7.4 错误事件

```json
{
  "eventType": "run.failed",
  "payload": {
    "error": {
      "code": "POLICY_DENIED",
      "message": "本次运行被策略拒绝。",
      "recoverability": "user_action_required",
      "details": {
        "policyDecisionId": "policy_123"
      }
    }
  }
}
```

SSE 错误必须同时满足：

- 前台可展示中文 `message`；
- 开发者可用 `code`、`requestId`、`policyDecisionId` 定位；
- 审计侧能查到同一 `runId` 的失败事实。

---

## 8. 统一错误信封

REST API 统一返回错误信封。HTTP status 表示协议层结果，`error.code` 表示产品语义。

```json
{
  "success": false,
  "requestId": "req_123",
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "当前租户配额不足，无法发起运行。",
    "recoverability": "user_action_required",
    "details": {
      "quotaType": "monthly_token_budget",
      "current": 982000,
      "limit": 1000000
    }
  }
}
```

成功响应：

```json
{
  "success": true,
  "requestId": "req_123",
  "data": {}
}
```

### 8.1 错误码草案

| HTTP | code | 中文信息原则 | 场景 |
| --- | --- | --- | --- |
| `400` | `VALIDATION_FAILED` | 请求内容不完整或格式不正确。 | DTO 校验失败 |
| `401` | `UNAUTHENTICATED` | 请先登录后再继续操作。 | 未登录 |
| `403` | `FORBIDDEN` | 你没有权限访问该内容。请联系管理员开通权限。 | 权限不足 |
| `403` | `TENANT_ACCESS_DENIED` | 当前账号不能访问该租户的数据。 | 租户隔离 |
| `403` | `POLICY_DENIED` | 本次操作被策略拒绝。 | 工具、模型、路径、出域策略拒绝 |
| `404` | `RESOURCE_NOT_FOUND` | 未找到对应资源，或你没有权限访问。 | 防止枚举资源 |
| `409` | `STATE_CONFLICT` | 当前状态不允许执行该操作。 | 已完成 Run 不能取消 |
| `409` | `VERSION_CONFLICT` | 资源版本已变化，请刷新后重试。 | 乐观锁 |
| `409` | `IDEMPOTENCY_CONFLICT` | 相同幂等键对应的请求内容不一致。 | 幂等冲突 |
| `413` | `PAYLOAD_TOO_LARGE` | 上传内容超过限制。 | 文件或输入过大 |
| `429` | `QUOTA_EXCEEDED` | 当前配额不足，无法继续操作。 | token、存储、并发、导出限制 |
| `429` | `RATE_LIMITED` | 请求过于频繁，请稍后重试。 | 频率限制 |
| `500` | `INTERNAL_ERROR` | 服务暂时不可用。请稍后重试。 | 未分类服务端错误 |
| `502` | `ENGINE_UNAVAILABLE` | 运行内核暂时不可用。请稍后重试。 | engine adapter 调用失败 |
| `502` | `MODEL_PROVIDER_ERROR` | 模型服务返回错误。 | 模型供应商失败 |
| `503` | `CONNECTOR_UNAVAILABLE` | 连接器暂时不可用。 | ERP/CSV/API connector 失败 |

错误处理约束：

- 用户主界面显示中文 `message`，技术详情放入可展开区域。
- `RESOURCE_NOT_FOUND` 不暴露资源是否存在，避免跨租户枚举。
- 所有 `403`、`429`、Run 失败、导出失败都写审计或策略事实。
- `details` 不能包含 prompt、credential、未脱敏证据全文。

---

## 9. 权限、租户、配额前置检查

### 9.1 标准请求上下文

每个 API 进入业务服务前必须形成 `RequestContext`：

```json
{
  "requestId": "req_123",
  "tenantId": "tenant_123",
  "userId": "user_123",
  "roles": ["project_admin"],
  "projectId": "proj_123",
  "ipAddress": "10.0.0.1",
  "userAgent": "browser",
  "idempotencyKey": "idem_123"
}
```

### 9.2 前置检查顺序

| 顺序 | 检查 | 失败错误码 | 是否审计 | 说明 |
| --- | --- | --- | --- | --- |
| 1 | Authentication | `UNAUTHENTICATED` | 否 | 未识别用户不写业务审计 |
| 2 | Tenant resolution | `TENANT_ACCESS_DENIED` | 是 | 用户不属于租户或租户停用 |
| 3 | Resource scope | `RESOURCE_NOT_FOUND` | 可选 | 项目、Run、Evidence 必须属于同一租户 |
| 4 | RBAC / ABAC | `FORBIDDEN` | 是 | 角色、项目成员、资源 owner、业务状态 |
| 5 | State guard | `STATE_CONFLICT` | 是 | 已归档项目、已完成 Run、已锁定期间 |
| 6 | Version guard | `VERSION_CONFLICT` | 是 | 写操作使用 stale version |
| 7 | Policy precheck | `POLICY_DENIED` | 是 | 模型、工具、MCP、路径、数据出域 |
| 8 | Quota precheck | `QUOTA_EXCEEDED` | 是 | token、成本、并发、文件、导出 |
| 9 | Idempotency check | `IDEMPOTENCY_CONFLICT` | 是 | 防止重复 Run、重复导入、重复报告 |
| 10 | Business validation | `VALIDATION_FAILED` | 否或是 | 业务字段、必填 owner/reviewer/approver |

### 9.3 Run 创建前置检查

发起 `POST /api/v1/runs` 或 `POST /api/v1/accounting-periods/{periodId}/check-runs` 时必须检查：

- 用户有项目内 `run:create` 或 `close:run:create`；
- AgentTemplateVersion 存在、不可变、未禁用；
- ConnectorVersion 存在且健康状态允许使用；
- ControlRuleVersion 已固化，不能用草稿规则进入生产 Run；
- 输入 evidence 属于同一租户和项目；
- policy 允许使用目标模型、工具、MCP、数据路径；
- 租户 token / cost / 并发 / 文件数量配额足够；
- accounting period 未关闭，或用户有 override 权限；
- 高风险规则若需要人工确认，先创建 `PolicyDecision(review_required)` 或 `HumanReview`。

### 9.4 审计事实最小字段

```json
{
  "auditEventId": "audit_123",
  "tenantId": "tenant_123",
  "projectId": "proj_123",
  "actorType": "user",
  "actorId": "user_123",
  "action": "run.created",
  "resourceType": "Run",
  "resourceId": "run_123",
  "outcome": "success",
  "requestId": "req_123",
  "runId": "run_123",
  "versionRefs": {
    "agentVersionId": "agtver_123",
    "connectorVersionId": "connver_123",
    "controlRuleVersionId": "rulever_123"
  },
  "occurredAt": "2026-05-22T10:30:00.000Z"
}
```

所有审计事件必须 append-only。业务资源可以归档，审计事实不能被原地修改或删除。

---

## 10. 数据所有权边界

| 数据对象 | 所属服务 | 可写入口 | 只读消费者 | 备注 |
| --- | --- | --- | --- | --- |
| `Tenant` | TenantService | 管理端 / 初始化 | 所有服务 | 第一阶段可以保持轻量 |
| `CustomerProject` | ProjectService | Project API | Business App、Solution Pack | Thread 不再承担项目语义 |
| `AgentTemplate` | AgentRegistryService | Agent API | Run、Delivery | 草稿可变 |
| `AgentTemplateVersion` | AgentVersionService | Version API | Run、Governance、Audit | 不可变 |
| `ConnectorVersion` | ConnectorRegistryService | Connector API | Run、Policy、Solution Pack | 凭证只保存引用 |
| `Run` | RunControlService | Run API | Governance、Solution Pack、Audit | 生产中心对象 |
| `RunEvent` | RunControlService | EngineAdapter | SSE、Governance | 可由 runtime event 映射 |
| `Artifact` | ArtifactEvidenceService | EngineAdapter / import | Run、Report、Evidence | 需要 hash 和 storage ref |
| `EvidenceArtifact` | ArtifactEvidenceService | Evidence import / EngineAdapter | Finding、Report、Audit | 敏感证据受策略保护 |
| `PolicyDecision` | PolicyService | Policy precheck / hook | Governance、Audit | allow/deny/review_required |
| `HumanReview` | ReviewService | Review API | Business App、Audit | 通用复核事实 |
| `CloseWorkspace` | CloseWorkspaceService | Close API | 关账工作台 | Solution Pack 对象 |
| `ControlRuleVersion` | ControlRuleService | Rule version API | Run、Report、Audit | 不可变 |
| `Finding` | FindingService | Run result / Finding API | 关账工作台、Report | 必须关联 evidence |
| `CloseReadinessReport` | CloseReportService | Report API | 关账工作台、Audit | 包含事实快照 |
| `AuditEvent` | AuditTrailService | 各服务 append | Governance、Report | append-only |
| `UsageRecord` | CostQuotaService | EngineAdapter | Governance、Quota | Run 级绑定 |

---

## 11. 第一阶段落地边界

第一阶段必须落地：

- `ProjectService`、`RunControlService`、`ArtifactEvidenceService`、`PolicyService`、`AuditTrailService`、`CostQuotaService` 的最小 API 契约；
- `CloseWorkspaceService`、`AccountingPeriodService`、`CloseChecklistService`、`FindingService`、`CloseReviewService`、`CloseReportService` 的主路径；
- Run SSE 协议从 chat stream 升级为 runtime event stream；
- 统一错误信封；
- Run 创建、证据导入、复核决策、报告导出的权限/租户/配额前置检查；
- 所有关键动作写入审计事实。

第一阶段明确不做：

- 不拆独立微服务；
- 不建设 Neptune Cloud Control Plane；
- 不做完整 marketplace；
- 不做自动回写 ERP；
- 不做自动过账；
- 不做自动批准豁免；
- 不把财务语义写入 `neptune-engine`；
- 不为前台继续扩张聊天中心 API。

---

## 12. 自检清单

后续实现或评审本设计时，必须逐项回答：

| 问题 | 合格标准 |
| --- | --- |
| 是否以 `Run` 为生产中心对象？ | 任何业务执行都能追溯到 `Run` |
| 是否保留版本事实？ | Agent、Connector、Rule、Report Template 均有版本或摘要 |
| 是否把财务语义限制在 Solution Pack？ | `neptune-engine` 不出现关账、凭证、科目等概念 |
| 是否有权限/租户/配额前置检查？ | 写操作前必须经过标准检查链 |
| 是否有审计事实？ | 关键动作 append-only，能按 requestId/runId 查询 |
| SSE 是否脱离 chat 语义？ | 事件表达 runtime facts，不以 message 为唯一对象 |
| 错误是否可展示也可排障？ | 中文 message + stable code + requestId |
| 前台是否能直接使用？ | API 按交付台、治理台、关账工作台组织聚合查询 |
