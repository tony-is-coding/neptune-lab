# Neptune AgentOps 子系统及系统拓扑设计

日期：2026-05-22

状态：设计收敛

上游依据：

- `docs/strategy/neptune-agentops-platform-strategy.md`
- `docs/superpowers/specs/2026-05-22-neptune-agentops-product-architecture-design.md`

## 0. 结论

Neptune 的拓扑设计不是“把组件连起来”，而是确定生产责任边界：敏感业务数据留在哪、Run 如何受控执行、证据如何可追溯、审计事实如何不可被 transcript 或日志替代、未来云控制面如何不越过客户数据边界。

当前阶段采用 **本地 Architecture MVP 单环境拓扑**：

- `neptune-ai/web` 是中文产品入口，承载交付台、治理台、关账工作台。
- `neptune-ai/server` 是唯一产品编排层，负责 REST、SSE、后台任务、审计写入、Run lifecycle、证据与成果文件元数据。
- PostgreSQL 保存平台事实、业务状态、审计事件、artifact/evidence 元数据，不保存大文件本体。
- Redis 只承担短期运行协调：SSE fan-out、后台任务队列、运行锁、幂等键、临时进度，不承担审计或证据事实。
- Object Storage 保存 artifact、evidence、报告、CSV/Excel 原始导入和导出文件。
- Langfuse 保存观测 trace，不是审计账本，不是证据库。
- `neptune-engine` 作为嵌入式 Runtime Kernel 被 server 调用，只理解通用 Run、工具、MCP、streaming、trace、artifact hook，不理解财务、ERP、关账或审批责任。
- ERP or CSV 输入进入 server 侧 Connector / Import boundary，经校验、脱敏摘要、hash 和审计后成为 EvidenceArtifact。
- MCP 工具只能通过 server 的策略、权限和审计边界进入 engine；web 不直连 MCP，engine 不绕过 server 持久化生产事实。

长期目标采用 **Hybrid AgentOps Platform**：Neptune Cloud Control Plane 分发签名包、版本元数据、安全公告、Solution Pack、Connector 包和升级建议；客户侧 Data Plane 保存敏感财务数据、运行记录、证据、审计和本地 runtime。控制面不存客户 ERP 数据、凭证、发票、银行回单、审批附件或证据文件。

## 1. 设计目标

### 1.1 拓扑要回答的问题

本文件只回答系统拓扑、数据流和故障边界，不重新定义产品信息架构或服务 API。重点是：

1. 本地 Architecture MVP 如何部署，哪些组件必须在同一信任边界内。
2. 未来客户私有化部署如何保留数据主权、审计主权和升级语义。
3. 未来云控制面如何参与版本、包、license、health metadata，而不接触敏感业务数据。
4. REST、SSE streaming、后台任务、审计写入、artifact/evidence 存储流如何穿过 Web、Server、PostgreSQL、Redis、Object Storage、Langfuse、Engine、ERP/CSV、MCP 工具。
5. 故障发生时，哪个子系统可以失败，哪个事实不能丢，哪些能力必须降级而不是污染审计或证据链。

### 1.2 第一性边界

Neptune 的中心不是 `Conversation`，而是 `Controlled Run`。拓扑必须服务这条事实链：

```text
CustomerProject
  -> AgentTemplateVersion
  -> Run
  -> RunEvent / ToolInvocation
  -> Artifact / EvidenceArtifact
  -> Finding
  -> HumanReview / Approval / Waiver
  -> AuditEvent
  -> UsageRecord / Cost
  -> CloseReadinessReport
```

任何组件只要不能增强这条链的可解释、可审计、可升级能力，就不能成为当前阶段的关键路径。

## 2. 本地 Architecture MVP 拓扑

