# Neptune AgentOps 产品架构与服务规划设计

日期：2026-05-22

状态：设计规划

参考战略源文档：`docs/strategy/neptune-agentops-platform-strategy.md`

---

## 0. 结论

Neptune 当前阶段不应继续围绕“聊天体验”堆功能，也不应提前拆微服务、做云控制面或修改 `neptune-engine`。正确路线是：

1. 在 `neptune-ai/server` 固化 AgentOps Platform Core 的生产事实链。
2. 在 `neptune-ai/web` 重建中文产品入口：交付台、治理台、关账工作台。
3. 用中国 ERP 财务月结关账 Solution Pack 验证平台内核，而不是把 Neptune 做成财务 SaaS。
4. 保持 `neptune-engine` 为 Runtime Kernel，只承接通用执行能力，不承接财务语义、审计责任或产品治理对象。

平台中心对象是 `Controlled Run`，不是 `Conversation`。

最小主链是：

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

这条链决定服务规划、数据模型、API、UI 和测试顺序。

---

## 1. 设计原则

### 1.1 受控委托优先

企业不会把最终业务责任交给模型。Neptune 的产品责任是证明：

- 智能体在什么权限下行动；
- 使用了什么 Agent、规则、模型、连接器和模板版本；
- 读取了什么证据；
- 产出了什么发现；
- 谁复核、批准、退回或豁免；
- 历史 Run 在版本升级后仍可解释。

因此所有产品能力必须落到 `Run / Evidence / Finding / Review / Audit / Version` 事实对象上。

### 1.2 产品层承载企业语义

`neptune-ai/server` 是产品编排层和平台服务层，必须承载：

- 租户、项目、权限；
- Agent registry 与版本；
- Run lifecycle；
- 证据与 artifact；
- 审计、复核、成本、配额；
- Solution Pack 业务对象。

`neptune-engine` 只负责：

- LLM 调用；
- 工具执行；
- MCP；
- streaming；
- runtime trace；
- 通用 artifact hook / policy hook / review hook 语义。

禁止把财务、ERP、关账、凭证、科目余额表、审计报告等业务语义下沉到 `neptune-engine`。

### 1.3 先本地 Architecture MVP，后混合控制面

当前阶段保留未来 hybrid deployment 语义，但不建设重型控制面。

第一阶段只做：

- 本地项目版；
- 可演进到客户私有化的单环境部署；
- 本地版本、审计、证据、评估和升级元数据。

后置：

- Neptune Cloud Control Plane；
- 签名包分发；
- connector marketplace；
- 自动 rollback；
- 多环境灰度；
- 完整商业计费和发票。

---

## 2. 当前事实

### 2.1 已有能力

`neptune-ai/server` 已有：

- `tenants`：包含基础 quota 与 billing config；
- `users`：基础租户用户；
- `agent_templates`：智能体配置，含 prompt、model、tools、skills、MCP、constraints、version；
- `agent_template_versions`：运行时智能体配置快照；
- `sessions`：当前 Thread / workspace 元数据；
- `billing_records`：基础 token usage / cost；
- `runs`：受控执行事实雏形；
- `audit_events`：append-only 审计雏形；
- `documents`：document / memory / knowledge 文件元数据；
- `skills` 和 `agent_skills`：Skill CRUD 与 Agent 绑定；
- `ThreadManager.dispatch()`：串接 AgentVersion、Run、engine factory、SSE、Cost、Audit；
- `platform-facts` API：`/runs`、`/audit-events`、`/agents/:agentId/versions`。

`neptune-ai/web` 已有：

- Agent 管理；
- Skill 管理；
- Collaborate chat；
- Thread list/history；
- SSE chat UI；
- plan / artifact / ask_user UI；
- 基础 auth、navigation、E2E 测试。

`shared/types/neptune-ai` 已有：

- REST error envelope；
- Agent / Thread DTO；
- Chat SSE event；
- Chat view block；
- Observability request context。

### 2.2 核心缺口

当前系统仍主要是“Thread/SSE 驱动的 Agent 产品编排层”。距离 AgentOps Platform Core 还缺：

- `CustomerProject`
- `Connector / ConnectorVersion`
- `RunEvent`
- `ToolInvocation`
- `Artifact / EvidenceArtifact`
- `PolicyDecision`
- `HumanReview`
- `EvalRun`
- `ReleaseVersion`
- `UsageRecord` 与 Run 级绑定
- 配额硬拦截
- 业务工作流状态机
- MemoryRecord
- 治理台
- 关账工作台

---

## 3. 目标产品架构

