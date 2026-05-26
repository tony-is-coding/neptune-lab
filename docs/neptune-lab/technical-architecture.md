# Neptune AgentOps 技术架构说明

**版本**：v1.0（阶段一 Architecture MVP 结项）
**最后更新**：2026-05-23
**对应 commit**：`origin/develop = 59eb9f1`
**目标读者**：架构师、后端、前端、平台工程、SRE
**配套文档**：
- 设计基线：`docs/neptune-lab/design/`
- 错误信封规范：`docs/governance/api-error-envelope.md`
- SSE 协议规范：`docs/governance/run-event-stream.md`
- 战略锚点：`docs/strategy/neptune-agentops-platform-strategy.md`

---

## 0. 一句话结论

Neptune 是把"不确定的 LLM 行为"包进可治理、可交付、可审计、可升级的**企业受控委托平台**。技术上分四层：

```
┌─────────────────────────────────────────────────────────────┐
│         neptune-ai/web   (中文产品 UI / React+Vite)         │
├─────────────────────────────────────────────────────────────┤
│         neptune-ai/server  (产品编排 + 平台事实链 + 方案包)  │
├─────────────────────────────────────────────────────────────┤
│         shared/types/neptune-ai  (跨层协议契约 / TypeScript) │
├─────────────────────────────────────────────────────────────┤
│         neptune-engine     (Agent Runtime Kernel / 不动)     │
└─────────────────────────────────────────────────────────────┘
```

阶段一已经把 **Controlled Run 事实链** 钉成代码：22 张表、30 个服务、66 个 REST 端点、1 个 SSE 流、340 个合同测试。`neptune-engine` 在阶段一**零修改**。

---

## 1. 仓库结构与运行时

### 1.1 物理拓扑

```
neptune-lab/                            (Bun monorepo)
├── shared/                             跨层协议层（最高优先级稳定面）
│   ├── types/neptune-ai/api/           (DTO + 错误码 + 事件枚举)
│   └── types/neptune-ai/chat/          (聊天 SSE 事件)
│
├── neptune-ai/                         产品平台层
│   ├── server/                         Fastify 5 + Drizzle ORM + PostgreSQL
│   │   ├── src/db/                     schema + migrations
│   │   ├── src/services/               业务/事实链/方案包服务
│   │   ├── src/routes/                 REST + SSE 路由
│   │   ├── src/middleware/             auth + tenant context
│   │   ├── src/utils/                  api-error / logger
│   │   └── test/                       契约测试 + 集成测试
│   │
│   └── web/                            Vite + React + Tailwind + Zustand
│       ├── src/api/                    REST/SSE 客户端
│       ├── src/hooks/                  自定义 hooks
│       ├── src/pages/                  9 个页面（中文）
│       └── tests/                      Playwright e2e
│
├── neptune-engine/                     Agent Runtime Kernel
│   └── (阶段一保持不动；codex/9536 推进解耦)
│
├── neptune-engine-product/             Engine 产品层（当前承接 builtin tools 等）
│
└── docs/                               所有文档
    ├── strategy/                       战略基线
    ├── neptune-lab/design/             设计文档（决策）
    ├── neptune-lab/architecture.md     本文件
    ├── neptune-lab/product.md          产品说明
    ├── governance/                     治理规范（API/SSE/Git）
    └── adr/                            架构决策记录
```

### 1.2 进程模型（当前 MVP）

