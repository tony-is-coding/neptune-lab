# Neptune AgentOps 平台战略架构决策

日期：2026-05-22

## 0. 战略结论

Neptune 的长期定位是：

**面向中国企业与 AI 交付团队的 AgentOps 生产平台。**

Neptune 不应被定义成“AI 员工应用”“财务 SaaS”或“聊天式 Agent 工具”。它的核心价值，是把 AI Agent 作为一种可委托的企业执行能力，纳入真实业务流程中的权限、证据、复核、发布、审计、成本和质量责任链。

第一阶段的战略中心是：

**把架构想清楚，把主路径做出来，让系统具备持续可升级的骨架。**

当前阶段不提前建设重型 CI/CD、生产运维控制面、高可用集群或完整商业计费体系；但必须从第一天保留平台分层、版本语义、审计事实、证据链和业务/运行时解耦。

第一 Solution Pack 锁定：

**中国 ERP 财务月结关账。**

这个场景不是为了把 Neptune 做成财务软件，而是用一个高风险、强流程、强审计、强证据链的中国企业场景，验证 AgentOps 平台内核是否成立。

## 1. 第一性原理

企业级 Agent 的本质不是聊天，也不是炫技式自动化，而是 **受控委托**。

企业不会把最终业务责任交给模型。企业只会把一部分检查、取证、解释、建议、编排和草拟工作委托给 Agent，并要求平台证明：

- Agent 在什么权限下行动；
- 使用了什么版本的规则、模板、模型和连接器；
- 读取了什么证据；
- 产出了什么发现；
- 谁复核了结果；
- 谁批准了豁免或结论；
- 历史结果在升级后是否仍可解释。

因此 Neptune 的平台中心不是 `Conversation`，而是 `Controlled Run`。

- 聊天是交互方式，Run 才是生产事实。
- LLM 输出是中间推理，Evidence 才是审计事实。
- Agent 建议是辅助判断，Review / Approval 才是责任事实。
- 单次演示是体验，Version / Audit 才是企业交付事实。

Neptune 的护城河不是模型调用能力，而是：

**把不确定的 LLM 行为包进可治理、可交付、可审计、可升级的企业执行协议里。**

## 2. 产品架构分层

Neptune 产品架构采用四层结构：业务工作台、行业方案包、AgentOps 平台内核、Runtime Kernel。上层表达行业业务语义，下层沉淀跨行业平台机制。

```text
┌────────────────────────────────────────────────────────────────────┐
│                     Business Workspace                             │
│  业务用户工作台：关账期间、检查清单、异常、证据、复核、报告          │
│  目标：让业务用户在真实流程中处理 Agent 产生的受控结果              │
└───────────────────────────────▲────────────────────────────────────┘
                                │ 业务体验与流程承载
┌───────────────────────────────┴────────────────────────────────────┐
│                       Solution Pack                                │
│  行业方案包：中国 ERP 财务月结关账                                  │
│  包含：业务对象、规则模板、证据类型、报告模板、角色流、验收集        │
│  目标：用行业语义驱动平台，但不污染平台内核和 runtime                │
└───────────────────────────────▲────────────────────────────────────┘
                                │ 行业语义映射为平台对象
┌───────────────────────────────┴────────────────────────────────────┐
│                    AgentOps Platform Core                          │
│  平台内核：Project、Agent、Connector、Run、Artifact、Policy、Review │
│          Audit、Eval、Release、Cost                                │
│  目标：沉淀所有企业 Agent 进入生产流程时都需要的治理机制             │
└───────────────────────────────▲────────────────────────────────────┘
                                │ 调用通用执行能力
┌───────────────────────────────┴────────────────────────────────────┐
│                    Neptune Runtime Kernel                          │
│  执行内核：模型调用、工具执行、MCP、streaming、trace、artifact 生成   │
│  目标：提供通用 Agent runtime，不理解财务、ERP、关账等业务语义        │
└────────────────────────────────────────────────────────────────────┘
```