```text
┌────────────────────────────────────────────────────────────────────┐
│                         neptune-ai/web                             │
│                                                                    │
│  交付台                  治理台                    关账工作台          │
│  项目装配/运行调试        运行/审计/成本/版本        期间/证据/复核/报告 │
└───────────────────────────────┬────────────────────────────────────┘
                                │ REST / SSE / typed DTO
┌───────────────────────────────▼────────────────────────────────────┐
│                       neptune-ai/server                            │
│                                                                    │
│  业务应用服务                                                       │
│    CloseWorkspace / AccountingPeriod / Checklist / Finding         │
│    Review / Approval / Report                                      │
│                                                                    │
│  Solution Pack Services                                            │
│    CloseChecklistTemplate / ControlRule / EvidenceSchema           │
│    ReportTemplate / SampleDataset / ConnectorAdapter               │
│                                                                    │
│  AgentOps Platform Services                                        │
│    Project / AgentRegistry / RunControl / ArtifactEvidence         │
│    Policy / ConnectorRegistry / Review / Audit / CostQuota         │
│    Observability / Workflow / Memory / Eval / Release              │
│                                                                    │
│  Engine Adapter / Runtime Boundary                                 │
│    只传通用执行上下文、工具、MCP、policy/artifact hook 语义             │
└───────────────────────────────┬────────────────────────────────────┘
                                │ runtime API
┌───────────────────────────────▼────────────────────────────────────┐
│                         neptune-engine                             │
│  LLM / tools / MCP / streaming / trace / runtime lifecycle          │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. 服务规划

### 4.1 平台内核服务

| 服务 | 职责 | 当前状态 | 第一阶段动作 |
| --- | --- | --- | --- |
| `ProjectService` | 客户项目、环境、成员、业务 workspace 归属 | 缺失 | 新增 `customer_projects`，替代 Thread workspace 承担项目语义 |
| `AgentRegistryService` | Agent 元数据、版本 diff、状态、项目绑定 | 有 `AgentTemplateService` | 收敛 Agent registry 语义，保留现有 AgentTemplate |
| `AgentVersionService` | 不可变智能体运行快照 | 已有雏形 | 增加 DTO、脱敏摘要、hash、版本查询契约 |
| `RunControlService` | Run lifecycle、RunEvent、ToolInvocation、取消/重试 | 有 `RunService` | 从 `RunService` 演进，不把 Run 限定为 chat |
| `ArtifactEvidenceService` | Artifact/Evidence 元数据、hash、source、storageUri、run 绑定 | 缺失 | 新增核心表和查询 API |
| `PolicyService` | 工具、MCP、路径、模型、数据出域决策 | 有 `TenantPermissionDelegate` | 持久化 `PolicyDecision`，写 audit |
| `ConnectorRegistryService` | Connector、ConnectorVersion、credentialRef、health check | 现在嵌在 AgentTemplate.mcpServers | 抽出 registry，但不做 marketplace |
| `ReviewService` | HumanReview、Approval、Waiver、Return、责任链 | 只有 ask_user/reply | 新增 review queue 与 decision facts |
| `AuditTrailService` | append-only 审计、taxonomy、导出、保留策略 | 有 `AuditEventService` | 扩 action/resource/outcome/runId/versionRef |
| `CostQuotaService` | Run 级 usage、cost、quota、并发硬拦截 | 有 CostAggregator | 增加 pre-dispatch quota gate |
| `ObservabilityService` | requestId/runId/tenantId/version/model/policy trace 关联 | 有 Langfuse NoOp/Provider | 补 metrics 与 Run dashboard 数据 |
| `WorkflowService` | 业务流程状态机 | 只有 PlanManager | 不把 chat plan 当 workflow，新增业务状态机 |
| `MemoryService` | MemoryRecord、检索、来源、过期、审计 | documents.category 临时承载 | 后置，先不混入 knowledge/documents |
| `EvalService` | EvalRun、dataset、版本回归、acceptance gate | 缺失 | Solution Pack MVP 后启动 |
| `ReleaseService` | ReleaseVersion、channel、impact report、upgrade audit | 缺失 | 本地 release metadata，后置 cloud control |
| `SkillRegistryService` | SkillVersion、依赖、验收、发布状态 | 有 Skill CRUD | 从 CRUD 演进为 registry |

### 4.2 业务应用服务

第一 Solution Pack 是中国 ERP 财务月结关账，业务服务只在 `neptune-ai` 层：

| 服务 | 职责 | Platform Core 映射 |
| --- | --- | --- |
| `CloseWorkspaceService` | 某客户、组织、账套、期间的关账空间 | `CustomerProject` + domain workspace |
| `AccountingPeriodService` | 会计期间与检查范围 | Run context / domain period |
| `CloseChecklistService` | 检查清单模板、实例、状态 | `AgentTemplateVersion` + rule plan |
| `ControlRuleService` | 控制项、严重性、owner、reviewer、approver | Policy/tool plan |
| `EvidenceService` | 凭证、余额表、辅助账、回单、发票、审批记录 | `EvidenceArtifact` |
| `FindingService` | 异常发现、severity、owner、证据引用 | domain finding + Run/Artifact refs |
| `CloseReviewService` | 复核、退回、批准、豁免 | `HumanReview` |
| `CloseReportService` | 关账就绪报告 | report artifact + audit snapshot |

---

## 5. Web 信息架构与中文交互规范

当前 `Home / Agents / Skills / Collaborate` 会把 Neptune 误导成聊天应用，而且英文菜单会增加理解成本。用户可见的信息架构必须改成中文。

这不是把英文按钮逐个翻译成中文，而是重建 Neptune 的产品语言层：

- 交付团队看到的是“客户项目、智能体模板、技能、试运行、验收”；
- 治理团队看到的是“运行记录、审计事件、版本、成本、策略决策”；
- 财务业务用户看到的是“会计期间、检查清单、异常发现、证据、复核、关账报告”。

用户主界面必须用中文表达业务动作和责任事实。英文只允许出现在：

- 路由路径，如 `/governance`；
- 代码标识符，如 `RunDto`；
- 协议字段，如 `requestId`；
- 第三方产品名，如 PostgreSQL、Redis、Langfuse；
- 必须保留的技术缩写，如 CSV、Excel、ERP、SSE。

### 5.1 主菜单

```text
交付台
  交付概览
  智能体模板
  技能目录
  运行调试

治理台
  运行记录
  审计事件
  智能体版本
  成本概览
  策略决策

关账工作台
  期间总览
  检查清单
  异常发现
  证据中心
  复核队列
  关账报告
