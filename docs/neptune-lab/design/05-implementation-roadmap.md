# Neptune AgentOps 实施路线与治理门禁

日期：2026-05-22

状态：实施基线

上游依据：

- `docs/strategy/neptune-agentops-platform-strategy.md`
- `docs/superpowers/specs/2026-05-22-neptune-agentops-product-architecture-design.md`

## 0. 结论

Neptune 下一步实现不应继续堆聊天能力，也不应修改 `neptune-engine`。正确实施路线是：

1. 先把已经存在的运行、审计、智能体版本暴露为稳定平台事实契约。
2. 再补齐一次受控运行必须留下的证据、工具调用、策略决策、复核、用量和审计链。
3. 然后建设治理台，让客户技术治理方看见运行、版本、成本、策略和责任事实。
4. 最后用中国 ERP 财务月结关账工作台验证 AgentOps Platform Core，而不是把平台做成财务 SaaS。

本路线的中心对象是 `Controlled Run`，不是 `Conversation`。任何实施切片都必须落回：

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

强制边界：

- 不修改 `neptune-engine`。
- 不把财务、ERP、关账、报表、审计责任或产品治理对象写入 runtime。
- 不用 Langfuse、日志、SSE transcript 或聊天历史替代审计、证据和成果文件。
- 不提前建设云控制面、connector marketplace、完整 CI/CD、复杂计费或自动 rollback。
- 所有业务语义、平台事实、治理门禁和 Solution Pack 对象先落在 `neptune-ai`；只有稳定跨层 DTO 进入 `shared`。

## 1. 实施目标

### 1.1 产品目标

第一阶段要交付的是 `Architecture MVP`，不是完整生产平台。它必须证明：

- 交付团队可以创建客户项目、配置智能体模板、发起受控试运行。
- 治理团队可以查看运行记录、审计事件、智能体版本、成本用量和策略决策。
- 财务业务用户可以围绕会计期间处理检查清单、证据、异常发现、复核和关账报告。
- 历史运行结果不会因为模板、规则、连接器或模型升级而失去解释能力。

### 1.2 工程目标

实现必须优先收敛事实链，而不是优先做页面外观：

- `neptune-ai/server` 承载产品编排、平台服务、Solution Pack 服务、审计和配额门禁。
- `neptune-ai/web` 承载中文交付台、治理台、关账工作台。
- `shared/types/neptune-ai` 只承载已有持久化模型和真实消费方共同依赖的稳定 DTO。
- `neptune-engine` 保持 Runtime Kernel，只通过现有 adapter 被调用。

## 2. 总体切片顺序

实施顺序必须遵守“事实链先于体验层，治理门禁先于业务自动化”的原则。

| 顺序 | 切片 | 先做原因 | 主要落点 | 不做 |
| --- | --- | --- | --- | --- |
| 1 | 平台事实契约 | 让已存在 API 从 DB row 变成产品 contract | `shared`、`neptune-ai/server` | 不新增财务对象 |
| 2 | 错误信封与 SSE 门禁 | 先统一失败语义，避免后续页面各自兜底 | `shared`、`server`、`web` | 不改 engine stream 协议 |
| 3 | 多租户与配额硬拦截 | 先防跨租户和超额执行，再开放更多入口 | `server` | 不做完整商业计费 |
| 4 | 会话编排与协作 thread 收敛 | 把 chat 降级为运行调试入口 | `server`、`web` | 不以聊天作为产品中心 |
| 5 | RunEvent / ToolInvocation | 让运行详情可解释 | `server`、`web` | 不要求 engine 新事件 |
| 6 | Artifact / EvidenceArtifact | 让成果和证据成为事实对象 | `server`、`web` | 不把 transcript 当证据 |
| 7 | PolicyDecision / Audit 增强 | 记录工具、MCP、路径、模型、数据边界决策 | `server`、`web` | 不用 observability 替代 audit |
| 8 | 智能体版本治理 | 固化不可变快照和脱敏摘要 | `shared`、`server`、`web` | 不外露 prompt secret 和 credential |
| 9 | Skill / Memory 边界 | 把技能注册与记忆事实从文档/知识文件中分离 | `server`、`web` | 不把 Memory 混成知识库文件 |
| 10 | 治理台轻量版 | 让治理对象进入产品主入口 | `web`、`server` | 不依赖 chat 页面 |
| 11 | 关账工作台 MVP | 用财务场景验证平台内核 | `neptune-ai` | 不做财务引擎 |
| 12 | Eval / Release / Workflow 元数据 | 保留可升级和验收语义 | `server`、`web` | 不做云控制面和自动 rollback |