本地 MVP 是交付团队和早期客户现场的最小生产骨架。它可以是单机 Docker Compose、内网服务器或开发工作站，但逻辑边界必须按生产方式设计。

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                         本地 Architecture MVP                              │
│                                                                            │
│  ┌──────────────────┐        REST / SSE         ┌──────────────────────┐  │
│  │ neptune-ai/web   │ ────────────────────────▶ │ neptune-ai/server    │  │
│  │ 中文产品入口      │ ◀──────────────────────── │ 产品编排 / 平台事实    │  │
│  │ 交付/治理/关账    │        SSE streaming      │ Run / Audit / Review │  │
│  └──────────────────┘                           └──────────┬───────────┘  │
│                                                            │              │
│           ┌────────────────────────────────────────────────┼────────────┐ │
│           │                                                │            │ │
│           ▼                                                ▼            ▼ │
│  ┌──────────────────┐                           ┌────────────────┐ ┌──────────────┐
│  │ PostgreSQL       │                           │ Redis          │ │ Object Store │
│  │ 平台事实/审计/元数据│                           │ 队列/锁/进度/SSE │ │ 证据/成果/报告 │
│  └──────────────────┘                           └────────────────┘ └──────────────┘
│           ▲                                                ▲            ▲ │
│           │                                                │            │ │
│           │                                      后台任务 / 运行协调       │ │
│           │                                                │            │ │
│           │                                  ┌─────────────┴────────────┘ │
│           │                                  ▼                             │
│  ┌────────┴─────────┐            runtime API / hooks        ┌─────────────┐
│  │ Langfuse         │ ◀──────────────────────────────────── │ neptune-    │
│  │ trace/observability│                                   │ engine      │
│  │ 非审计事实        │ ───────────────────────────────────▶ │ Runtime     │
│  └──────────────────┘             trace events             │ Kernel      │
│                                                             └──────┬──────┘
│                                                                    │
│                                         MCP calls / tool execution │
│                                                                    ▼
│                    ┌──────────────────┐                 ┌────────────────┐
│                    │ ERP or CSV Input │ ──────────────▶ │ MCP / Tools    │
│                    │ 导入/查询/快照     │ 受控连接器边界   │ 文件/ERP/API工具 │
│                    └──────────────────┘                 └────────────────┘
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 子系统职责

| 子系统 | 当前 MVP 职责 | 禁止越界 |
| --- | --- | --- |
| `neptune-ai/web` | 发起 REST 请求、订阅 SSE、展示运行记录、证据、异常、复核、审计链 | 不直连数据库、对象存储、MCP、ERP；不绕过 server 发起运行 |
| `neptune-ai/server` | 产品编排、权限/配额/策略、Run lifecycle、后台任务、审计写入、artifact/evidence 元数据、Engine Adapter | 不把 engine 当数据库；不把 Langfuse 当审计；不把财务语义下沉到 engine |
| PostgreSQL | 租户、项目、版本、Run、RunEvent、ToolInvocation、Finding、Review、AuditEvent、UsageRecord、artifact/evidence 元数据 | 不保存大文件本体；不保存短期 SSE buffer 当生产事实 |
| Redis | 队列、运行锁、幂等键、SSE fan-out、短期 progress cache、后台任务状态 | 不作为唯一事实源；不保存审计账本；不保存证据 |
| Object Storage | CSV/Excel 原始导入、ERP 查询快照、证据文件、成果文件、关账报告导出 | 不承载权限决策；文件必须有 DB 元数据、hash、source、runId |
| Langfuse | 观测 trace、模型调用、工具执行耗时、调试关联 | 不替代 `AuditEvent`、`EvidenceArtifact`、`ToolInvocation` |
| `neptune-engine` | LLM、工具执行、MCP、streaming、runtime trace、artifact hook | 不理解关账、凭证、科目余额表、审批、报告模板 |
| ERP or CSV 输入 | 作为受控数据源进入 Connector / Import 流程 | 不被 web 直接上传给 engine；不绕过证据登记 |
| MCP / Tools | 文件、ERP、API、计算、解析等受控工具能力 | 不拥有最终权限；每次调用必须形成 ToolInvocation 与策略/审计关联 |

### 2.2 本地 MVP 部署边界

本地 MVP 可以把 web、server、engine adapter、worker 放在同一应用部署单元，但逻辑上必须保留四条边界：