```

旧页面迁移关系：

- `/agents` -> 交付台 / 智能体模板
- `/skills` -> 交付台 / 技能目录
- `/collaborate` -> 交付台 / 运行调试，或某个运行记录的交互面板
- 新增 `/governance` -> 治理台，只读展示运行记录、审计事件、智能体版本、成本、策略决策
- 新增 `/workspace/close-readiness` -> 关账工作台

`Collaborate` 不删除，但对用户不再叫“协作”或“聊天”。它降级为“运行调试”或“运行详情中的交互面板”，不再作为产品主入口。

### 5.2 用户可见命名

| 内部对象 | 用户可见名称 | 使用场景 |
| --- | --- | --- |
| `Run` | 运行记录 | 治理台列表、运行详情、审计关联 |
| `RunEvent` | 运行事件 | 运行详情时间线 |
| `ToolInvocation` | 工具调用 | 运行详情、调试视图 |
| `Artifact` | 成果文件 | 交付台、运行详情 |
| `EvidenceArtifact` | 证据 | 关账工作台、审计视图 |
| `Finding` | 异常发现 | 关账工作台主对象 |
| `HumanReview` | 人工复核 | 复核队列、异常详情 |
| `Approval` | 批准 | 异常处理结果 |
| `Waiver` | 豁免 | 异常处理结果 |
| `AuditEvent` | 审计事件 | 治理台 |
| `AgentTemplateVersion` | 智能体版本 | 治理台、智能体模板详情 |
| `PolicyDecision` | 策略决策 | 治理台 |
| `UsageRecord` | 用量记录 | 成本概览 |
| `CustomerProject` | 客户项目 | 交付台 |
| `CloseWorkspace` | 关账工作区 | 关账工作台 |
| `AccountingPeriod` | 会计期间 | 期间总览 |
| `CloseReadinessReport` | 关账就绪报告 | 报告页 |

### 5.3 页面设计

#### 交付台

交付台面向 SI / AI 交付团队，任务是把客户项目、智能体模板、技能、连接器、数据源和试运行组织起来。用户不应该先看到聊天框，而应该先看到“我正在交付哪个客户项目、用了哪些模板、最近运行是否成功”。

页面：

- 交付概览：客户项目、最近运行、待处理配置、验收状态；
- 智能体模板：智能体配置、模型、工具、技能、知识库、版本；
- 技能目录：技能创建、上架、停用、绑定智能体；
- 运行调试：发起试运行、查看流式输出、工具调用、成果文件、错误详情。

关键按钮：

- 新建客户项目
- 新建智能体模板
- 绑定技能
- 上传知识文件
- 发起试运行
- 查看运行详情
- 复制为新版本

#### 治理台

治理台面向客户技术治理方，任务是回答“这次智能体行为是否可解释、可审计、可追责、成本是否受控”。治理台第一版只读，不做复杂运维控制面。

页面：

- 运行记录：所有受控执行的状态、版本、模型、输入用量、输出用量、耗时、发起人；
- 审计事件：谁在何时对什么资源做了什么动作，结果如何；
- 智能体版本：智能体运行快照、脱敏摘要、版本 hash、创建人；
- 成本概览：按租户、项目、智能体、模型聚合的用量与成本；
- 策略决策：工具、MCP、路径、模型、数据出域等策略判断记录。

运行记录表格字段：

- 运行编号
- 状态
- 智能体
- 智能体版本
- 会话/线程
- 发起人
- 模型
- 输入用量
- 输出用量
- 开始时间
- 完成时间
- 请求编号

审计事件表格字段：

- 时间
- 操作
- 资源类型
- 资源编号
- 执行人
- 结果
- 请求编号
- 关联运行

关键按钮：

- 查看详情
- 查看审计链
- 导出审计记录
- 查看关联会话
- 查看智能体版本
- 筛选失败运行

#### 关账工作台

关账工作台面向客户业务责任方，任务是回答“本期是否具备关账条件”。页面围绕会计期间和异常处理组织，不围绕聊天组织。

页面：

- 期间总览：会计期间、账套、检查通过率、高风险异常、待复核数量；
- 检查清单：控制项、状态、严重性、负责人、复核人；
- 异常发现：异常描述、证据、影响范围、处理建议、状态；
- 证据中心：凭证、余额表、辅助账、银行回单、发票、审批流、CSV/Excel 导入表；
- 复核队列：待复核、已批准、已退回、已豁免；
- 关账报告：报告摘要、异常结论、证据索引、审计摘要、导出记录。

关键按钮：

- 创建关账工作区
- 选择会计期间
- 导入 CSV/Excel
- 发起关账检查
- 查看证据
- 指派负责人
- 标记已处理
- 提交复核
- 批准豁免
- 退回处理
- 生成关账报告
- 导出报告

### 5.4 状态文案

所有状态必须使用中文文案。内部枚举可以继续保留英文。

| 内部状态 | 中文文案 |
| --- | --- |
| `running` | 运行中 |
| `completed` | 已完成 |
| `failed` | 失败 |
| `cancelled` | 已取消 |
| `created` | 已创建 |
| `idle` | 空闲 |
| `draft` | 草稿 |
| `active` | 已启用 |
| `inactive` | 已停用 |
| `pending_review` | 待复核 |
| `approved` | 已批准 |
| `rejected` | 已退回 |
| `waived` | 已豁免 |
| `blocked` | 被阻塞 |

### 5.5 空状态和错误文案

空状态必须告诉用户下一步动作，不使用英文技术提示。

| 场景 | 中文文案 |
| --- | --- |
| 没有客户项目 | 还没有客户项目。请先创建客户项目，再配置 Agent 和数据源。 |
| 没有运行记录 | 暂无运行记录。发起一次试运行后，这里会显示执行过程和结果。 |
| 没有审计事件 | 暂无审计事件。系统会在关键操作发生后自动记录。 |
| 没有智能体版本 | 暂无智能体版本。首次运行时会自动生成不可变版本快照。 |
| 没有关账工作区 | 还没有关账工作区。请选择客户项目和会计期间创建工作区。 |
| 没有异常发现 | 当前没有异常发现。可以查看检查清单确认各控制项状态。 |
| 没有证据 | 暂无证据。请导入 CSV/Excel 或发起检查生成证据。 |
| 无权限 | 你没有权限访问该内容。请联系管理员开通权限。 |
| 运行失败 | 运行失败。请查看错误详情和审计事件。 |
| 服务不可用 | 服务暂时不可用。请稍后重试。 |

### 5.6 语言边界

页面标题、菜单、按钮、表格列、状态、空状态、错误提示、确认弹窗必须中文。

可以保留英文的内容：

- 产品名 Neptune；
- `Agent` 只能作为代码、API、技术括注或面向交付团队的二级说明出现；业务用户主路径默认显示 `智能体`；
- ERP、CSV、Excel、SSE、API、MCP；
- 路由、代码、协议字段；
- 模型名称和 provider 名称；
- 开发者调试视图中的原始事件名，但必须配中文解释。

禁止在用户主界面直接出现：

- `Delivery Console`
- `Governance Console`
- `Business Workspace`
- `Run Lab`
- `Audit Events`
- `Agent Versions`
- `Cost Snapshot`
- `Policy Decisions`
- `Close Readiness`
- `Finding`
- `EvidenceArtifact`
- `HumanReview`

这些可以作为代码注释、文件名或内部类型存在，但用户看到的必须是中文。

### 5.7 中文化调整摘要

后续前端改造必须按以下顺序落实中文化：

1. 主导航先改为 `交付台 / 治理台 / 关账工作台`，不再显示 `Home / Agents / Skills / Collaborate`。
2. 页面标题和面包屑使用中文，例如 `运行记录`、`审计事件`、`智能体版本`、`关账报告`。
3. 表格列名使用中文，例如 `运行编号`、`发起人`、`请求编号`、`完成时间`。
4. 操作按钮使用中文动词，例如 `发起试运行`、`查看审计链`、`提交复核`。
5. 状态使用中文，例如 `运行中`、`已完成`、`待复核`、`已豁免`。
6. 空状态必须给出下一步中文动作，不能只显示 `No data`、`Not found` 或 `Failed to load`。
7. 技术详情抽屉可以显示原始字段名，但必须有中文标签和中文解释。

### 5.8 页面级中文设计规范

中文化后的 Web 不应该保留“英文产品骨架 + 中文局部文案”的结构。每个页面必须同时满足：页面标题中文、主动作中文、状态中文、空状态中文、错误恢复路径中文。

#### 交付台 / 交付概览

页面目标：让交付团队一眼知道当前在交付哪些客户项目、哪些智能体可运行、哪些配置缺失、哪些运行失败。

首屏结构：

```text
页面标题：交付概览
主动作：新建客户项目
次动作：新建智能体模板 / 上传知识文件 / 发起试运行