这 12 项不是 12 个并行功能，而是一条依赖链。前 9 项是平台事实地基，第 10 项是治理可见性，第 11 项是业务验证，第 12 项是持续升级语义。

## 3. 12 项可做事项与 `neptune-ai` 层映射

| 可做事项 | `neptune-ai/server` 映射 | `neptune-ai/web` 映射 | `shared` 映射 | 验收焦点 |
| --- | --- | --- | --- | --- |
| 1. 平台事实契约 | DTO mapper、分页、过滤、租户约束 | 平台事实 API client | `RunDto`、`AuditEventDto`、`AgentVersionSummaryDto` | 不泄漏 DB row 和敏感配置 |
| 2. 错误信封 | 统一 REST `ApiErrorEnvelope`、错误 taxonomy | 中文错误态、权限态、恢复动作 | `ApiErrorEnvelope` | 401/403/404/429/500 可测试 |
| 3. SSE 事件协议 | `event:error`、`requestId`、`runId`、结束事件 | 运行调试错误详情、断线恢复提示 | `ChatSseEvent` 扩展或兼容字段 | SSE 失败不变成静默空白 |
| 4. 多租户门禁 | tenant/project/user 检查、跨租户拒绝 | 无权限中文提示 | 只暴露必要上下文字段 | 所有列表和详情按租户隔离 |
| 5. 配额硬拦截 | dispatch 前 quota gate、并发 gate、usage 预估 | 配额不足提示、成本概览 | `UsageSummary` 可先轻量 | 超额不会启动 Run |
| 6. 会话编排 | `ThreadManager` 绑定 Run、AgentVersion、Audit | `Collaborate` 改为运行调试 | `ThreadDto` 保持兼容 | Thread 是交互容器，不是平台中心 |
| 7. 协作 thread | thread history 关联运行、artifact、ask_user | 会话线程、运行输出、成果文件 | 既有 thread DTO 轻量演进 | 历史线程能追溯到 Run |
| 8. 可观测性 | requestId/runId/tenantId/version/model trace 关联 | 治理台展示运行耗时、模型、请求编号 | 不把 trace provider 写进 shared | observability 只辅助诊断 |
| 9. 智能体版本 | 不可变版本、hash、脱敏摘要、版本查询 | 智能体版本页 | `AgentVersionSummaryDto` | 历史 Run 绑定版本 |
| 10. Skill / Memory | Skill registry 状态、MemoryRecord 来源/过期/审计 | 技能目录、后置记忆管理入口 | 暂缓完整 DTO | 技能和记忆不污染 engine |
| 11. 审计与策略 | Audit taxonomy、PolicyDecision 持久化 | 审计事件、策略决策列表 | `AuditEventDto`，后续 `PolicyDecisionDto` | 关键动作 append-only |
| 12. 工作流编排 | Close workflow 状态机、Review/Approval/Waiver | 关账工作台、复核队列、报告 | 暂不进入 shared，先 server domain DTO | chat plan 不等于业务 workflow |

## 4. 阶段路线

### 阶段 0：固化当前平台事实

目标：把已有 `/runs`、`/audit-events`、`/agents/:agentId/versions` 变成稳定产品契约。

交付物：

- `RunDto`、`AuditEventDto`、`AgentVersionSummaryDto`、列表响应 DTO。
- server DTO mapper，禁止直接返回 DB row。
- REST error envelope 行为一致。
- SSE `event:error` 行为明确，至少包含中文可映射错误码、`requestId`、可选 `runId`。
- AgentVersion snapshot 只返回脱敏摘要、版本号、模型、工具/技能数量、hash、创建时间。

验收：

- 治理台可以只读展示运行记录、审计事件、智能体版本。
- 未认证、跨租户、分页、过滤、资源不存在都有测试。
- prompt、MCP auth config、credential 不进入 API 响应。

测试：

- server API contract 测试。
- error envelope 单元/集成测试。
- SSE 错误事件测试。