### 2.1 Business Workspace

Business Workspace 是业务用户真正使用的产品界面。

在第一 Solution Pack 中，它表现为 `Month-End Close Readiness Workspace`，面向财务团队呈现：

- 会计期间；
- 关账检查清单；
- 检查通过率；
- 高风险异常；
- 证据明细；
- 责任人；
- reviewer / approver；
- 豁免与退回；
- 关账就绪报告。

设计原则：

- 工作台围绕业务流程组织，不围绕聊天窗口组织。
- AI 能力应隐藏在流程和证据之后，而不是成为界面主角。
- 财务用户看到的是“本期是否具备关账条件”，不是“模型回答了什么”。

### 2.2 Solution Pack

Solution Pack 是业务语义层。第一包是中国 ERP 财务月结关账。

它包含：

- `CloseWorkspace`
- `AccountingPeriod`
- `CloseChecklistTemplate`
- `ControlRule`
- `Evidence`
- `Finding`
- `Review`
- `Approval`
- `CloseReadinessReport`
- 总账完整性检查模板
- 财务证据 schema
- 报告模板
- 角色与复核流程
- ERP / CSV / mock connector adapter
- acceptance dataset / eval cases

设计原则：

- Solution Pack 可以强绑定行业语义。
- Solution Pack 不能把行业语义下沉到 `neptune-engine`。
- Solution Pack 通过 AgentOps Core 的通用对象落地：Run、Artifact、Review、Audit、Release。

### 2.3 AgentOps Platform Core

AgentOps Platform Core 是 Neptune 的长期平台资产。

核心对象：

- `CustomerProject`
- `AgentTemplate`
- `AgentTemplateVersion`
- `Connector`
- `ConnectorVersion`
- `Run`
- `ToolInvocation`
- `Artifact`
- `EvidenceArtifact`
- `PolicyDecision`
- `HumanReview`
- `AuditEvent`
- `EvalRun`
- `ReleaseVersion`
- `UsageRecord`

设计原则：

- 平台内核解决跨行业共性问题：权限、连接、运行、证据、审批、审计、评估、发布、成本。
- 平台内核不能退化成财务 SaaS。
- 平台内核也不能只是 `neptune-engine` 的薄壳；它必须承载企业交付与治理语义。

### 2.4 Neptune Runtime Kernel

Runtime Kernel 主要由 `neptune-engine/` 承担。

它负责：

- 模型调用；
- 工具执行；
- MCP client / tool runtime；
- streaming；
- runtime trace；
- artifact 生成；
- 执行生命周期；
- policy hook / eval hook 的底层接入点。

它理解：

- `Run`
- `ToolInvocation`
- `Artifact`
- `PolicyHook`
- `HumanReviewHook`
- `EvalHook`

它不理解：

- 财务关账；
- 会计期间；
- 凭证；
- 科目余额表；
- 未过账凭证；
- 关账就绪报告。

设计原则：

`neptune-engine` 是 Agent Runtime Kernel，不是财务引擎，也不是行业流程引擎。

## 3. 技术架构与项目服务分层

当前 repo 应保持三条主边界：`neptune-ai`、`shared`、`neptune-engine`。未来可以演进部署单元，但源码职责必须先清楚。