```
                   浏览器 (web 客户端)
                          │
                          │ HTTP/REST + SSE (Last-Event-ID)
                          ▼
       ┌───────────────────────────────────┐
       │   Fastify 进程 (单实例)           │
       │   :3000  /api/v1/*                │
       │                                   │
       │   ├─ onRequest → requestId 注入   │
       │   ├─ authenticate (JWT)            │
       │   ├─ setErrorHandler  全局兜底    │
       │   ├─ setNotFoundHandler  全局兜底 │
       │   │                               │
       │   ├─ services/                     │
       │   │   ├─ run / run-facts / ...    │
       │   │   ├─ run-event-bus (内存)     │
       │   │   ├─ closing-workbench        │
       │   │   └─ ...                       │
       │   │                               │
       │   └─ engine adapter ─────────┐    │
       └─────────────────────────────│─────┘
                                     │
                                     ▼
                ┌─────────────────────────────────┐
                │  neptune-engine (嵌入式)         │
                │  Runtime Kernel：               │
                │  模型调用 + 工具执行 + MCP +     │
                │  streaming + trace               │
                └─────────────────────────────────┘
                                     │
                                     ▼
                              Provider APIs
                              (Anthropic / OpenAI / ...)


       ┌──────────┐    ┌────────┐    ┌────────────────┐
       │PostgreSQL│    │ Redis  │    │ FS / Workspace │
       │ (事实链  │    │(配额  │    │ (artifact 内容 │
       │  全部表) │    │ 计数) │    │  + thread 工作 │
       └──────────┘    └────────┘    │  目录)         │
                                     └────────────────┘
                                              │
                                              ▼
                                    Langfuse (可选 trace)
```

**关键事实**：

- 单进程，单实例；run-event-bus 是 in-process Node EventEmitter
- 多实例水平扩展前提：替换 `run-event-bus.ts` 为 Postgres LISTEN/NOTIFY 或 Redis pub/sub（接口已抽象）
- Redis 仅做配额计数器和短期状态，**不做事实存储**
- 文件系统承载 artifact 内容；DB 只存元数据（`storageUri` + `sha256`）
- Langfuse 是可选 trace provider；NoOp 在未配置时自动启用

---

## 2. 四个平面（Conceptual Planes）

战略文档第 §3.1 定义了 4 个平面，落到代码里如下：

### 2.1 控制平面（Control Plane）

定义运行的边界。

| 对象 | 物理位置 | 作用 |
|---|---|---|
| Tenant | `tenants` 表 + `tenant.ts` | 租户隔离与配额 |
| User + Role | `users` 表 + `auth.ts` | 身份与权限主体 |
| CustomerProject | `customer_projects` 表 + `project.ts` | 业务交付归属 |
| AgentTemplate | `agent_templates` 表 + `agent-template.ts` | Agent 配置 |
| AgentTemplateVersion | `agent_template_versions` 表 + `agent-version.ts` | 不可变运行快照 |
| Skill | `skills` + `agent_skills` 表 + `skill.ts` | 能力资产 |

### 2.2 数据平面（Data Plane）

执行真实工作。

| 对象 | 物理位置 | 作用 |
|---|---|---|
| Run | `runs` 表 + `run.ts` | 一次受控执行的中心对象 |
| RunEvent | `run_events` 表 + `run-facts.ts` | 运行事件流（append-only）|
| ToolInvocation | `tool_invocations` 表 + `run-facts.ts` | 工具调用摘要 |
| Thread (Session) | `sessions` 表 + `thread-manager.ts` | 调试入口（chat） |

### 2.3 事实平面（Fact Plane）

持久化业务事实。

| 对象 | 物理位置 | 作用 |
|---|---|---|
| Artifact | `artifacts` 表 + `artifact-evidence.ts` | 成果文件元数据 |
| EvidenceArtifact | `evidence_artifacts` 表 + 同上 | 受审计的证据子类型 |
| Finding | `findings` 表 + `closing-workbench.ts` | 异常发现（业务对象）|
| HumanReview | `human_reviews` 表 + `human-review.ts` | 复核责任事实 |
| AuditEvent | `audit_events` 表 + `audit.ts` | append-only 审计 |
| BillingRecord / Run cost | `billing_records` + `cost.ts` + `platform-cost.ts` | 成本事实 |

### 2.4 治理平面（Governance Plane）

在数据/事实上做决策与展示。