风险门禁：

- 若发现 API 需要泄漏完整 snapshot 才能展示页面，停止实现，先重做 DTO 摘要。
- 若需要修改 `neptune-engine` 才能完成阶段 0，说明边界设计错误，必须退回 adapter/server 方案。

### 阶段 1：补平台内核事实对象

目标：一次 Run 能解释执行过程、证据、策略、复核、工具调用和成本。

交付物：

- `RunEvent` 与 `ToolInvocation` 持久化模型和详情查询。
- `Artifact` 与 `EvidenceArtifact` 元数据：类型、来源、hash、storageUri、runId、createdBy。
- `PolicyDecision`：策略类型、结果、原因、关联工具/MCP/模型/路径、runId、requestId。
- `HumanReview`：待复核、批准、退回、豁免、责任人、原因、审计引用。
- `UsageRecord` 或 Run 级 usage/cost 绑定。
- dispatch 前 quota gate 和并发 gate。
- `AuditEvent` 增强：runId、versionRef、actor、resource taxonomy、outcome。

验收：

- 一次 controlled Run 至少能产生 `Run`、`RunEvent`、`ToolInvocation`、`Artifact/Evidence`、`PolicyDecision`、`AuditEvent`、`UsageRecord` 中的核心链路。
- Run detail 能按时间线展示运行事件、工具调用、成果文件、策略决策、成本用量、审计链。
- 配额不足时 Run 不启动，且写入可解释的拒绝事实或审计事件。

测试：

- DB migration/schema 测试或 migration snapshot 检查。
- Run lifecycle 集成测试。
- quota deny 测试。
- audit append-only 测试。

风险门禁：

- Artifact/Evidence 只能存元数据和 hash，文件内容进入文件系统或对象存储，不让 PostgreSQL 变成大文件仓库。
- Redis 只做短期计数和并发 gate，不能成为审计事实来源。
- Langfuse/trace 只能辅助诊断，不能替代 `AuditEvent`。

### 阶段 2：治理台轻量版

目标：客户技术治理方可以看见和追责，不再依赖聊天页面理解系统。

交付物：

- `/governance/runs`：运行记录列表和详情。
- `/governance/audit-events`：审计事件列表、过滤、关联运行。
- `/governance/agent-versions`：智能体版本摘要和版本详情。
- `/governance/costs`：成本概览和配额使用率。
- `/governance/policy-decisions`：策略决策只读列表。
- 中文导航、页面标题、表格列、空状态、错误态、权限态。

验收：

- 主导航出现 `交付台 / 治理台 / 关账工作台`，不再以 `Home / Agents / Skills / Collaborate` 表达主产品骨架。
- 治理台所有页面消费真实 server API，不做孤立 mock。
- E2E 覆盖导航、API 加载、空状态、401/403、失败运行筛选。

测试：

- frontend component/API client 测试。
- Playwright E2E：中文主导航、运行记录页、审计事件页、智能体版本页。
- server contract 回归测试。

风险门禁：

- 治理台第一版只读，不引入复杂运维控制面。
- 页面不能展示完整 prompt、credential、MCP auth。
- 如果某页面只能靠 mock 数据成立，不能进入完成状态。

### 阶段 3：关账工作台 MVP

目标：用中国 ERP 财务月结关账跑通受控委托主路径。

交付物：

- `CloseWorkspace`、`AccountingPeriod`、`CloseChecklist`、`ControlRule`。
- `Finding`、`Evidence`、`Review / Approval / Waiver`、`CloseReadinessReport`。
- mock dataset 和总账完整性检查模板前三条规则：
  - 未过账凭证检查；
  - 会计期间状态检查；
  - 凭证编号连续性检查。
- 关账工作台页面：期间总览、检查清单、异常发现、证据中心、复核队列、关账报告。

验收主路径：

```text
创建客户项目
  -> 创建关账工作区
  -> 选择总账完整性检查模板
  -> 绑定 mock dataset
  -> 发起关账检查运行
  -> 生成证据与异常发现
  -> 财务用户处理异常
  -> 复核人复核
  -> 审批人豁免/退回/批准
  -> 生成关账就绪报告
  -> 保留审计链与运行追踪
```

测试：