```text
┌────────────────────────────────────────────────────────────────────┐
│                         neptune-ai/web                             │
│  React / Vite / Tailwind                                           │
│  产品入口：Delivery Console、Governance Console、Business Workspace │
└───────────────────────────────┬────────────────────────────────────┘
                                │ REST / SSE / typed contracts
┌───────────────────────────────▼────────────────────────────────────┐
│                       neptune-ai/server                            │
│  产品编排层与平台服务层                                             │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Business App Services                                        │  │
│  │ Close Workspace、Checklist、Finding、Review、Report           │  │
│  └───────────────────────────────┬──────────────────────────────┘  │
│                                  │ maps to platform objects        │
│  ┌───────────────────────────────▼──────────────────────────────┐  │
│  │ AgentOps Platform Services                                   │  │
│  │ Project、Agent、Connector、Run、Artifact、Policy、Audit、Cost │  │
│  └───────────────────────────────┬──────────────────────────────┘  │
│                                  │ invokes runtime through adapter │
│  ┌───────────────────────────────▼──────────────────────────────┐  │
│  │ Engine Adapter / Runtime Boundary                            │  │
│  │ 只传递通用执行上下文，不传递财务专属概念                       │  │
│  └───────────────────────────────┬──────────────────────────────┘  │
└──────────────────────────────────┼─────────────────────────────────┘
                                   │ shared contracts
┌──────────────────────────────────▼─────────────────────────────────┐
│                              shared                                │
│  跨层契约：Run、ToolInvocation、Artifact、PolicyDecision、Review    │
│          AuditEvent、EvalRun、ReleaseVersion、UsageRecord           │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │ runtime API / events
┌──────────────────────────────────▼─────────────────────────────────┐
│                         neptune-engine                             │
│  Runtime Kernel：LLM、tools、MCP、streaming、trace、artifact hooks   │
│  不包含财务、ERP、关账、报表等业务语义                               │
└────────────────────────────────────────────────────────────────────┘
```

### 3.1 `neptune-ai/web`

职责：

- Delivery Console：面向 SI / AI 交付团队；
- Governance Console：面向企业 AI / IT 平台团队；
- Business Workspace：面向业务用户；
- Run / Evidence / Finding / Review / Report 的工作流呈现。

边界：

- 不把聊天作为主信息架构。
- 不直接表达 engine 内部细节。
- 不绕开 server 的策略、权限、审计和版本约束。

### 3.2 `neptune-ai/server`

职责：

- 产品业务编排；
- AgentOps 平台服务；
- 租户、项目、权限、连接器、运行记录、证据、复核、审计、成本；
- 财务 Solution Pack 的业务对象与状态机；
- 调用 `neptune-engine` 的 adapter。

边界：

- 财务业务对象留在 server 的业务层或 solution pack 层。
- 平台对象沉淀为可跨行业复用的服务。
- 调用 engine 时只传递通用执行上下文、工具、策略和 artifact 契约。

### 3.3 `shared`

职责：

- 固化跨层 contract；
- 避免 web、server、engine 各自定义一套 Run / Artifact / Review / Audit 类型；
- 承载稳定协议，而不是承载业务行为。

优先沉淀对象：

- `Run`
- `ToolInvocation`
- `Artifact`
- `PolicyDecision`
- `HumanReview`
- `AuditEvent`
- `EvalRun`
- `ReleaseVersion`
- `UsageRecord`

### 3.4 `neptune-engine`

职责：

- 提供可嵌入的 Agent runtime；
- 执行模型与工具；
- 支持 MCP、streaming、trace、artifact hook；
- 暴露 runtime 边界给 `neptune-ai/server`。

边界：

- 不依赖财务对象；
- 不实现关账规则；
- 不生成财务报告；
- 不持有客户项目、审批、审计、成本等产品语义；
- 不因为第一 Solution Pack 而修改成财务专用 SDK。

## 4. 客户与角色边界

Neptune 的客户必须按“买方、交付者、平台治理者、业务责任人”区分。第一阶段的商业楔子与平台设计对象不同，但共享同一个平台内核。