| 对象 | 物理位置 | 作用 |
|---|---|---|
| PolicyDecision | `policy_decisions` 表 + `policy-decision.ts` | 工具/MCP/路径/模型/配额决策记录 |
| RunAdmission | `run-admission.ts` | 运行前配额硬门禁（已对接 PolicyDecision + AuditEvent） |
| RunObservability | `run-observability.ts` | 治理台运行详情聚合 |
| 治理台 UI | `pages/Governance.tsx` | 6 tab：运行/审计/版本/策略/复核/成本 |

---

## 3. 数据库 Schema 全景

22 张表，11 个 migrations（0000-0010）。基础 8 张 + 平台事实链 9 张 + 关账方案包 5 张。

```
                    ┌─────────────┐
                    │   tenants   │ (8 张基础表)
                    └──────┬──────┘
            ┌───────────┐  │  ┌────────────────────┐
            │   users   │──┼──│  customer_projects │
            └───────────┘  │  └────────────────────┘
                           │
                    ┌──────┴──────┐
                    │ agent_      │
                    │ templates   │
                    └──────┬──────┘
                           │ 1:n
                           ▼
              ┌────────────────────────┐
              │ agent_template_versions│  ← 不可变快照 + sha256 hash
              └────────────────────────┘

         ┌──────────┐                 ┌────────┐
         │ sessions │ ←──── thread ───┤  runs  │ ── 平台事实链中心
         └──────────┘                 └───┬────┘
                                          │
              ┌─────────────────┬─────────┼──────────────┬──────────┐
              ▼                 ▼         ▼              ▼          ▼
      ┌─────────────┐  ┌──────────────┐  artifacts   audit_events  │
      │ run_events  │  │ tool_        │   │              │         │
      │ (append-    │  │ invocations  │   ▼              │         │
      │  only)      │  └──────────────┘  evidence_       │         │
      └─────────────┘                    artifacts       │         │
                                           (sha256)       │         │
                                                          │         │
                              ┌──────────────────┐        │         │
                              │ policy_decisions │────────┘         │
                              │ (allow/deny/     │                  │
                              │  review_required)│                  │
                              └──────────────────┘                  │
                                                                    │
                              ┌──────────────────┐                  │
                              │  human_reviews   │──────────────────┘
                              │ (pending/approved│
                              │  /rejected/      │
                              │  waived)         │
                              └──────────────────┘

         关账 Solution Pack（独立但接事实链）：
         close_workspaces ─┬─ accounting_periods ─┬─ checklist_items
                           │                       └─ findings ──→ human_reviews
                           └───────────────────────── close_reports（snapshot+hash）
```

### 3.1 核心表关键约束

| 表 | 关键约束 | 治理意义 |
|---|---|---|
| `audit_events` | append-only（应用层约束）| 责任事实不可篡改 |
| `run_events` | `(run_id, sequence)` 严格单调 | SSE 续传 + 时间线一致 |
| `agent_template_versions` | `(agent_id, version)` 唯一；snapshot jsonb 不可变 | 历史 Run 永远可解释 |
| `evidence_artifacts.source_hash` | NOT NULL | 证据可追溯到原始来源 |
| `artifacts.sha256` + `storage_uri` | NOT NULL | 内容可校验、与位置解耦 |
| `policy_decisions.decision` | enum: allow/deny/review_required | 决策结果明确 |
| `human_reviews.status` | pending/approved/rejected/waived | 状态机闭合 |

### 3.2 索引策略

每张事实表至少有 `(tenant_id, created_at)` 索引以支持租户级时间序列查询。`run_events` 额外有 `(run_id, sequence)` 用于 SSE 历史回放。

---

## 4. 服务层（Services）

`neptune-ai/server/src/services/` 共 30 个文件。按职责分类：

### 4.1 平台事实链服务（10 个）