- close workspace service 测试。
- finding/review/report 状态机测试。
- 关账主路径 E2E。
- 审计链断言：每个复核、批准、退回、豁免动作都有 `AuditEvent`。

风险门禁：

- 不回写 ERP，不自动过账，不自动批准豁免。
- Solution Pack 可以强绑定财务语义，但只能存在于 `neptune-ai` 的业务应用服务和 solution pack 服务。
- 关账报告不是模型回答副本，必须是 Run、Evidence、Finding、Review、Audit 的事实链快照。

### 阶段 4：CSV/Excel 真实输入

目标：从演示闭环进入中国企业可落地的数据入口。

交付物：

- CSV/Excel import。
- evidence schema validation。
- file hash、source、period、ledger、account set metadata。
- 导入行为写 audit。
- 导入结果成为 `EvidenceArtifact`，并可关联 Run、Finding、Report。

验收：

- 用户可以导入凭证列表、科目余额表或辅助账明细样例文件。
- schema 不匹配时给出中文错误和可恢复动作。
- 文件 hash、导入人、导入时间、关联期间进入证据中心。
- 导入证据能参与至少一条关账检查规则。

测试：

- CSV/Excel parser service 测试。
- schema validation 测试。
- 文件 hash 和 audit 测试。
- 导入失败 UI/E2E 测试。

风险门禁：

- 不做 ERP 深度连接、回写 ERP、自动过账、复杂集团合并。
- 不把导入文件内容当作 Memory 或知识库文档处理。
- 敏感数据边界必须默认按客户侧数据平面处理。

### 阶段 5：本地发布 / 评估 / 升级元数据

目标：保留持续可升级语义，但不建设重型云控制面。

交付物：

- `EvalRun`：dataset、agentVersion、solutionPackVersion、结果摘要。
- `ReleaseVersion`：platform、solution pack、connector、rule、report template 版本元数据。
- `UpgradeAssessment`：影响对象、兼容性、建议动作。
- stable / preview / security metadata。
- pre-upgrade eval 和 impact report。
- upgrade audit。

验收：

- 任一关账 Run 都能解释它使用的智能体版本、规则版本、模板版本、数据版本和报告模板版本。
- 版本升级不改变历史 Run、Evidence、Finding、Report 的解释。
- 本地评估集可以在升级前运行并产生可追溯 `EvalRun`。

测试：

- version binding 测试。
- eval run contract 测试。
- upgrade assessment 生成测试。
- 历史 Run 不变性回归测试。

风险门禁：

- 不做 Neptune Cloud Control Plane。
- 不做签名包分发、connector marketplace、自动 rollback、多环境灰度。
- 只保留本地发布和升级元数据，为未来 hybrid control plane 留接口语义。

## 5. 横向治理门禁

### 5.1 `neptune-engine` 边界门禁

任何 PR 只要触碰 `neptune-engine/`，必须默认判定为越界，除非另有单独设计审批。当前路线下的正确做法是：

- engine 已有能力通过 adapter 使用。
- 产品对象在 `neptune-ai/server` 建模。
- 财务语义在 Solution Pack 服务建模。
- runtime 事件缺口先在 server adapter 侧归一化。

### 5.2 多租户门禁

每个 API 必须回答：

- 当前 actor 属于哪个 tenant。
- 当前资源属于哪个 tenant/project。
- 跨租户访问返回什么错误信封。
- 审计事件是否记录 actor、tenant、resource、outcome。

最低测试：

- 未认证拒绝。
- 跨租户列表不可见。
- 跨租户详情不可访问。
- 跨租户 mutation 不产生业务事实。

### 5.3 会话编排与协作 thread 门禁

Thread 只能作为交互容器和调试入口，不能替代 Run。

要求：

- 每次执行必须创建或绑定 Run。
- Thread history 必须能追溯关联 Run。
- ask_user、artifact、plan、error 都要挂回 Run detail。
- `Collaborate` 用户可见名称改为 `运行调试`。

### 5.4 可观测性门禁

可观测性服务负责诊断，不负责合规事实。

要求：

- trace 关联 `requestId`、`runId`、`tenantId`、`agentVersion`、`model`。
- audit 独立持久化，append-only。
- trace provider 不可用时，Run 和 Audit 仍然成立。

### 5.5 错误信封与 SSE 门禁

REST 和 SSE 失败语义必须一致。