1. **产品边界**：web 只消费 server API；所有中文业务体验在 web，所有生产事实在 server。
2. **运行时边界**：server 通过 adapter 调用 `neptune-engine`；engine 不直接写 PostgreSQL、Object Storage 或审计。
3. **事实边界**：PostgreSQL 是事实索引，Object Storage 是文件本体，Langfuse 是观测，Redis 是协调。
4. **数据接入边界**：ERP / CSV 输入先进入 Connector / Import 层，登记 source、hash、schema、runId 或 workspaceId 后才能成为证据。

## 3. 未来客户私有化部署拓扑

私有化部署面向强合规企业、内网或专有云。核心原则是：客户敏感数据、运行事实、证据、审计、模型网关选择权留在客户侧。

```text
┌──────────────────────────────────── 客户私有化环境 ────────────────────────────────────┐
│                                                                                         │
│  ┌────────────────────┐      ┌─────────────────────────────┐      ┌──────────────────┐ │
│  │ Enterprise SSO/IAM │ ───▶ │ Neptune Web/API             │ ───▶ │ PostgreSQL       │ │
│  │ 用户/角色/组织       │      │ server + web + worker        │      │ 平台事实/审计      │ │
│  └────────────────────┘      └──────────────┬──────────────┘      └──────────────────┘ │
│                                             │                                           │
│                                             ├──────────────▶ ┌──────────────────────┐   │
│                                             │                │ Object Storage       │   │
│                                             │                │ 证据/成果/导入/报告     │   │
│                                             │                └──────────────────────┘   │
│                                             │                                           │
│                                             ├──────────────▶ ┌──────────────────────┐   │
│                                             │                │ Redis                │   │
│                                             │                │ 队列/锁/SSE/临时状态   │   │
│                                             │                └──────────────────────┘   │
│                                             │                                           │
│                                             ▼                                           │
│                                 ┌──────────────────────┐                                │
│                                 │ neptune-engine       │                                │
│                                 │ customer-side runtime│                                │
│                                 └──────────┬───────────┘                                │
│                                            │                                            │
│                       ┌────────────────────┼────────────────────┐                       │
│                       ▼                    ▼                    ▼                       │
│              ┌────────────────┐   ┌────────────────┐   ┌────────────────────┐          │
│              │ ERP / DB / API │   │ CSV / Excel    │   │ Model Gateway       │          │
│              │ 用友/金蝶/SAP等 │   │ 文件导入         │   │ 本地或专有云模型       │          │
│              └────────────────┘   └────────────────┘   └────────────────────┘          │
│                                                                                         │
│  可选：客户侧 Langfuse 或兼容观测栈，只保存客户允许的 trace，仍不替代审计和证据。            │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 私有化部署的关键决策

| 决策 | 设计 |
| --- | --- |
| 数据主权 | ERP 数据、CSV、凭证、发票、银行回单、审批附件、证据文件、Run、审计全部留在客户环境 |
| 身份权限 | 可接企业 SSO/IAM；Neptune server 仍执行产品级 RBAC、策略决策和审计 |
| 模型调用 | 通过客户指定 Model Gateway，可是本地模型、专有云模型或合规云模型 |
| 观测 | 客户可部署本地 Langfuse；trace 脱敏策略由客户治理方确认 |
| 升级 | 当前阶段手动或半自动导入版本包；每次升级写入 Upgrade Audit |
| 连接器 | ERP connector 在客户网络内运行；credentialRef 不出客户环境 |

### 3.2 私有化故障隔离

私有化环境中，Neptune 必须允许部分能力失败但不破坏事实链：

- Langfuse 不可用：Run 仍可执行；trace 缺失要写入观测降级事件，但不能影响 AuditEvent 写入。
- Redis 不可用：不启动新后台任务，不建立新 SSE fan-out；已落库事实仍可查询。
- Object Storage 不可用：禁止生成新的 EvidenceArtifact 或 ReportArtifact；Run 可以失败并写审计，不能只保存 DB 元数据假装成功。
- ERP connector 不可用：对应检查项失败或进入 `blocked`，生成可复核的失败 finding / audit，而不是吞错。
- Model Gateway 不可用：Run 失败或进入可重试状态；UsageRecord 只能记录已确认的用量。
- PostgreSQL 不可用：禁止启动新的 Controlled Run，因为无法记录 Run、版本、审计和幂等事实。

## 4. 未来云控制面拓扑

未来目标不是纯 SaaS，而是云控制面 + 客户侧数据平面。云控制面管理平台演进，客户侧数据平面承载敏感执行。

```text
┌──────────────────────────── Neptune Cloud Control Plane ────────────────────────────┐
│                                                                                     │
│  License / Subscription     Platform Version Registry     Security Advisory          │
│  Solution Pack Registry     Connector Package Registry    Policy Template Registry   │
│  Eval Benchmark Registry    Upgrade Channel               Non-sensitive Health       │
│                                                                                     │
│  不接收：ERP 明细、凭证、发票、银行回单、审批附件、证据文件、客户 prompt 全量、财务结论。 │
└───────────────────────────────────┬─────────────────────────────────────────────────┘
                                    │ signed packages / metadata / license / advisory
                                    │ health summary / compatibility matrix
                                    ▼