| 服务 | 单例 | 关键方法 |
|---|---|---|
| `run.ts` | `runService` | `start / complete / fail / cancel / getDetailByTenant` |
| `run-facts.ts` | `runFactService` | `recordEvent / recordToolStarted / recordToolCompleted / listRuntimeEventsAfter` |
| `run-admission.ts` | `runAdmissionService` | `enforceThreadDispatch`（配额硬门禁，写 PolicyDecision + AuditEvent） |
| `run-event-bus.ts` | `runEventBus` | `publish / subscribe / terminate / reset` |
| `run-observability.ts` | (内部) | Run 详情聚合：events + tools + artifacts + policy + reviews + audit |
| `artifact-evidence.ts` | `artifactEvidenceService` | `recordRuntimeArtifact / recordEvidenceForArtifact / list*` |
| `policy-decision.ts` | `policyDecisionService` | `record / listByTenant` |
| `human-review.ts` | `humanReviewService` | `create / decide / listByTenant` |
| `audit.ts` | `auditEventService` | `record / listByTenant / exportCsvByTenant` |
| `agent-version.ts` + `agent-version-hash.ts` | `agentVersionService` | `ensureSnapshot / listForAgent` + sha256 hash 计算 |
| `platform-cost.ts` | `platformCostService` | `getQuotaStatus / getCostSummary` |
| `project.ts` | `projectService` | CRUD + archive |

### 4.2 业务方案包服务（1 个，关账）

| 服务 | 关键方法 |
|---|---|
| `closing-workbench.ts` | `createWorkspace / generateChecks / importCsvEvidence / submitFindingReview / decideReview / generateReport / listWorkflowTimeline / getReportDetail` |

### 4.3 既有平台基础服务（保留）

| 服务 | 用途 |
|---|---|
| `auth.ts` | JWT 签发/验证 |
| `tenant.ts` / `user.ts` | 主体管理 |
| `agent-template.ts` | Agent 配置 CRUD |
| `skill.ts` | Skill CRUD + publish/unpublish |
| `knowledge-service.ts` | 知识库（documents.category）|
| `cost.ts` | 旧 billing 兼容 |
| `permission-delegate.ts` | 工具/MCP/路径白名单 |
| `prompt-assembler.ts` | 模块化 system prompt 组装 |
| `thread-manager.ts` | 受控运行 dispatch（接 engine） |
| `engine-factory.ts` / `controlled-engine-factory.ts` | engine 实例工厂 |
| `sse-event-mapper.ts` | engine 事件 → SSE chat event 映射 |
| `history-transformer.ts` | thread 历史转换 |
| `observability/` | Langfuse provider 接入 |
| `plan/` | PlanManager（chat 内 task 协议）|
| `session.ts` | Session 兼容层 |

### 4.4 服务层约束（通用）

- 所有写操作必须经过 `auth + tenant + admission + audit` 链路
- 跨服务依赖通过模块单例，**不做依赖注入容器**（保持简单，靠 import 顺序）
- `RunFactService.recordEvent` 是 SSE 流的唯一事实入口：`INSERT run_events` 后 `runEventBus.publish`
- 敏感字段（prompt 全文、credential、MCP auth）**不进 DTO，不进 audit metadata**

---

## 5. API 端点全景

`/api/v1/*`，66 个端点。所有错误响应统一信封，所有受保护端点必须 `Authorization: Bearer <jwt>`。

### 5.1 路由分组

| 前缀 | 文件 | 说明 |
|---|---|---|
| `/api/v1/auth` | `auth.ts` | 注册/登录/刷新/me（4 个）|
| `/api/v1/tenants` | `tenants.ts` + `billing.ts` | 租户 CRUD（admin）+ 计费 |
| `/api/v1/users` | `users.ts` | 用户 CRUD |
| `/api/v1/agents` | `agents.ts` + `threads.ts` + `sessions.ts` | Agent 模板 + Thread + 旧 chat 兼容 |
| `/api/v1/skills` | `skills.ts` | Skill CRUD + publish/unpublish + 关联 Agent |
| `/api/v1/projects` | `projects.ts` | CustomerProject CRUD + archive |
| `/api/v1/runs` | `runs.ts` | Run 创建/查询/取消/重试 + **SSE 流** |
| `/api/v1/platform-facts` | `platform-facts.ts` | 治理台事实查询 |
| `/api/v1/closing` | `closing.ts` | 关账工作台业务 API |
| `/health` `/health/db` | `index.ts` | 健康检查 |