| 类别 | 归属 | 内部/外部 | 战略优先级 | 典型角色 | 核心诉求 | Neptune 提供的产品入口 |
| --- | --- | --- | --- | --- | --- | --- |
| SI / AI 交付团队 | Neptune 外部生态伙伴，或客户企业内部交付团队 | 外部为主，兼容客户内部 | 第一销售楔子 | AI 应用公司、系统集成商、数字化服务商、内部 AI 交付团队 | 更快、更标准、更可复制地交付企业 Agent 项目 | Delivery Console、Project Templates、Solution Pack、Acceptance Kit |
| 客户技术治理方 | 购买或部署 Neptune 的企业客户内部团队 | 客户内部 | 第一平台设计对象 | CIO 团队、AI 平台团队、IT 架构、安全与运维团队 | 数据边界、身份权限、模型网关、Agent registry、审计、成本、升级 | Governance Console、Policy Center、Audit Center、Model Gateway、Environment Management |
| 经济买方 | 购买 Neptune 的企业客户内部决策者 | 客户内部 | 商业决策关键人 | CIO、CDO、AI 转型负责人、财务共享中心负责人、集团数字化负责人 | 交付效率、治理成本、可控上线、审计责任、业务自动化能力 | 战略价值呈现、交付可行性、治理承诺、ROI 与风险控制 |
| 客户业务责任方 | 购买或部署 Neptune 的企业客户内部业务团队 | 客户内部 | 场景成败关键人 | 财务经理、总账会计、共享中心操作人员、审计/风控 | 本期能否关账、异常是否处理、证据是否充分、报告是否可信 | Business Workspace、Findings、Evidence、Review、Report |
| Neptune 产品与工程团队 | Neptune 产品公司内部 | 产品公司内部 | 平台责任主体 | 产品、架构、研发、解决方案团队 | 平台内核演进、Solution Pack 质量、runtime 安全、版本可升级 | Platform Core、Runtime Kernel、Solution Pack Registry |

战略决策：

**卖给交付团队，用企业平台标准设计。**

含义：

- 第一销售楔子面向 SI / AI 交付团队，因为他们更需要可复制交付能力，也更容易通过财务 Solution Pack 进入客户现场。
- 第一平台设计标准面向客户技术治理方，因为任何企业 Agent 最终要进入生产流程，都必须满足客户企业内部安全、治理、审计和升级要求。
- 客户业务责任方不是第一平台客户，但其体验和业务判断决定场景是否真实成立。

## 5. 部署形态与目标架构

Neptune 的长期部署结论是：

**Hybrid AgentOps Platform：Neptune 托管控制面 + 客户侧数据平面 + 可审计本地运行时。**

纯 SaaS 不适合作为中国中大型企业财务场景的默认形态；纯私有化也不适合作为 Neptune 的长期唯一形态。前者难以处理敏感数据边界，后者会切断平台升级、安全补丁、质量反馈和 Solution Pack 演进。

### 5.1 目标部署架构