核心区块：
  客户项目
  最近运行
  待处理配置
  验收状态
```

关键文案：

- `客户项目` 不叫 `Workspace`；
- `最近运行` 不叫 `Recent runs`；
- `待处理配置` 不叫 `Pending setup`；
- `验收状态` 不叫 `Acceptance`。

#### 交付台 / 智能体模板

页面目标：配置可复用智能体，不直接暴露 runtime 细节。

首屏结构：

```text
页面标题：智能体模板
主动作：新建智能体模板
次动作：复制为新版本 / 绑定技能 / 发起试运行

列表字段：
  名称
  状态
  模型
  已绑定技能
  最近运行
  当前版本
  更新时间
```

`Agent` 是代码和技术生态里的核心术语，但用户主路径默认显示 `智能体`。面向交付团队的首次说明可以写成 `智能体（Agent）`，后续统一使用 `智能体`；`Template`、`Prompt`、`Tool` 在用户主路径里分别显示为 `模板`、`提示词`、`工具`。

#### 交付台 / 技能目录

页面目标：让交付团队管理可复用能力，而不是管理文件。

首屏结构：

```text
页面标题：技能目录
主动作：上传技能
次动作：绑定智能体 / 停用技能 / 查看使用情况

列表字段：
  技能名称
  状态
  版本
  已绑定智能体
  创建人
  更新时间
```

`Skill` 在用户界面中统一显示为 `技能`；只有代码、API、文件名中保留 `Skill`。

#### 交付台 / 运行调试

页面目标：把现有 `Collaborate` 从聊天入口降级为试运行和调试入口。

首屏结构：

```text
页面标题：运行调试
主动作：发起试运行
次动作：选择智能体 / 上传测试文件 / 查看运行详情

核心区块：
  试运行输入
  流式输出
  工具调用
  成果文件
  错误详情
```

页面可以保留对话式输入，但产品文案不能把它叫 `Chat`、`Conversation` 或 `Collaborate`。用户看到的是 `试运行输入`、`运行输出`、`运行详情`。

#### 治理台 / 运行记录

页面目标：让客户治理方追溯每一次受控执行。

首屏结构：

```text
页面标题：运行记录
主动作：筛选失败运行
次动作：查看详情 / 查看审计链 / 查看关联会话

详情页标签：
  基本信息
  运行事件
  工具调用
  成果文件
  策略决策
  成本用量
  审计链
```

治理台不展示“模型思考很聪明”，只展示“事实是否可解释、成本是否可控、责任是否可追溯”。

#### 治理台 / 审计事件

页面目标：展示不可变责任事实。

首屏结构：

```text
页面标题：审计事件
主动作：导出审计记录
筛选项：时间范围 / 操作 / 资源类型 / 执行人 / 结果 / 关联运行