### 5.2 关键端点（受控运行 + 治理 + 关账）

```
受控运行 (Controlled Run)
─────────────────────────────────────
POST   /api/v1/runs                         发起受控运行（admission 拦截）
GET    /api/v1/runs/:runId                  运行详情聚合（events+tools+artifacts+policy+review+audit）
GET    /api/v1/runs/:runId/events/stream    SSE 实时事件流（Last-Event-ID 续传）
POST   /api/v1/runs/:runId/cancel           取消运行
POST   /api/v1/runs/:runId/retry            重试运行（创建新 Run）

治理事实查询
─────────────────────────────────────
GET    /api/v1/platform-facts/runs                            运行列表
GET    /api/v1/platform-facts/runs/:runId/observability        可观测聚合
GET    /api/v1/platform-facts/runs/:runId/events               JSON 分页历史
GET    /api/v1/platform-facts/runs/:runId/tool-invocations    工具调用列表
GET    /api/v1/platform-facts/runs/:runId/artifacts           成果文件
GET    /api/v1/platform-facts/runs/:runId/evidence-artifacts  证据元数据
GET    /api/v1/platform-facts/audit-events                    审计列表（支持过滤）
GET    /api/v1/platform-facts/audit-events/export             CSV 导出（最多 1000 行）
GET    /api/v1/platform-facts/policy-decisions                策略决策
GET    /api/v1/platform-facts/human-reviews                   复核队列
POST   /api/v1/platform-facts/human-reviews                   创建复核
POST   /api/v1/platform-facts/human-reviews/:id/decision      决策（approve/reject/waive）
GET    /api/v1/platform-facts/cost-summary                    成本概览
GET    /api/v1/platform-facts/quota/status                    配额放行状态
GET    /api/v1/platform-facts/agents/:agentId/versions        智能体版本列表

关账 Solution Pack
─────────────────────────────────────
POST   /api/v1/closing/workspaces                                       创建关账工作区
GET    /api/v1/closing/workspaces/:id/overview                         期间总览
POST   /api/v1/closing/workspaces/:id/checks:generate                  生成检查 Run
GET    /api/v1/closing/workspaces/:id/checklist                        检查清单
GET    /api/v1/closing/workspaces/:id/findings                         异常发现
GET    /api/v1/closing/workspaces/:id/evidence-artifacts               证据中心
POST   /api/v1/closing/workspaces/:id/evidence-imports:csv             CSV 证据导入（multipart）
POST   /api/v1/closing/findings/:id/submit-review                      提交复核
POST   /api/v1/closing/reviews/:id/:decision                           决策（approve/reject/waive）
POST   /api/v1/closing/workspaces/:id/report-snapshots                 生成关账报告
GET    /api/v1/closing/report-snapshots/:reportId                      报告详情（含事实链）
GET    /api/v1/closing/workspaces/:id/workflow-timeline                工作流时间线（跨审计聚合）
```

完整端点清单见 `docs/governance/`（每个治理对象可生成 OpenAPI/Postman 集合）。

---

## 6. Controlled Run 完整数据流（脊柱）

一次受控运行从前端发起到事实落地的完整流转：