```text
                           ┌──────────────────────────────────────┐
                           │        Neptune Cloud Control Plane    │
                           │                                      │
                           │  - license / subscription             │
                           │  - platform version registry          │
                           │  - solution pack registry             │
                           │  - connector package registry         │
                           │  - policy template registry           │
                           │  - eval benchmark registry            │
                           │  - upgrade channel                    │
                           │  - security advisory                  │
                           │  - non-sensitive health metadata      │
                           └───────────────────┬──────────────────┘
                                               │ signed packages /
                                               │ metadata / upgrade advice
                                               │ no sensitive finance data
┌──────────────────────────────────────────────▼──────────────────────────────────────────────┐
│                              Customer Data Plane                                            │
│                                                                                             │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌─────────────────┐ │
│  │ Neptune Web/API  │   │ Runtime Kernel   │   │ Connector Runtime│   │ Model Gateway   │ │
│  │ customer side    │   │ customer side    │   │ ERP/CSV/API      │   │ local/cloud LLM │ │
│  └────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘   └────────┬────────┘ │
│           │                      │                      │                      │          │
│  ┌────────▼─────────┐   ┌────────▼─────────┐   ┌────────▼─────────┐   ┌────────▼────────┐ │
│  │ Customer DB      │   │ Artifact Store   │   │ Audit Store      │   │ Policy Engine   │ │
│  │ projects/runs    │   │ evidence/files   │   │ immutable events │   │ local decisions │ │
│  └──────────────────┘   └──────────────────┘   └──────────────────┘   └─────────────────┘ │
│                                                                                             │
│  Sensitive ERP data, vouchers, invoices, bank receipts, approvals and evidence stay here.    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 部署形态分层

| 部署形态 | 战略定位 | 数据边界 | 升级方式 | 第一阶段态度 |
| --- | --- | --- | --- | --- |
| 公有云 SaaS | 低敏试用、演示、模板市场、学习入口 | 客户敏感数据不应进入默认 SaaS | Neptune 统一升级 | 保留为入口，不作为财务生产默认形态 |
| 交付团队本地项目版 | PoC、试运行、客户现场样板、架构 MVP | 数据留在项目环境或客户现场 | 手动升级、手动导入方案包 | 第一阶段优先支持 |
| 客户私有化部署 | 强合规企业、内网或专有云部署 | 数据完整留在客户侧 | 手动或半自动升级 | 作为重要企业部署形态保留 |
| VPC / 专属云托管 | 隔离环境下减少客户运维负担 | 客户独享网络与存储 | Neptune 或合作方运维升级 | 中期主力商业形态之一 |
| 混合部署 | 长期目标形态 | 控制面不存敏感数据，数据面留客户侧 | 控制面分发签名包、客户侧执行升级 | 长期战略架构 |

### 5.3 当前阶段部署结论

第一阶段以 **交付团队本地项目版** 和 **可演进到客户私有化的单环境部署** 为主。

当前不建设完整生产持续发布系统，但必须保留：

- 平台版本号；
- Solution Pack 版本号；
- Agent Template 版本号；
- Control Rule 版本号；
- Connector 版本号；
- Report Template 版本号；
- Run 绑定具体版本；
- Artifact / Evidence 绑定来源与 hash；
- Audit Event append-only；
- 数据模型支持迁移；
- 历史 Run 不因新版本改变解释。

持续可升级的最低要求：

**任何重要对象都不被原地覆盖，任何运行结果都能解释它依赖的版本。**

### 5.4 未来升级能力

未来平台化升级应具备：

- Version Channel：stable / preview / security hotfix；
- Signed Package：runtime、connector、solution pack 签名；
- Compatibility Matrix：平台、方案包、connector、model gateway 兼容矩阵；
- Pre-upgrade Eval：升级前跑客户本地评估集；
- Impact Report：说明受影响的 Agent、规则、connector、policy；
- Canary Environment：测试工作区灰度；
- Rollback：失败可回滚；
- Upgrade Audit：升级行为进入审计；
- No Historical Mutation：升级不改变历史 Run / Evidence / Report 的解释。

这些能力属于未来生产化阶段，不是当前 Architecture MVP 的建设范围。

## 6. 质量负责边界

本节中的“客户”指购买、部署或使用 Neptune 的企业组织，不是 Neptune 产品公司内部团队。客户侧责任属于该企业内部的技术治理方和业务责任方。

Neptune 必须采用 Shared Responsibility Model。企业 Agent 的质量不是单点负责，而是责任链负责。

| 责任方 | 身份归属 | 负责内容 | 不负责内容 |
| --- | --- | --- | --- |
| Neptune 平台 | Neptune 产品公司内部 | 权限、审计、trace、artifact、release、eval、cost、runtime 生命周期、工具执行框架、模型网关边界、默认 Solution Pack 的规则表达与测试集 | 不替客户承担最终财务结论，不替 SI 完成客户现场规则确认 |
| SI / AI 交付团队 | 外部生态伙伴，或客户内部交付团队 | 客户业务规则配置、ERP 字段映射、数据源接入、权限矩阵、验收用例、试运行、客户化模板、交付文档 | 不承担 Neptune 平台内核缺陷，不承担客户最终业务审批责任 |
| 客户技术治理方 | 客户企业内部 AI / IT 平台团队 | 部署环境、网络账号、模型供应商选择、数据边界、内部安全策略、运维监控、企业身份系统 | 不承担 Neptune 默认方案包质量，不承担业务部门最终判断 |
| 客户业务责任方 | 客户企业内部业务团队 | 财务规则确认、异常处理结论、豁免审批、最终关账判断、业务责任承担 | 不负责平台运行机制、runtime 安全或连接器框架 |
| 模型供应商 | 第三方或客户自有模型团队 | 模型 API SLA、模型能力边界、模型安全承诺、模型服务可用性 | 不负责 Neptune 产品流程、客户业务结论或平台审计完整性 |

### 6.1 为什么客户技术治理方需要承担责任

客户技术治理方控制的是客户企业内部的技术环境和安全边界，包括：

- Neptune 部署在哪个网络、VPC、内网或专有云；
- 使用哪个模型供应商、本地模型或专有云模型；
- 哪些账号能访问 ERP、数据库、文件系统和对象存储；
- 是否接入企业 SSO / IAM；
- 哪些数据允许出域；
- 内部安全策略、日志留存、网络访问规则；
- 客户侧运维、监控和应急响应。

这些不是 Neptune 能单方面决定的。Neptune 提供机制、默认安全设计、审计能力和部署指导；客户技术治理方负责把这些机制放入客户自己的安全制度和运行环境中。

### 6.2 为什么客户业务责任方需要承担责任

客户业务责任方控制的是业务事实和业务判断。以财务关账为例：

- 哪些规则符合公司财务制度；
- 某个异常是否真实需要处理；
- 某个差异是否可以豁免；
- 某个证据是否足够支持结论；
- 是否允许进入关账会议；
- 最终是否关账。

Neptune 可以帮助检查、取证、解释、生成 finding、组织复核流程，但不能替客户财务负责人承担最终关账判断。否则产品会在法律、审计和商业责任上越界。

质量原则：

1. Agent 可以检查、解释、取证、建议和触发审批。
2. Agent 不能在没有授权和审计记录的情况下改变账务事实。
3. Agent 不能替代业务责任主体。
4. Neptune 的责任是让每个结论有来源、每个动作有权限、每个异常有责任人、每个版本可追溯、每次升级可验证。

## 7. 第一 Solution Pack：中国 ERP 财务月结关账

第一 Solution Pack 锁定中国 ERP 财务月结关账。

选择理由：

1. 中国企业有真实预算和长期需求。
2. 月结关账具备强流程、强审计、强证据链。
3. 场景天然要求权限、复核、审批、报告和历史可追溯。
4. ERP、凭证、发票、银行回单、审批、报表等证据对象丰富。
5. 能逼出 Neptune AgentOps Core 的核心能力。
6. 比通用聊天或知识库更能验证企业级 Agent 的生产价值。

第一阶段产品目标是：

**Close Readiness Control。**

它不承诺自动关账，而是判断某个会计期间是否具备关账条件：

- 哪些控制项通过；
- 哪些控制项失败；
- 证据在哪里；
- 谁负责处理；
- 谁完成复核；
- 哪些异常被豁免；
- 报告是否可用于关账会议。

### 7.1 财务业务对象与平台映射

| 财务业务对象 | 平台映射 | 说明 |
| --- | --- | --- |
| `CloseWorkspace` | `CustomerProject` + domain workspace | 某客户、组织、账套、期间的关账空间 |
| `AccountingPeriod` | run context / domain period | 所有检查、证据、异常、报告都挂在期间上 |
| `CloseChecklistTemplate` | `AgentTemplateVersion` + domain template | 可复用、可版本化的关账检查模板 |
| `ControlRule` | rule config + policy / tool plan | 业务层定义规则，执行时映射为平台可追踪任务 |
| `Evidence` | `EvidenceArtifact` | 凭证、余额表、辅助账、回单、数电票、审批记录 |
| `Finding` | domain finding + artifact references | 异常发现，必须关联 rule、run、evidence、severity |
| `Review / Approval` | `HumanReview` | 人工复核、退回、豁免、批准 |
| `CloseReadinessReport` | domain report + audit snapshot | 报告必须嵌入 run、artifact、review、audit 摘要 |

### 7.2 第一阶段规则范围

总账完整性检查先覆盖：

1. 未过账凭证检查；
2. 会计期间状态检查；
3. 凭证编号连续性检查；
4. 现金 / 银行异常方向余额检查；
5. 大额手工凭证检查；
6. 关键科目本期波动异常检查。

第一阶段可以真实实现其中一部分，其余用 mock / sample data 验证产品闭环。目标不是规则覆盖面，而是验证 Run、Evidence、Finding、Review、Report、Audit 的生产链条。

## 8. 中国优先约束

Neptune 第一阶段必须优先考虑中国企业现实。

关键事实：

- 财务数据、凭证、发票、银行回单、审批记录高度敏感。
- 企业倾向私有化、专有云、VPC 或混合部署。
- ERP 生态包括用友、金蝶、SAP 中国、Oracle 中国以及大量 Excel / 导出表 / 手工台账。
- 财务共享中心、集团管控、多法人、多账套、多币种、多组织是常见复杂度。
- 会计信息化、电子凭证、电子会计凭证数据标准正在推进。
- 生成式 AI 服务需要考虑中国监管、数据安全、个人信息保护和内容合规。

因此 `Evidence` 必须支持结构化证据，而不是只保存 LLM 引用文本。

第一阶段优先支持的证据类型：

- 凭证列表；
- 科目余额表；
- 辅助账明细；
- 银行回单；
- 数电票 / 电子发票；
- 审批流记录；
- 附件；
- 归档元数据；
- CSV / Excel 导入表；
- ERP 查询快照。

## 9. 当前阶段 MVP 边界

当前阶段定义为：

**Neptune Strategy Prototype / Architecture MVP。**

目标：

1. 平台分层正确。
2. 对象模型正确。
3. 主流程跑通。
4. 升级语义正确。

### 9.1 必须跑通的主路径

```text
交付团队创建客户项目
        │
        ▼