┌────────────────────────────── Customer Data Plane ──────────────────────────────────┐
│                                                                                     │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐               │
│  │ Neptune Web/API  │   │ neptune-engine   │   │ Connector Runtime│               │
│  │ customer side    │   │ customer side    │   │ ERP/CSV/API      │               │
│  └────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘               │
│           │                      │                      │                         │
│  ┌────────▼─────────┐   ┌────────▼─────────┐   ┌────────▼─────────┐               │
│  │ Customer DB      │   │ Artifact Store   │   │ Audit Store      │               │
│  │ runs/reviews/cost│   │ evidence/reports │   │ append-only      │               │
│  └──────────────────┘   └──────────────────┘   └──────────────────┘               │
│                                                                                     │
│  本地执行：Pre-upgrade Eval / Impact Report / Rollback / Upgrade Audit              │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 云控制面可以知道什么

| 数据类型 | 是否可进入云控制面 | 说明 |
| --- | --- | --- |
| license、订阅状态、版本通道 | 可以 | 商业和升级控制必要元数据 |
| platform / solution pack / connector 版本 | 可以 | 只传版本、hash、兼容矩阵，不传客户数据 |
| 安全公告确认状态 | 可以 | 记录客户环境是否已接收 advisory |
| 非敏感 health summary | 可以 | 例如组件版本、最近心跳、失败计数摘要；需可关闭 |
| Eval benchmark 定义 | 可以下发 | 客户本地执行，结果是否上传由客户策略决定 |
| 客户 ERP 明细、证据文件、财务 finding | 不可以 | 必须留在客户数据平面 |
| 完整 prompt、credential、MCP auth config | 不可以 | 只允许脱敏摘要或 hash |
| AuditEvent 明细 | 默认不上传 | 客户侧保留；可人工导出脱敏包用于支持 |

### 4.2 云控制面不是当前 MVP

当前阶段只保留字段和流程语义：

- platform version；
- Solution Pack version；
- AgentTemplateVersion；
- ControlRule version；
- Connector version；
- ReportTemplate version；
- Run 绑定版本；
- artifact/evidence source、hash、storageUri；
- AuditEvent append-only；
- 升级行为可审计。

不建设完整签名包分发、多环境灰度、自动 rollback、云端 billing、connector marketplace。

## 5. 核心流设计

### 5.1 同步 REST 流

同步 REST 用于配置、查询、发起动作和提交人工决策。REST 的成功标准不是“请求返回 200”，而是关键事实已持久化并有审计。

```text
Web
  -> Server REST route
  -> Auth / tenant / RBAC
  -> quota / policy pre-check
  -> service transaction
  -> PostgreSQL 写入业务事实
  -> AuditEvent append-only
  -> response DTO
  -> Web 更新页面状态
```

典型 REST 动作：

- 创建客户项目；
- 创建关账工作区；
- 导入 CSV/Excel 元数据登记；
- 发起 Close Readiness Run；
- 指派异常负责人；
- 提交复核；
- 批准、退回、豁免；
- 生成或导出关账报告；
- 查询运行记录、审计事件、智能体版本、成本概览、策略决策。