```
[1] web Home / Governance ──── POST /api/v1/runs ───────────►  routes/runs.ts
                                                                     │
                                                                     ▼
                                                          [2] runAdmissionService
                                                                .enforceThreadDispatch
                                                                     │
                                                       ┌─── 配额拒绝 (写 policy_decisions
                                                       │              + audit_events)
                                                       │   throw ApiError('QUOTA_EXCEEDED')
                                                       │   → 429 标准错误信封
                                                       │
                                                       └─── 通过
                                                                     │
                                                                     ▼
                                              [3] agentVersionService.ensureSnapshot
                                                  → INSERT agent_template_versions
                                                  → 计算 sha256 versionHash
                                                                     │
                                                                     ▼
                                                  [4] runService.start
                                                      → INSERT runs (status='running')
                                                                     │
                                                                     ▼
                                                  [5] threadManager.dispatch
                                                      ├── runFactService.recordEvent
                                                      │     'run.started'
                                                      │     → INSERT run_events
                                                      │     → runEventBus.publish ─────┐
                                                      │                                │
                                                      ├── (engine 真实执行)            │
                                                      │   for each event:              │
                                                      │     recordEvent('tool.invocation.started')
                                                      │     recordEvent('tool.invocation.completed')
                                                      │     recordEvent('run.output.delta')
                                                      │     recordEvent('run.output.completed')
                                                      │     ↓                          │
                                                      │     run_events 表 + bus 广播 ──┤
                                                      │                                │
                                                      └── runService.complete           │
                                                          → UPDATE runs (status='completed')
                                                          → recordEvent('run.completed')
                                                          → cost service 写 billing_records
                                                          → audit service 写 audit_events
                                                                                       │
                                                                                       │
                                                                                       ▼
                                                  [6] 同时，订阅者：
                                                      ─────────────────────
                                                      [A] web hook useRunEventStream
                                                            EventSource SSE
                                                            ↓
                                                            治理台「运行事件时间线」实时刷新
                                                            状态徽标：实时/重连/已完成

                                                      [B] /api/v1/platform-facts/runs/:id/events
                                                            JSON 分页（审计离线分析）

                                                      [C] AuditEventService.exportCsvByTenant
                                                            治理团队可导出审计 CSV

[7] 关账工作台（如果是检查 Run）：
    closingWorkbenchService.generateChecks
        → 创建 Run（同 [1] 流程）
        → 在 Run 完成后写 finding 表 + workflow_timeline
        → 用户处理 finding：submit-review → human_reviews
        → 报告生成：close_reports.snapshot + sha256
```

**关键不可逆事实**：

- 每条 `run_events` 一旦写入立即可被订阅者看到（事务边界 = 一行 INSERT）
- `audit_events` 永远不 UPDATE，永远不 DELETE
- `agent_template_versions.snapshot` jsonb 永远不修改
- `close_reports.snapshot_hash` 是报告时间点的事实指纹

---

## 7. 跨层协议（Shared Contracts）

`shared/types/neptune-ai/api/` 是前后端**强类型契约**，TypeScript 强约束。

### 7.1 错误信封（强制封闭枚举）

详见 `docs/governance/api-error-envelope.md`。

```ts
interface ApiErrorEnvelope {
  error: ApiErrorCode;              // 7 个值的封闭枚举
  message: string;                  // 中文用户可读
  requestId?: string;               // 必填（全局兜底注入）
  details?: Record<string, unknown>;// STATE_CONFLICT 用 details.reason 携带子状态
}

const API_ERROR_CODES = [
  'VALIDATION_FAILED',  // 400
  'UNAUTHORIZED',       // 401
  'FORBIDDEN',          // 403
  'RESOURCE_NOT_FOUND', // 404
  'STATE_CONFLICT',     // 409
  'QUOTA_EXCEEDED',     // 429
  'INTERNAL_ERROR',     // 500
] as const;
```

实现保证：
- 所有路由通过 `replyApiError(request, reply, code, message, options)` 出错
- Fastify `setErrorHandler` + `setNotFoundHandler` 全局兜底未捕获错误
- 错误信封一致性合同测试覆盖（7 条用例）

### 7.2 Run SSE 流协议

详见 `docs/governance/run-event-stream.md`。