要求：

- REST 返回统一 `ApiErrorEnvelope`。
- SSE 必须有 `event:error`，不能只断流。
- 错误必须包含稳定 code、中文可映射 message、`requestId`。
- 前端必须有中文错误态和恢复动作。

### 5.6 智能体版本门禁

运行必须绑定不可变智能体版本。

要求：

- Run 记录 `agentTemplateVersionId` 或等价 versionRef。
- 对外只展示脱敏摘要和 hash。
- 删除或修改当前模板不影响历史 Run 解释。
- 版本 diff 和完整 snapshot 访问需要权限分级，第一阶段不默认开放。

### 5.7 Memory 与 Skill 门禁

Skill 是可复用能力，Memory 是来源明确、可过期、可审计的记忆事实；二者都不能混成普通文档。

要求：

- Skill CRUD 逐步演进为 Skill registry，包含版本、状态、绑定关系、验收状态。
- MemoryRecord 必须有来源、作用域、过期策略、创建 Run、审计引用。
- documents/category 可以作为过渡，但不能成为最终语义边界。

### 5.8 审计门禁

关键动作必须写 append-only 审计事件。

最低覆盖：

- 创建/修改客户项目。
- 创建智能体版本。
- 发起/取消/失败/完成 Run。
- 工具或 MCP 策略拒绝。
- 导入证据。
- 提交复核、批准、退回、豁免。
- 生成和导出关账报告。
- 版本升级评估和发布元数据变更。

### 5.9 配额门禁

配额必须在执行前拦截，而不是事后记账。

要求：

- dispatch 前检查租户、项目、智能体或模型维度 quota。
- 超额不启动 Run。
- 超额结果进入中文错误态，并可写审计或策略决策。
- usage/cost 必须绑定 Run，不能只做租户级散账。

### 5.10 工作流编排门禁

业务 workflow 不是 chat plan。

要求：

- 关账检查、异常处理、复核、批准、豁免、报告生成必须有显式状态机。
- 状态迁移要有 actor、reason、timestamp、auditEventId。
- 不允许智能体自动越过人工复核和批准。

## 6. 最小验证矩阵

| 范围 | 必跑验证 | 通过标准 |
| --- | --- | --- |
| shared DTO | typecheck 或 contract test | DTO 不泄漏 DB row 和敏感字段 |
| platform facts API | server test | 分页、过滤、未认证、跨租户、404、error envelope 通过 |
| SSE | server/web 集成测试 | error、done、requestId、runId 行为稳定 |
| quota gate | server test | 超额不创建 running Run |
| audit | server test | 关键动作 append-only 且可按 runId 查询 |
| governance UI | E2E | 中文导航、运行记录、审计事件、版本页、401/403 通过 |
| close workspace | service + E2E | 关账主路径可从工作区走到报告 |
| import evidence | service + UI test | schema 错误可恢复，成功导入有 hash 和 audit |
| release/eval | contract test | 历史 Run 版本解释不变 |

## 7. 风险与防线

| 风险 | 后果 | 防线 |
| --- | --- | --- |
| 先做财务 UI，不补平台事实 | 退化成财务 SaaS demo | 阶段 1 前不得宣称关账工作台完成 |
| 继续以聊天为中心 | 产品心智错误 | 主入口改为交付台、治理台、关账工作台 |
| 修改 `neptune-engine` 承载产品语义 | runtime 被污染，平台不可复用 | 所有业务和治理对象留在 `neptune-ai` |
| shared 过早冻结对象 | contract 被错误设计绑死 | 只有已有持久化模型和真实消费者才进入 shared |
| AgentVersion 外泄 | prompt、credential、MCP auth 风险 | mapper 默认脱敏摘要 |
| observability 替代 audit | 合规不可用 | audit 独立 append-only |
| 配额只事后记账 | 成本失控 | dispatch 前 hard gate |
| Memory 混入 documents | 来源、过期、审计不可控 | MemoryRecord 单独建模，documents 只过渡 |
| 关账报告复制模型回答 | 无法审计和复核 | 报告必须引用 Run/Evidence/Finding/Review/Audit |

最终判断：

**第一阶段不是做更多智能体功能，而是把智能体执行变成企业能委托、能复核、能审计、能升级的生产事实。**