列表字段：
  时间
  操作
  资源类型
  资源编号
  执行人
  结果
  请求编号
  关联运行
```

审计页面的错误提示必须避免技术泄漏。`403` 显示为 `你没有权限访问该内容。请联系管理员开通权限。`，技术详情只放在展开项里。

#### 治理台 / 智能体版本

页面目标：回答“这次运行到底用了哪个不可变版本”。

首屏结构：

```text
页面标题：智能体版本
主动作：查看版本详情
列表字段：
  智能体
  版本
  版本摘要
  模型
  工具数量
  技能数量
  版本 hash
  创建人
  创建时间
```

版本详情默认只展示脱敏摘要，不展示完整 prompt、MCP auth config、credential。

#### 治理台 / 成本概览

页面目标：让客户看到用量、成本和配额风险。

首屏结构：

```text
页面标题：成本概览
筛选项：时间范围 / 客户项目 / 智能体 / 模型
指标：
  总调用次数
  输入用量
  输出用量
  估算成本
  配额使用率
```

用户主界面优先显示 `输入用量`、`输出用量`。需要精确计量时可以显示 `输入 Token 数`、`输出 Token 数`，但必须在界面附近用中文解释为 `模型输入/输出计量单位`。

#### 治理台 / 策略决策

页面目标：展示工具、模型、路径、MCP、数据出域等策略判断事实。

首屏结构：

```text
页面标题：策略决策
筛选项：时间范围 / 决策结果 / 策略类型 / 关联运行
列表字段：
  时间
  策略类型
  决策结果
  原因
  关联工具
  关联运行
  请求编号
```

内部字段 `allow / deny / review_required` 用户可见文案分别为 `允许`、`拒绝`、`需要人工复核`。

#### 关账工作台 / 期间总览

页面目标：让财务用户判断“本期是否具备关账条件”。

首屏结构：

```text
页面标题：期间总览
主动作：发起关账检查
次动作：选择会计期间 / 导入 CSV/Excel / 生成关账报告

指标：
  检查通过率
  高风险异常
  待复核
  已豁免
  证据数量
```

关账工作台禁止以聊天作为首屏。AI 只能隐藏在检查、证据和建议背后。

#### 关账工作台 / 异常发现

页面目标：承接智能体发现的业务问题，并进入责任处理流程。

首屏结构：

```text
页面标题：异常发现
主动作：指派负责人
次动作：查看证据 / 标记已处理 / 提交复核 / 退回处理 / 批准豁免

列表字段：
  异常编号
  严重性
  异常描述
  影响范围
  负责人
  状态
  关联证据
  更新时间
```

`Finding` 用户可见文案统一为 `异常发现`，不能显示成 `发现`、`问题`、`Finding` 混用。

#### 关账工作台 / 证据中心

页面目标：集中管理可审计证据，不把文件列表当知识库。

首屏结构：

```text
页面标题：证据中心
主动作：导入 CSV/Excel
次动作：查看证据 / 关联异常 / 下载原文件

列表字段：
  证据名称
  证据类型
  来源
  文件 hash
  关联运行
  关联异常
  导入人
  导入时间
```

`Artifact` 在交付台可叫 `成果文件`；在关账工作台，当它承担审计事实时必须叫 `证据`。

#### 关账工作台 / 复核队列

页面目标：让责任人完成复核、退回、批准、豁免。

首屏结构：

```text
页面标题：复核队列
筛选项：待复核 / 已批准 / 已退回 / 已豁免
主动作：提交复核
次动作：批准 / 退回处理 / 批准豁免
```

复核动作必须明确责任后果。确认弹窗不能只显示 `Confirm`，必须写明：`批准后将写入审计事件，并关联当前运行记录。`

#### 关账工作台 / 关账报告

页面目标：生成可交付、可追溯的关账就绪结论。

首屏结构：

```text
页面标题：关账报告
主动作：生成关账报告
次动作：导出报告 / 查看审计摘要 / 查看证据索引

报告结构：
  结论摘要
  检查范围
  异常汇总
  证据索引
  复核与豁免
  审计摘要