```ts
type RunStreamEnvelope =
  | { type: 'event'; event: RunRuntimeEvent }      // 历史 + 实时事件
  | { type: 'heartbeat'; occurredAt: string }      // 每 15s 一帧
  | { type: 'end'; reason: 'completed'|'failed'|'cancelled' }
  | { type: 'error'; ...ApiErrorEnvelope };

const RUN_RUNTIME_EVENT_TYPES = [
  'run.started', 'run.completed', 'run.failed', 'run.cancelled',
  'run.output.delta', 'run.output.completed',
  'tool.invocation.started', 'tool.invocation.completed', 'tool.invocation.failed',
  'policy.decision.recorded',
  'human_review.requested', 'human_review.decided',
  'artifact.created',
  'cost.recorded',
] as const;
```

实现保证：
- `id: <sequence>` SSE 字段 + `Last-Event-ID` 头实现断线续传
- 终态运行回放后立即 `type=end` + 关闭流
- 客户端断连时服务器自动 unsubscribe + clearInterval

### 7.3 主要 DTO 一览

```
平台事实：    RunDto / RunDetailDto / RunEventDto / ToolInvocationDto
            / ArtifactDto / EvidenceArtifactDto
            / PolicyDecisionDto / HumanReviewDto / AuditEventDto
            / AgentVersionSummaryDto / CostSummaryDto / QuotaStatusDto
            / RunObservabilityDto

业务对象：    CustomerProjectDto
            / CloseWorkspaceDto / AccountingPeriodDto / ChecklistItemDto
            / FindingDto / CloseReportDto
            / CloseWorkflowTimelineItemDto

聊天兼容：    AgentTemplateDto / AgentDocumentDto / ThreadDto
            / ChatStreamEvent (13 种 discriminator)
```

DTO 不暴露 prompt 全文、credential、MCP auth；`AgentVersionSummaryDto` 仅返回脱敏统计（toolCount/skillCount 等）。

---

## 8. 前端架构（neptune-ai/web）

### 8.1 技术栈

- Vite 5 + React 18 + TypeScript（strict）
- Tailwind CSS（中文优先 design system）
- Zustand 全局 auth store（不引入 redux/jotai）
- React Router v6（SPA 单入口）
- 不使用 React Query/SWR（按资源拆 API client + useState/useEffect）

### 8.2 页面与路由

| 路由 | 页面 | 角色 |
|---|---|---|
| `/login` | Login | 登录注册 |
| `/` | Home | 交付台首页（发起受控运行）|
| `/agents` `/agents/create` `/agents/:id` | AgentConfig / CreateAgent / AgentChat | Agent 模板管理 |
| `/skills` | Skills | 技能上架/下架 |
| `/collaborate` `/collaborate/:agentId` | Collaborate | 调试聊天工作台 |
| `/governance` `/governance?tab=runs\|audit\|...` | Governance | **治理台 6 tab** |
| `/close-workbench/:workspaceId` | CloseWorkbench | **关账工作台** |
| `/projects` | （路由集成在 Home/Sidebar）| CustomerProject 切换 |

### 8.3 关键 hooks

| hook | 作用 |
|---|---|
| `useRunEventStream(runId)` | SSE 流消费（fetch + ReadableStream，Last-Event-ID 续传）|
| `useChatMessages` | 聊天 SSE 事件解析 |
| `useArtifacts` | artifact 解析与展示 |
| `useThreads` | thread 列表与切换 |
| `useResizableSidebar` | UI 工具 |

### 8.4 中文产品 IA

主导航：**首页 / 智能体 / 技能 / 治理台 / 关账工作台**

错误展示统一：中文 message + 请求编号（requestId）+ 跳转治理台入口（如配额拒绝跳"配额状态"）。

---

## 9. 边界与约束（什么不在 server / 不在 engine）

### 9.1 `neptune-engine` 不承载

- 业务对象：CustomerProject / Run / Audit / Evidence / Finding / Review
- 业务流程：关账状态机 / 财务规则 / 工作流编排
- 治理决策：PolicyDecision / HumanReview / Audit
- 持久化：所有 schema 在 server 侧
- UI：React/Ink 渲染逻辑全部在 product / web 层

### 9.2 `neptune-ai/server` 不承载