REST 边界：

- 发起 Run 只能创建运行请求和后台任务，不能在 HTTP request 内完成长任务。
- 任何会改变责任事实的动作必须写 `AuditEvent`。
- 任何文件上传或导入必须先落 Object Storage，再以 hash、source、schema、storageUri 写 DB 元数据；两者任一失败都不能声明导入成功。

### 5.2 SSE streaming 流

SSE 是运行体验和调试体验，不是事实账本。事实以 PostgreSQL 和 Object Storage 为准。

```text
Web subscribes SSE
  -> Server validates run access
  -> Redis fan-out / in-memory stream bridge
  -> Worker receives engine events
  -> Server maps events to RunEvent / ToolInvocation / Artifact metadata
  -> PostgreSQL commits durable facts
  -> SSE emits user-visible progress
  -> Web renders 流式输出 / 工具调用 / 成果文件 / 错误详情
```

SSE 事件分层：

| 事件层 | 用途 | 是否生产事实 |
| --- | --- | --- |
| token / text delta | 运行输出体验 | 否，除非被固化为 artifact 或 report |
| progress | 页面进度和状态 | 否，以 Run 状态为准 |
| tool started / completed / failed | 调试和治理展示 | 是，必须落 `ToolInvocation` |
| artifact created | 成果/证据入口 | 是，必须落 metadata 并关联 Object Storage |
| policy decision | 策略解释 | 是，必须落 `PolicyDecision` 和 audit |
| review required | 人工复核入口 | 是，必须落 `HumanReview` |
| run completed / failed | 运行终态 | 是，必须落 `Run` 和 `AuditEvent` |

断线规则：

- Web 断开 SSE 不影响 Run 执行。
- 用户重连后必须从 REST 查询 Run durable state，再继续订阅增量事件。
- Redis stream 丢失不能导致 Run 事实丢失；最多导致实时体验降级。

### 5.3 后台任务流

长任务必须由后台 worker 执行，避免 HTTP 生命周期成为运行生命周期。

```text
REST 发起 Run
  -> PostgreSQL create Run(status=created, version refs)
  -> AuditEvent(run.created)
  -> Redis enqueue job(runId, idempotencyKey)
  -> Worker claim lock
  -> Server RunControlService mark running
  -> Engine Adapter invoke neptune-engine
  -> Tool / MCP / artifact hooks stream back
  -> durable writes + SSE fan-out
  -> mark completed / failed / cancelled
  -> UsageRecord + AuditEvent(run.finished)
```

后台任务必须具备：

- `runId` 级幂等；
- worker claim lock；
- 取消信号；
- 超时策略；
- retry 策略；
- 每次 retry 写入 RunEvent；
- 失败可解释，不把 engine 异常直接暴露给业务用户。

### 5.4 审计写入流

审计不是日志。审计事件是责任事实，必须由 server 在关键状态变化处写入。

```text
Business action / system action
  -> actor + tenant + requestId + runId + resource
  -> before policy decision if needed
  -> domain/platform state mutation
  -> AuditEvent(action, resourceType, resourceId, outcome, versionRef)
  -> immutable query / export
```

必须审计的动作：

- 登录后的关键资源访问失败；
- 创建/修改客户项目、智能体模板、版本；
- 导入数据源、生成证据、删除或归档文件；
- 发起、取消、重试、完成 Run；
- 工具调用被允许、拒绝、需要复核；
- 创建 Finding；
- 提交复核、批准、退回、豁免；
- 生成、导出关账报告；
- 配额拦截；
- 版本升级、方案包导入、connector 导入。

Langfuse trace 可以关联 `requestId`、`runId`、`toolInvocationId`，但不能替代以上审计事件。

### 5.5 Artifact / Evidence 存储流

artifact/evidence 是 Neptune 的事实平面。设计上必须把“文件本体”和“可查询事实”拆开。