```

报告不是模型回答的拷贝，而是事实链快照。

### 5.9 中文文案系统

后续前端实现应先建立集中式中文文案层，例如 `web/src/i18n/zh-CN.ts` 或 `web/src/copy/zh-CN.ts`。第一阶段不需要多语言切换，但需要把用户可见文案从组件里收敛出来，避免同一对象出现多种译法。

建议文案分组：

| 分组 | 内容 |
| --- | --- |
| `navigation` | 主导航、二级菜单、面包屑 |
| `pages` | 页面标题、区块标题、说明 |
| `actions` | 按钮、菜单动作、批量操作 |
| `statuses` | 运行、版本、技能、复核、策略状态 |
| `emptyStates` | 空状态标题、说明、下一步动作 |
| `errors` | 用户可见错误、权限错误、服务错误、表单错误 |
| `tables` | 表格列名、筛选项、排序字段 |
| `confirmations` | 删除、批准、豁免、退回、导出确认 |
| `technicalHints` | 对 Token、SSE、MCP、API、hash 等术语的中文解释 |

统一动作词：

| 英文动作 | 中文动作 |
| --- | --- |
| Create | 新建 |
| Save | 保存 |
| Cancel | 取消 |
| Delete | 删除 |
| Edit | 编辑 |
| View | 查看 |
| Start | 发起 |
| Retry | 重试 |
| Export | 导出 |
| Upload | 上传 |
| Import | 导入 |
| Assign | 指派 |
| Approve | 批准 |
| Reject | 退回 |
| Waive | 豁免 |
| Filter | 筛选 |
| Search | 搜索 |
| Copy | 复制 |

统一对象词：

| 英文对象 | 中文对象 |
| --- | --- |
| Home | 交付概览 |
| Agents | 智能体模板 |
| Skills | 技能目录 |
| Collaborate | 运行调试 |
| Thread | 会话线程 |
| Conversation | 会话 |
| Message | 消息 |
| Prompt | 提示词 |
| Tool | 工具 |
| Artifact | 成果文件 |
| Evidence | 证据 |
| Run | 运行记录 |
| Audit | 审计 |
| Version | 版本 |
| Cost | 成本 |
| Quota | 配额 |
| Workspace | 工作区 |

删除确认文案必须中文且表达后果：

```text
删除智能体模板？
删除后，该模板将无法再发起新的试运行；历史运行记录和审计事件仍会保留。
请输入确认码继续。
```

加载与错误文案必须中文且表达恢复路径：

```text
正在加载运行记录...
运行记录加载失败。请检查服务是否可用，或稍后重试。
你没有权限访问该内容。请联系管理员开通权限。
服务暂时不可用。请稍后重试。
```

### 5.10 前端实施验收标准

中文化改造进入实现时，验收不以“页面能打开”为准，而以“用户不需要理解英文产品词也能完成主路径”为准。

最低验收：

1. 主导航不再显示 `Home / Agents / Skills / Collaborate`，改为 `交付台 / 治理台 / 关账工作台`。
2. 所有页面标题、二级菜单、面包屑、主按钮、危险按钮、空状态、错误提示、确认弹窗为中文。
3. 现有 `Login` 页面中文化：`欢迎回来`、`创建账号`、`邮箱`、`密码`、`登录`、`注册`、`请稍候...`。
4. 现有 `AgentConfig` 页面中文化：`返回智能体模板`、`全部智能体`、`保存资料`、`保存配置`、`删除智能体模板`。
5. 现有 `Skills` 页面中文化：`技能目录`、`我的技能`、`保存`、`编辑`、`删除技能`、`草稿`、`已启用`。
6. 现有 `Collaborate` 页面改名为 `运行调试`，线程相关文案显示为 `新建会话线程`、`会话线程`、`运行输出`。
7. `title`、`aria-label`、tooltip、placeholder 也必须中文，不能只改可见正文。
8. E2E 测试至少断言中文主导航、中文页面标题、中文空状态、中文错误提示。
9. 保留英文的地方必须属于技术白名单：路由、代码字段、协议字段、模型/provider 名称、`Agent`、`API`、`MCP`、`SSE`、`CSV`、`Excel`、`ERP`。
10. 禁止在用户主界面新增英文兜底文案，例如 `Loading...`、`No data`、`Error`、`Submit`、`Confirm`。

### 5.11 页面级 IA 验收表

后续实现必须按页面验收，而不是按组件验收。每个页面至少要明确路由、中文标题、主对象、核心区块、主动作、状态覆盖和 API 来源。

| 入口 | 路由建议 | 页面标题 | 主对象 | 核心区块 | 主动作 | 状态/空态要求 | API 来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 交付台 | `/` 或 `/delivery` | 交付概览 | 客户项目 | 客户项目、最近运行、待处理配置、验收状态 | 新建客户项目 | 无项目、无运行、配置缺失 | `customer_projects`、`runs` |
| 交付台 | `/agents` | 智能体模板 | 智能体模板 | 模板列表、版本摘要、技能绑定、知识文件 | 新建智能体模板 | 无模板、保存失败、删除确认 | `agent_templates`、`agent_template_versions` |
| 交付台 | `/skills` | 技能目录 | 技能 | 技能列表、发布状态、绑定智能体 | 上传技能 | 无技能、上传失败、停用确认 | `skills`、`agent_skills` |
| 交付台 | `/collaborate` | 运行调试 | 试运行 | 输入、流式输出、工具调用、成果文件、错误详情 | 发起试运行 | 无智能体、运行失败、服务不可用 | `sessions`、`runs`、SSE |
| 治理台 | `/governance/runs` | 运行记录 | 运行记录 | 列表、详情、运行事件、工具调用、成本用量 | 筛选失败运行 | 无运行、跨租户无权限、加载失败 | `platform-facts/runs` |
| 治理台 | `/governance/audit-events` | 审计事件 | 审计事件 | 列表、过滤、关联运行、导出 | 导出审计记录 | 无事件、无权限、导出失败 | `platform-facts/audit-events` |
| 治理台 | `/governance/agent-versions` | 智能体版本 | 智能体版本 | 版本摘要、hash、模型、工具/技能数量 | 查看版本详情 | 无版本、脱敏提示 | `agents/:id/versions` |
| 治理台 | `/governance/costs` | 成本概览 | 用量记录 | 成本指标、配额使用率、模型分布 | 查看成本明细 | 无用量、配额接近上限 | `usage_records`、`billing_records` |
| 治理台 | `/governance/policy-decisions` | 策略决策 | 策略决策 | 决策列表、原因、关联工具、关联运行 | 查看决策详情 | 无策略决策、拒绝原因为空 | `policy_decisions` |
| 关账工作台 | `/workspace/close-readiness` | 期间总览 | 会计期间 | 检查通过率、高风险异常、待复核、证据数量 | 发起关账检查 | 无工作区、无期间、无数据源 | `close_workspaces`、`accounting_periods` |
| 关账工作台 | `/workspace/close-readiness/checklist` | 检查清单 | 控制项 | 控制项、严重性、负责人、复核人 | 发起检查 | 无控制项、检查失败 | `close_checklists`、`control_rules` |
| 关账工作台 | `/workspace/close-readiness/findings` | 异常发现 | 异常发现 | 异常列表、影响范围、建议、状态 | 指派负责人 | 无异常、待处理、待复核 | `findings` |
| 关账工作台 | `/workspace/close-readiness/evidence` | 证据中心 | 证据 | 文件、来源、hash、关联运行、关联异常 | 导入 CSV/Excel | 无证据、导入失败、schema 不匹配 | `evidence_artifacts` |
| 关账工作台 | `/workspace/close-readiness/reviews` | 复核队列 | 人工复核 | 待复核、已批准、已退回、已豁免 | 提交复核 | 无复核项、批准确认、退回原因必填 | `human_reviews` |
| 关账工作台 | `/workspace/close-readiness/report` | 关账报告 | 关账就绪报告 | 结论摘要、异常汇总、证据索引、审计摘要 | 生成关账报告 | 无报告、生成失败、导出失败 | `close_readiness_reports` |

当前前端英文集中在以下实现 surface，中文化实现必须优先覆盖：

- `neptune-ai/web/src/components/PrimarySidebar.tsx`：主导航、通知、设置、用户菜单；
- `neptune-ai/web/src/pages/Login.tsx`：登录、注册、表单、错误提示；
- `neptune-ai/web/src/pages/Home.tsx`：当前首页欢迎语、智能体选择、空状态；
- `neptune-ai/web/src/pages/CreateAgent.tsx`：创建智能体模板表单；
- `neptune-ai/web/src/pages/AgentConfig.tsx`：智能体模板配置、技能绑定、知识文件、删除确认；
- `neptune-ai/web/src/pages/Skills.tsx`：技能目录、上传、编辑、删除确认；
- `neptune-ai/web/src/pages/Collaborate.tsx` 与 `neptune-ai/web/src/components/collaborate/**`：运行调试、会话线程、空状态、错误态；
- `neptune-ai/web/src/components/artifact/**`：成果文件与证据展示；
- `neptune-ai/web/src/components/task/**`：任务、执行计划、后台活动。

---

## 6. Shared Contract 策略

`shared` 只承载稳定跨层协议，不承载业务行为，不一次性把所有战略对象塞进去。

第一批进入 `shared/types/neptune-ai`：

- `RunDto`
- `RunStatus`
- `RunListResponse`
- `AuditEventDto`
- `AuditEventListResponse`
- `AgentVersionSummaryDto`
- `UsageSummary`
- `PlatformFactListResponse<T>`
- REST/SSE 统一 `ApiErrorEnvelope`

暂不进入或只在 server 内部：

- `ArtifactDto`
- `EvidenceArtifactDto`
- `PolicyDecisionDto`
- `HumanReviewDto`
- `EvalRunDto`
- `ReleaseVersionDto`
- 完整 `UsageRecordDto`

进入 shared 的门槛：

1. 有持久化模型；
2. 有明确状态枚举；
3. 有 audit 绑定；
4. 有至少一个 web/API 消费者；
5. DTO 不泄漏 DB row 或敏感配置。

`AgentVersion.snapshot` 默认不直接外露。第一阶段只返回脱敏摘要：version、model、tools/skills count、hash、createdAt。

---

## 7. 数据与存储边界

| 存储 | 放什么 | 不放什么 |
| --- | --- | --- |
| PostgreSQL | Run、AuditEvent、Version、Connector、PolicyDecision、Artifact metadata、Review、Eval、Release metadata | 大文件内容、短期连接状态 |
| Redis | 实时 quota/cost counter、短期运行状态、并发 gate | 审计事实、长期证据 |
| 文件系统/对象存储 | Artifact/Evidence 内容、CSV/Excel、报告文件 | 唯一元数据来源 |
| Langfuse/Tracing Provider | trace、debug、性能、模型调用可观测性 | 审计事实、合规导出事实 |

原则：observability 不能替代 audit，transcript 不能替代 artifact/evidence。

---

## 8. MVP 阶段路线

### 阶段 0：固化当前平台事实

目标：让已经暴露的 `/runs`、`/audit-events`、`/agents/:agentId/versions` 成为稳定产品契约。

任务：

- 为 Run / Audit / AgentVersionSummary 增加 shared DTO；
- server 从 DB row 输出改为 DTO mapper；
- 统一 REST error envelope；
- 明确 SSE `event:error` 协议；
- AgentVersion snapshot 做脱敏摘要。

验收：

- 治理台可以只读展示运行记录、审计事件、智能体版本；
- 不泄漏 prompt secret、MCP auth config、credential；
- server 测试覆盖未认证、跨租户、分页、过滤。

### 阶段 1：补平台内核事实对象

目标：让一次 Run 能解释证据、策略、复核、工具调用和成本。

任务：

- 新增 `Artifact / EvidenceArtifact`；
- 新增 `RunEvent / ToolInvocation`；
- 新增 `PolicyDecision`；
- 新增 `HumanReview`；
- billing/usage 绑定 Run；
- quota 在 dispatch 前硬拦截；
- audit event 增加 runId / versionRef / actor / resource taxonomy。

验收：

- 一次 controlled Run 能产生 Run、ToolInvocation、Artifact/Evidence、PolicyDecision、Audit、Usage；
- Run detail 可以完整追溯事实链。

### 阶段 2：治理台

目标：客户技术治理方能看见和追责。

任务：

- 新增 `/governance`；
- 运行记录列表和详情；
- 审计事件列表和过滤；
- 智能体版本摘要；
- 成本概览；
- 策略决策只读列表。

验收：

- E2E 覆盖导航、API 加载、空状态、401；
- 不依赖 chat 页面。

### 阶段 3：关账工作台

目标：跑通中国 ERP 财务月结关账主路径。

任务：

- `CloseWorkspace`
- `AccountingPeriod`
- `Checklist`
- `Finding`
- `Evidence`
- `Review / Approval / Waiver`
- `CloseReadinessReport`
- mock dataset
- 总账完整性检查模板前三条规则：
  - 未过账凭证检查；
  - 会计期间状态检查；
  - 凭证编号连续性检查。

验收：

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

### 阶段 4：CSV/Excel 真实输入

目标：从演示闭环进入中国企业可落地的数据入口。

任务：

- CSV/Excel import；
- evidence schema validation；
- file hash；
- period / ledger / account set metadata；
- 导入行为写 audit；
- 导入结果成为 EvidenceArtifact。

后置：

- ERP 深度连接；
- 回写 ERP；
- 自动过账；
- 自动批准；
- 复杂集团合并。

### 阶段 5：本地发布 / 评估 / 升级元数据

目标：保留可持续升级语义，但不建设重型云控制面。

任务：

- `EvalRun`
- `ReleaseVersion`
- `UpgradeAssessment`
- stable / preview / security metadata；
- pre-upgrade eval；
- impact report；
- upgrade audit。

---

## 9. 明确不做

第一阶段不做：

- 修改 `neptune-engine`；
- 把财务语义写进 runtime；
- 重型 CI/CD；
- 云控制面；
- connector marketplace；
- 完整商业 billing / 发票 / 支付；
- 自动回写 ERP；
- 自动过账；
- 自动批准豁免；
- 通用自然语言规则编辑器；
- 复杂 BI；
- 复杂集团合并；
- 用 chat 作为主产品入口；
- 用 Langfuse 替代 audit；
- 用 transcript 替代 artifact/evidence。

---

## 10. 第一批实施切片建议

### 切片 1：平台事实契约

范围：

- shared DTO；
- server mapper；
- platform-facts API 契约测试；
- REST/SSE error envelope 收敛。

价值：

- 让已暴露 API 从“server row”变成稳定产品 contract；
- 为治理台铺路。

### 切片 2：治理台轻量版

范围：

- `/governance` 路由；
- `platformFacts` web API client；
- 运行记录 / 审计事件 / 版本只读视图；
- navigation E2E。

价值：

- 让 Run 成为产品可见中心；
- 纠正 Neptune 不是聊天应用的产品心智。

### 切片 3：成果、证据与复核核心

范围：

- `artifacts`；
- `evidence_artifacts`；
- `human_reviews`；
- Run detail 关联；
- audit 事件。

价值：

- 为财务 Solution Pack 提供真实生产事实对象。

### 切片 4：关账工作台 MVP

范围：

- 关账工作区 / 会计期间 / 检查清单 / 异常发现 / 报告；
- mock dataset；
- 三条总账完整性规则；
- review/approval 状态流。

价值：

- 用中国 ERP 财务月结关账验证 AgentOps Core。

---

## 11. 风险与防线

| 风险 | 后果 | 防线 |
| --- | --- | --- |
| 先做财务 UI，不补平台事实 | 退化成财务 SaaS demo | 先补 Artifact/Evidence/Review/Policy/RunEvent |
| 继续以 chat 为主轴 | 产品心智错误 | 三入口 IA：交付台 / 治理台 / 关账工作台 |
| shared 过早冻结对象 | contract 被错误设计绑死 | 只把已有跨层事实 DTO 放入 shared |
| AgentVersion snapshot 外泄 | prompt、MCP、credential 风险 | DTO mapper 脱敏摘要 |
| observability 替代 audit | 合规不可用 | Audit Store 独立于 Langfuse |
| Redis 成为事实来源 | 审计不可追溯 | Redis 只做短期计数与状态 |
| 修改 engine 承载产品语义 | runtime 被污染 | 所有业务语义留在 `neptune-ai` |

---

## 12. 验收标准

设计进入实施前，必须满足：

- 服务边界明确；
- 不触碰 `neptune-engine`；
- 第一批切片有可测试行为；
- 每个新增事实对象有 audit 绑定；
- 每个跨层 API 有 shared DTO 或明确暂不进入 shared 的理由；
- 每个 UI 入口消费真实 server API，不做孤立 mock；
- Solution Pack 对象能映射回 Platform Core；
- 历史 Run 不因配置升级而失去解释能力。

中文化进入实施前，还必须满足：

- 主导航、二级菜单、页面标题、面包屑、按钮、表格列、筛选项、状态、空状态、错误提示、确认弹窗均有中文文案；
- 用户主路径使用 `智能体`，不直接显示 `Agent` 作为主标签；`Agent` 只允许作为技术括注、代码、API 或交付侧二级说明；
- `Home / Agents / Skills / Collaborate`、`Delivery Console`、`Governance Console`、`Business Workspace`、`Run Lab` 等英文产品命名不得出现在用户主界面；
- `Loading...`、`No data`、`Not found`、`Failed to load`、`Error`、`Submit`、`Confirm` 等英文兜底文案不得出现在用户主界面；
- 每个页面至少有一个中文空状态、一个中文错误态、一个中文权限态或危险操作确认态；
- E2E 或组件测试必须断言中文主导航、中文页面标题、中文空状态和中文错误提示；
- 技术白名单词必须有边界：`API`、`MCP`、`SSE`、`CSV`、`Excel`、`ERP`、模型名、provider 名可以保留；其余英文必须给出明确中文主标签。

最终判断：

**Neptune 的第一阶段不是“做更多智能体功能”，而是把智能体的执行结果变成企业能委托、能复核、能审计、能升级的生产事实。**