- 模型调用细节（走 engine adapter）
- 工具执行（builtin tools 在 engine workspace）
- MCP client 协议层（在 engine workspace）
- Solution Pack 业务逻辑（如未来 HR pack）应继续放在 server 但用独立 service 文件，**不污染平台事实链服务**

### 9.3 `shared/types/neptune-ai` 不承载

- 业务行为（仅协议）
- 实现细节（仅类型）
- 服务端内部状态（如 idempotency keys）

---

## 10. 测试与质量门禁

### 10.1 当前覆盖

| 层级 | 工具 | 文件数 | 通过 / 总数 |
|---|---|---|---|
| Server contract | bun test | 32 | **340 / 340** |
| Web typecheck | tsc --noEmit | — | 通过 |
| Web build | vite build | — | 通过 |
| Web e2e | Playwright | 17 | （需本地 server 起） |
| Engine boundary | verify-runtime-boundaries.sh | — | 通过（codex 维护）|

### 10.2 关键合同测试（保证不漂移）

- `error-envelope-contract.test.ts` — 错误信封封闭枚举 + 全局兜底 + requestId 透传
- `run-events-stream.test.ts` — SSE 协议 + 续传 + 终态 + 跨租户隔离
- `closing-workbench.contract.test.ts` — 关账主流程 9 条端到端
- `platform-facts.test.ts` — 治理台事实 API + 跨租户 + 脱敏

### 10.3 已知技术债

- `bunx tsc --noEmit` 全量服务端约 880 个 pre-existing 错误（engine bridge / drizzle / lodash-es 类型问题）
- 服务层缺单元测试，回归靠路由 contract test 兜底
- 没有 CI 集成 e2e 与 boundary 检查

---

## 11. 部署形态（当前 vs 未来）

| 形态 | 状态 | 说明 |
|---|---|---|
| 本地 MVP | ✅ 当前 | 单进程 + 本地 PG/Redis + 文件系统 |
| 客户私有化单环境 | 🟡 设计已收敛 | 见 `04-subsystems-topology.md` |
| 云控制面 | ❌ 不在阶段一 | 阶段四以后 |
| connector marketplace | ❌ 不在阶段一 | 阶段四以后 |

私有化升级路径关键约束：
- run-event-bus 替换为 Postgres LISTEN/NOTIFY 或 Redis pub/sub（接口已抽象）
- artifact storage 替换为对象存储（接口未抽象，需添加）
- 多租户**继续采用 row-level tenant_id**（用户已确认，不走 schema-per-tenant）

---

## 12. 当前阶段一里程碑事实

| 维度 | 数值 |
|---|---|
| Migrations | 11 |
| 数据表 | 22 |
| 服务文件 | 30 |
| REST 端点 | 66 |
| SSE 端点 | 1（`/runs/:id/events/stream`）|
| Shared DTO 文件 | 9 |
| 错误码（封闭枚举） | 7 |
| Run 事件类型（封闭枚举） | 14 |
| Server 测试 | 32 文件 / 340 用例 / 1141 expect |
| Web 页面 | 9 |
| Web e2e | 17 |
| 设计文档 | 7 |
| 治理文档 | 4 |
| `neptune-engine` 修改行数 | **0** |

---

## 13. 下一阶段方向（不在本文档范围）

下一阶段重点：

1. **PolicyDecision 全面接入面**（当前只 admission）
2. **MemoryService 独立化**（从 documents.category=memory 解耦）
3. **关账 Solution Pack 收尾**（connector + ControlRuleVersion）
4. **Eval / Release / Workflow 元数据**（持续可升级语义）

具体 backlog 见 `docs/neptune-lab/design/05-implementation-roadmap.md` 与阶段一结项会议纪要。

---

**文档结束**。如需对某一层做深入细节，参考：

- 设计决策：`docs/neptune-lab/design/`
- API 规范细节：`docs/governance/api-error-envelope.md` / `run-event-stream.md`
- DB 结构变更历史：`neptune-ai/server/src/db/migrations/`