```text
ERP query / CSV upload / engine artifact / report export
  -> Server receives stream or generated file
  -> Object Storage put object
  -> compute hash / size / mime / source / schema summary
  -> PostgreSQL insert Artifact or EvidenceArtifact
  -> link runId / findingId / workspaceId / version refs
  -> AuditEvent(artifact.created or evidence.created)
  -> Web displays evidence center / run detail / report index
```

EvidenceArtifact 最低元数据：

| 字段 | 目的 |
| --- | --- |
| `id` | 证据唯一标识 |
| `tenantId` / `projectId` / `workspaceId` | 数据归属 |
| `runId` | 生成或引用该证据的运行 |
| `sourceType` | ERP、CSV、Excel、manual upload、engine output、report |
| `sourceRef` | ERP 查询、文件名、connector version、导入批次 |
| `storageUri` | Object Storage 位置 |
| `hash` | 防篡改和重复识别 |
| `schemaSummary` | 结构化证据摘要 |
| `createdBy` / `createdAt` | 责任归属 |
| `versionRefs` | Agent、rule、connector、report template 版本 |

禁止事项：

- 不只把文件 URL 放在聊天消息里。
- 不只把 LLM 引用文本当证据。
- 不让 engine 直接决定证据归属和审计语义。
- 不在 Object Storage 里孤立保存文件而没有 DB 元数据。

## 6. 故障边界

### 6.1 子系统故障矩阵

| 故障点 | 允许的降级 | 禁止的行为 | 必须留下的事实 |
| --- | --- | --- | --- |
| Web 不可用 | 用户暂时不能操作；后台 Run 可继续 | 后台任务依赖浏览器连接才能完成 | 已创建 Run、审计、证据可恢复查询 |
| Server 不可用 | 不接受新动作；worker 停止或等待恢复 | web 直连 engine / DB / object store | 已提交事务不丢 |
| PostgreSQL 不可用 | 停止新 Run 和关键动作 | 只在 Redis 或日志里继续生产执行 | 故障前事务保持一致 |
| Redis 不可用 | 停止新后台任务和实时 fan-out | 把 Redis 当事实源补写审计 | DB 中 Run 可查询，任务可人工恢复 |
| Object Storage 不可用 | 禁止新证据/报告生成 | DB 写入成功但文件不存在还展示成功 | 失败 RunEvent + AuditEvent |
| Langfuse 不可用 | 观测降级 | 阻断生产主链或用 trace 补审计 | 观测降级事件可查 |
| Engine 不可用 | Run 失败或排队重试 | server 伪造执行成功 | Run failed + error summary + audit |
| MCP 工具不可用 | 对应工具调用失败，可重试或需人工处理 | 吞错后生成正常 finding/report | ToolInvocation failed + RunEvent |
| ERP connector 不可用 | 检查项 blocked，提示数据源不可用 | 用旧数据冒充当前证据 | connector failure + source version |
| Model Gateway 不可用 | Run failed / retryable | 继续生成无模型依据的结论 | model error + usage partial facts |

### 6.2 事务边界

必须同事务或可补偿地完成：

- 创建 Run 与绑定版本引用；
- 状态变更与 AuditEvent；
- Review decision 与 Finding 状态变化；
- Artifact/Evidence DB 元数据与 Object Storage 写入结果；
- ToolInvocation 终态与 RunEvent；
- UsageRecord 与 Run 终态。

不能同事务时，必须有补偿状态：

- `artifact_uploading` -> `artifact_available` / `artifact_failed`
- `run_created` -> `run_queued` / `run_queue_failed`
- `report_generating` -> `report_available` / `report_failed`
- `review_submitted` -> `review_recorded` / `review_failed`

## 7. 部署边界

### 7.1 当前阶段部署单元

当前 Architecture MVP 建议部署单元：