创建 Close Workspace
        │
        ▼
选择总账完整性检查模板
        │
        ▼
绑定 mock / CSV 财务数据源
        │
        ▼
配置规则、严重性、owner、reviewer、approver
        │
        ▼
发起 Close Readiness Run
        │
        ▼
执行检查，生成 Evidence 与 Findings
        │
        ▼
财务用户处理异常并补充说明
        │
        ▼
Reviewer 复核 Findings
        │
        ▼
Approver 确认豁免或要求修正
        │
        ▼
生成 Close Readiness Report
        │
        ▼
保留 Audit Trail 与 Run Trace
```

### 9.2 第一阶段不做

- 不直接回写 ERP；
- 不自动过账；
- 不自动批准豁免；
- 不做完整财务核算模块；
- 不做复杂 BI 报表；
- 不做复杂集团合并；
- 不做所有 ERP 深度连接；
- 不做通用自然语言规则编辑器；
- 不把聊天作为主界面；
- 不提前建设完整生产 CI/CD；
- 不提前建设大规模运维控制面。

## 10. 项目执行约束

后续涉及 Neptune 产品、平台、架构、部署、质量责任、Agent 生命周期、财务 Solution Pack 的设计或实现时，必须先对照本文。

强制约束：

1. 不得把具体财务语义写入 `neptune-engine`。
2. 不得把聊天会话作为企业 Agent 平台的中心对象。
3. 不得绕过 `Run / Evidence / Finding / Review / Audit / Version` 这些生产事实对象。
4. 不得用“AI 自动完成”替代责任链设计。
5. 不得让 Solution Pack 与 Platform Core 边界混乱。
6. 不得在第一阶段提前堆重型生产运维复杂度。
7. 必须保留持续可升级语义：重要对象版本化，历史事实可解释。
8. 必须优先考虑中国企业部署、数据、安全和财务业务现实。

最终判断：

**Neptune 不是做一个更会说话的 Agent，而是建设一套让 Agent 能被企业严肃委托的生产协议。**