| 部署单元 | 包含 | 理由 |
| --- | --- | --- |
| Web | `neptune-ai/web` 静态资源 | 可单独构建和缓存，但只调用 server |
| API/Worker | `neptune-ai/server` REST、SSE、后台 worker、Engine Adapter | 第一阶段避免过早微服务化，保证事务和事实链简单 |
| Runtime Kernel | `neptune-engine` 作为 server 依赖或相邻 runtime | 保持源码和语义边界，不必先拆进程 |
| PostgreSQL | 平台事实库 | Run、审计、版本、证据元数据的唯一事实源 |
| Redis | 协调层 | 队列、锁、fan-out、短期状态 |
| Object Storage | 文件事实库 | 大文件、证据、成果、报告 |
| Langfuse | 观测栈 | 可选，不能成为主链硬依赖 |

### 7.2 不建议当前拆分的服务

当前不拆独立微服务：

- Audit service；
- Artifact service；
- Connector service；
- Review service；
- Policy service；
- Cost service；
- Release service；
- Eval service；
- Cloud control plane。

原因不是这些边界不重要，而是当前阶段更重要的是先把 `Run / Evidence / Review / Audit / Version / Cost` 事实链跑通。过早拆服务会把事务、审计和版本绑定复杂化。

### 7.3 未来可拆分信号

出现以下信号后再考虑拆服务：

- 多个 worker 类型需要独立扩缩容；
- connector runtime 需要客户网络隔离或独立凭证域；
- artifact/evidence 文件量需要独立生命周期和病毒扫描；
- audit 需要 WORM 存储或外部 SIEM 集成；
- policy 需要独立策略语言和集中审批；
- release/eval 需要跨客户分发和本地回归。

## 8. 验收标准

本拓扑进入实施前，必须满足：

1. 任意一次 Close Readiness Run 都能追溯到 Agent、rule、connector、model、report template 版本。
2. 任意 EvidenceArtifact 都有 Object Storage 本体、hash、source、schema summary、run 或 workspace 归属。
3. 任意 ToolInvocation 都能看到策略结果、开始/结束状态、错误摘要和关联 Run。
4. 任意人工复核、批准、退回、豁免都写入业务状态和 AuditEvent。
5. SSE 断线后，用户能通过 REST 恢复 Run durable state。
6. Langfuse 关闭时，系统仍能完成 Run、审计、证据、报告主链。
7. Redis 清空时，不丢失已完成运行的生产事实。
8. Object Storage 写入失败时，不能出现“证据已生成”的成功状态。
9. 私有化部署中，ERP 数据、证据、审计和 credentialRef 不出客户环境。
10. 未来云控制面只接收版本、license、签名包、非敏感 health metadata，不接收财务敏感事实。

## 9. 风险与防线

| 风险 | 后果 | 防线 |
| --- | --- | --- |
| 把 SSE transcript 当事实 | 断线、重放、裁剪后无法审计 | durable RunEvent / ToolInvocation / Artifact metadata |
| 把 Langfuse 当审计 | trace 采样、脱敏或关闭后责任链断裂 | AuditEvent append-only，trace 只做关联 |
| engine 直写证据或审计 | runtime 污染产品责任边界 | server-only persistence，engine 只发 hook/event |
| Redis 承载事实 | 重启或清理导致事实丢失 | Redis 只做协调，事实进 PostgreSQL/Object Storage |
| Object Storage 孤立文件 | 无法证明来源、版本和责任人 | 文件写入后必须登记 metadata、hash、source、audit |
| ERP connector 越权 | 客户数据边界失控 | credentialRef、PolicyDecision、ToolInvocation、AuditEvent |
| 云控制面越界 | 无法进入中国企业敏感场景 | 默认不上传客户敏感数据，health metadata 可关闭 |
| 过早微服务化 | 事务和审计链复杂化，MVP 变慢 | 当前 server 内模块化，等扩缩容或隔离信号出现再拆 |

## 10. 当前阶段不做

- 不修改 `neptune-engine` 来承载财务、ERP、关账、审批、报告语义。
- 不建设完整云控制面、connector marketplace、自动 rollback、多环境灰度。
- 不把聊天作为主产品拓扑中心。
- 不让 web 直连 ERP、MCP、数据库、对象存储。
- 不让 Langfuse、日志、SSE buffer、Redis stream 替代审计或证据事实。
- 不做 ERP 回写、自动过账、自动批准豁免。
- 不把所有平台服务拆成独立微服务。
