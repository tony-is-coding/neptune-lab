# Neptune AgentOps 产品说明

**版本**：v1.0（阶段一 Architecture MVP 结项）
**最后更新**：2026-05-23
**目标读者**：产品、业务方案设计、客户技术治理方、客户业务责任方、销售/方案咨询
**配套文档**：
- 战略基线：`docs/strategy/neptune-agentops-platform-strategy.md`
- 技术架构：`docs/neptune-lab/technical-architecture.md`
- 产品架构（决策版）：`docs/neptune-lab/design/01-product-architecture.md`

---

## 0. 一句话定义

**Neptune 是把 LLM 的"自由发挥"包进企业可治理、可审计、可升级的"受控委托"协议中的 AgentOps 平台。**

产品**不是**：聊天工具、RPA、低代码工作流、模型 API 网关、Notion-with-AI。

产品**是**：把"我让 Agent 帮我做事"这件事变成可解释、可追责、可重放、可升级的**企业执行协议**。

---

## 1. 我们解决什么问题

### 1.1 LLM 进入企业的真实障碍

在企业里，让 LLM Agent "做事"会立刻撞上四面墙：

| 问题 | 企业方关心的事 | LLM 默认状态 |
|---|---|---|
| **不可解释** | "这次结果为什么这样？依据是什么？" | 黑箱输出，无中间事实 |
| **不可追责** | "这个决定谁批准的？" | 无审计、无人工复核 |
| **不可重放** | "三个月前那次会计处理是基于什么 Agent 配置？" | Agent 配置可变，历史无快照 |
| **不可升级** | "我升级了 Agent，会不会破坏既有合规？" | 无版本、无 eval、无 rollback |

Neptune 的产品命题：**把这四件事做成代码层面的不可逆事实**，让客户的法务、审计、技术治理方、业务负责人都能在产品里看见、批准、追溯。

### 1.2 第一刀切在哪：中国 ERP 财务月结关账

理由：

- 强合规、强审计、强责任链——是验证"受控委托"协议是否到位的最佳场景
- 业务工作流稳定（每月跑一次）——可以反复打磨而不被产品需求漂移
- 真实数据（凭证、科目余额、银行流水）有结构、有外部源——能验证证据链能力
- 客户业务方（财务）和技术治理方（IT/审计）共同关注——能同时验证两个用户视角

**关账工作台不是产品最终形态**，是验证 AgentOps 平台内核的第一个 Solution Pack。

---

## 2. 三大产品入口

Neptune 的信息架构按"使用者角色"切分，不是按"功能模块"切分：

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   交付台 (Delivery Console)                                         │
│   ───────────────────────                                          │
│   面向：交付团队、方案配置者                                       │
│   做什么：配置智能体、绑定技能、上传材料、发起受控运行             │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   治理台 (Governance Console)                                       │
│   ────────────────────────                                         │
│   面向：客户技术治理方、IT 审计、风控                              │
│   做什么：看运行记录、查审计、看版本、复核异常、控成本             │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   关账工作台 (Close Readiness Workbench)                            │
│   ──────────────────────────────────                                │
│   面向：客户业务责任方（财务）                                     │
│   做什么：跑期间检查、看异常、复核证据、生成关账就绪报告           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**关键设计原则**：

- 聊天**不是**产品中心。聊天降级为"运行调试入口"——只有交付者在 Collaborate 页面调试 Agent 时才用得到
- 业务用户的主页面是**关账工作台**，不是聊天窗口
- 治理用户的主页面是**治理台**，看运行/审计/版本/策略，不靠聊天找答案

---

## 3. 阶段一已交付的产品能力

### 3.1 交付台能力

| 能力 | 状态 | 用户场景 |
|---|---|---|
| 智能体管理 | ✅ | 创建/编辑/激活/停用 Agent 模板，配置 prompt/model/tools/skills/MCP servers/constraints |
| 模块化提示词组装 | ✅ | 通过 `promptConfig`（identity/inlineSkills/knowledgeConfig）组装 system prompt |
| 智能体材料上传 | ✅ | 上传文档/记忆/知识三种 category 的资料 |
| 技能（Skill）目录 | ✅ | Skill 创建/编辑、显式上架/下架（带审计），绑定到 Agent |
| 项目（CustomerProject）| ✅ | 创建/切换/归档，区分 sandbox/production 环境，绑定 Solution Pack |
| 发起受控运行 | ✅ | 在交付台 Home 页选 Agent + 输入指令 → 创建 Run（不依赖聊天）|
| 配额拒绝弹窗 | ✅ | 配额不足时展示中文原因 + 请求编号 + 跳转治理台入口 |
| 调试聊天工作台（Collaborate）| ✅ | 仅限调试用途；右栏「关联运行」深链到治理台 |

### 3.2 治理台能力

治理台主页面有 6 个 tab：

| Tab | 能力 | 状态 |
|---|---|---|
| 运行记录 | 跨租户运行列表 + 详情聚合（事件时间线/工具调用/成果/证据/策略/复核/审计）| ✅ |
| **运行实时事件流** | running 状态的运行展示**实时**事件时间线（SSE，断线自动续传）| ✅ 阶段一新增 |
| 审计事件 | 全租户审计列表，支持 resourceType/resourceId/action/outcome 过滤 + CSV 导出 | ✅ |
| 智能体版本 | Agent 版本历史 + 版本指纹（sha256 hash），跨运行可解释性 | ✅ |
| 策略决策 | PolicyDecision 列表（当前主要由配额拦截写入，工具/MCP/路径决策待阶段二）| 🟡 部分 |
| 复核队列 | 跨业务复核请求列表 + 提交复核决策（approve/reject/waive）| ✅ |
| 成本概览 | 租户级 token/费用/MTD 聚合 + 配额放行状态 | ✅ |
| 受保护资源跨租户隔离 | 所有事实查询都按 tenantId 严格隔离，跨租户访问统一返回 404 | ✅ |

### 3.3 关账工作台能力

中国 ERP 财务月结关账主流程已经端到端贯通：

| 能力 | 状态 | 业务价值 |
|---|---|---|
| 关账工作区 + 会计期间 | ✅ | 每个工作区代表一个账套；期间状态机 open→checking→review_pending→approved→closed 全闭合 |
| 检查清单（Checklist）| ✅ | 一次"运行检查"会落 N 条 checklist_items，每个 item 有 severity/status/owner/reviewer |
| 异常发现（Finding）| ✅ | 检查发现的异常持久化，关联 ChecklistItem + EvidenceArtifact + HumanReview |
| CSV 证据导入 | ✅ | 财务方上传明细/分录 CSV → 落 Artifact + EvidenceArtifact（带 sha256 + sourceSystem 元数据），并可关联到 Finding |
| 证据中心 | ✅ | 工作区视角看真实 evidence_artifacts 列表（不是从 Finding 反推）|
| 异常复核 | ✅ | 提交复核 → 写 HumanReview pending → 决策（approve/reject/waive）→ 更新 Finding 状态 |
| 报告快照（关账就绪报告）| ✅ | 必须 period 进入 approved 才能生成；报告 snapshot + sha256 hash 不可变；绑定 runs/evidence/findings/reviews/audits |
| 报告依据详情 | ✅ | 点开报告查看绑定的事实链（runs/evidence/findings/reviews/audits）|
| 工作流时间线 | ✅ | 跨审计聚合的中文时间线（工作区创建/期间转换/检查/证据/复核/报告 9 种事件）|
| 配额硬门禁 | ✅ | 关账检查 Run 也走 admission；配额不足拒绝且不创建 synthetic run |
| 跨租户隔离 | ✅ | 关账资源全部按 tenantId 隔离 |

### 3.4 平台基础能力

| 能力 | 说明 |
|---|---|
| 多租户行级隔离 | 所有业务表带 tenantId；跨租户访问返回 404，不暴露存在性差异 |
| JWT 鉴权 + 角色 | admin / user 两级；platform_admin / tenant_admin 在计费场景做细粒度判断 |
| 配额硬拦截 | 每日 token 上限 + 并发会话上限；命中拦截在 Run 创建前（不只是事后计费）|
| 中文优先 UI | 主导航/页面标题/状态/空态/错误态/确认弹窗全部中文 |
| 统一错误信封 | 所有 4xx/5xx 错误响应封闭枚举 + requestId + 中文 message |
| 实时运行事件流 | SSE 协议，14 种封闭事件类型，断线续传，心跳保活 |
| 审计事件 CSV 导出 | 治理团队可下载 audit 历史用于第三方审计 |
| 协作 thread 与 Run 关联 | 调试聊天的右栏可看到关联的 Run 列表，跳转治理台 |

---

## 4. 关键产品特性深度说明

### 4.1 受控运行（Controlled Run）= 产品中心

每一次 Agent 执行都是一个"受控运行"，不是一段聊天。它带着以下不可逆事实：

```
一次 Run 关联：
  ├── 唯一 Run ID + 请求编号（requestId）
  ├── 不可变的 Agent 配置快照（agent_template_versions + 版本指纹 sha256）
  ├── 完整的运行事件时间线（run_events，sequence 严格单调，append-only）
  ├── 所有工具调用摘要（tool_invocations，含输入/输出脱敏摘要）
  ├── 产生的成果文件元数据（artifacts，sha256 + storage_uri）
  ├── 受审计的证据（evidence_artifacts，带源系统/源 hash）
  ├── 策略决策记录（policy_decisions，allow/deny/review_required）
  ├── 人工复核责任链（human_reviews，状态机闭合）
  ├── 审计事件（audit_events，append-only）
  ├── 用量与成本（token + cost cents，关联到 model）
  └── 在治理台可以可视化、可追溯、可深链
```

**这意味着客户的审计方任何时刻问"这个决定怎么来的"，平台必须能在 1 分钟内提供完整事实链**。

### 4.2 智能体版本治理 = 历史可解释

`agent_template_versions` 表存每次受控运行使用的 Agent 配置快照。

- 每次 Run 启动都会 ensureSnapshot（如果配置没变就复用现有版本，变了就生成新版本）
- 版本指纹 sha256 是模型/工具/技能/MCP 的 hash，可以一眼看出"是不是同一份配置"
- 治理台「智能体版本」tab 列出每个 Agent 的历史版本
- 任何历史 Run 都能溯源到当时的配置

**业务价值**：升级 Agent 不破坏历史合规、客户可以问"你三个月前关账用的 Agent 是什么版本"并得到精确答案。

### 4.3 证据 ≠ 聊天记录

`evidence_artifacts` 表是审计事实，不是 LLM 输出文本。每条证据带：

- `artifact_id` 指向真实文件（含 sha256）
- `source_system` 数据从哪来（如 "manual-upload" / 未来的 ERP connector 名）
- `source_hash` 原始数据的 hash
- `captured_at` 数据采集时间点（可与 created_at 不同，反映真实业务时刻）

**业务价值**：财务用户上传一份银行流水，不只是"附件"，而是带着可验证溯源属性的事实。审计方可以校验 hash、可以追责具体上传人。

### 4.4 复核 = 责任事实，不是 UI 弹窗

`human_reviews` 状态机：

```
   pending ──── approve ──→ approved
       │                       │
       ├──── reject ────→ rejected
       │
       └──── waive ─────→ waived
```

- 每条复核都有 requestedBy / decidedBy / decisionReason / decidedAt
- 关账场景：异常发现必须经过复核才能纳入报告快照
- 平台场景：未来可对接 agent 配置变更、skill 上架、模型切换等高风险操作（阶段二补完）

**业务价值**：复核不是 UI 上的弹窗"您确认吗"，而是平台事实——任何被复核过的对象，平台永远记得是谁、什么时候、什么理由通过的。

### 4.5 关账报告 = 事实链快照

`close_reports.snapshot` 是一个 jsonb，包含：

- 该期间的所有 Run ID
- 所有相关 Evidence Artifact ID（含 source_hash）
- 所有 Finding（含决策原因）
- 所有 HumanReview（含决策人）
- 所有 AuditEvent（按时间线）

加一个 `snapshot_hash` sha256 作为指纹。**报告生成后内容不可变**。

**业务价值**：关账报告不是 LLM 写的"漂亮文档"，而是平台对该期间事实状态的快照证明。第三方审计可以用 hash 验证完整性。

### 4.6 实时运行事件流（SSE）

治理台运行详情页对 running 状态的运行启用 SSE 实时流：

- 14 种封闭事件类型涵盖 run/tool/policy/review/artifact/cost
- 客户端断网自动重连，通过 `Last-Event-ID` 续传，不丢事件
- 终态运行（completed/failed/cancelled）回放后立即关闭流，不维持空闲长连接
- 状态徽标：实时 / 重连中 / 失败 / 已完成

**业务价值**：治理方观察一次正在跑的 Agent 任务，看到的是真实事件序列（不是聊天文本流），随时知道工具调用、策略命中、成本累积情况。

### 4.7 配额硬门禁

`run-admission` 服务在 Run 创建之前拦截：

- 检查每日 token 用量
- 检查并发运行会话数
- 命中拦截立即返回 `429 QUOTA_EXCEEDED` 标准错误信封
- 同步写 `policy_decisions`（decision='deny'）+ `audit_events`（不创建 Run）

**业务价值**：配额不是事后账单上"超标了"，而是事前"不让你跑"。客户不会因为忘记限制而产生天价账单。

### 4.8 统一错误信封 + 中文请求编号

所有错误响应：

```json
{
  "error": "STATE_CONFLICT",
  "message": "复核已结束，无法再次决策",
  "requestId": "8f3a2c01-...",
  "details": {"reason": "review_already_decided"}
}
```

- 错误码集合是封闭枚举（7 个），客户端不能自由匹配字符串
- `requestId` 与 `X-Request-Id` 响应头一致，客户和客服对账方便
- 子状态走 `details.reason` 不扩张顶层错误码

**业务价值**：用户遇到问题截图发给客服，截图里就有请求编号，1 秒定位日志。

---

## 5. 哪些客户场景已经能覆盖（验收清单）

阶段一交付已经能让以下场景在产品里跑通：

### 5.1 客户技术治理方场景

✅ "我要看上周所有跑过的 Agent 任务"——治理台运行记录 tab，按时间过滤
✅ "我要看 X Agent 上个月有没有改过配置"——智能体版本 tab，看版本指纹
✅ "我要审计这次 Run 调用了哪些工具"——运行详情聚合 tab
✅ "我要导出本月所有审计事件给外部审计方"——审计事件 CSV 导出
✅ "我要看本月成本和配额放行状态"——成本概览 tab
✅ "我要把 X 类型的资源审计深链分享给同事"——审计事件 URL 含完整过滤参数
✅ "我要实时看一个正在跑的 Run 进度"——治理台运行详情，状态徽标 + 事件时间线

### 5.2 客户业务责任方（财务）场景

✅ "我要为本月做关账"——关账工作台创建工作区，建会计期间
✅ "我要让 Agent 跑一遍关账检查"——checks:generate 创建检查 Run
✅ "我要看 Agent 发现了哪些异常"——Finding 列表
✅ "我要补充一份银行流水作为证据"——CSV 证据导入
✅ "我要复核某条异常"——提交复核 → 决策（approve/reject/waive）
✅ "我要生成关账就绪报告"——必须先 approved，才能 generateReport
✅ "我要看这份报告的依据"——报告依据详情 + 工作流时间线
✅ "我跨租户访问其他公司的关账数据"——返回 404，不泄露存在性

### 5.3 平台交付者场景

✅ "我要为客户配一个关账 Agent"——AgentConfig 配置 prompt/model/skills
✅ "我要测试 Agent 行为"——Collaborate 页面调试
✅ "我要把这个 Agent 上线给客户"——切换状态/绑定项目
✅ "我要管理一组技能"——Skills 上架/下架，绑定到 Agent

### 5.4 客户经济买方关心的事

✅ "升级 Agent 不会破坏历史合规"——版本快照机制
✅ "审计方任何时候来都能给出完整事实链"——治理台 + 审计 CSV 导出
✅ "数据隔离强约束"——row-level tenantId + 跨租户 404
✅ "成本可控"——配额硬门禁 + 中文成本概览
✅ "故障可追溯"——每个错误响应带 requestId

---

## 6. 哪些场景**还没**覆盖（透明告知）

### 6.1 阶段一未完成

| 缺口 | 影响 | 解决时间 |
|---|---|---|
| 工具/MCP/路径决策未写 PolicyDecision | "策略治理"目前实际上只是"配额治理"；客户审计方深问会发现 | 阶段二（一周内）|
| Memory 未独立化 | Agent 跨 thread 记忆能力靠 documents.category=memory 兜底，没有独立 service/API | 阶段二（一周内）|
| ERP connector 真实化 | 关账证据目前只支持 CSV 上传，没有用友/金蝶/SAP 真实 connector | 阶段三（视客户而定）|
| ControlRuleVersion | 关账规则没有版本化，改规则会影响历史报告解释性 | 阶段三 |
| Eval / Release 元数据 | 没有 acceptance dataset 与发布通道，agent 升级安全靠人工 | 阶段四 |
| 工作流编排（非聊天） | 没有 server-side workflow 状态机，复杂任务依赖 chat plan | 阶段四 |

### 6.2 明确不在产品范围内

按战略文档 §10：

- ❌ 不做云控制面（阶段四以后）
- ❌ 不做 connector marketplace
- ❌ 不做完整商业 billing/支付/发票
- ❌ 不做自动 rollback / 灰度发布
- ❌ 不做通用自然语言规则编辑器
- ❌ 不把财务/HR/合同等行业语义下沉到 Runtime Kernel
- ❌ 不用聊天作为产品 IA 主入口
- ❌ 不用 Langfuse / transcript 替代审计、证据、报告

---

## 7. 产品形态与部署

### 7.1 当前

- **形态**：交付团队本地项目版（单进程 + 本地 PG/Redis + 文件系统）
- **目的**：用关账场景验证 AgentOps 平台内核，不上多客户

### 7.2 短期目标（阶段二/三完成后）

- **形态**：客户私有化单环境部署
- **数据边界**：客户 ERP/凭证数据不出客户网络
- **模型网关**：可配置 provider/key（包括客户私有部署的模型）
- **MCP / connector**：先支持 CSV/Excel + MCP，再上 ERP 只读 snapshot

### 7.3 长期愿景

- **形态**：Hybrid Control Plane（Neptune Cloud 控制面 + 客户侧 Runtime/Connector）
- **签名包分发**：Agent 模板、规则模板、connector 包都可签名版本化分发
- **Eval Benchmark Registry**：跨客户匿名化的 acceptance benchmark
- **Solution Pack 生态**：第二个 Pack（待选）+ 之后的若干

---

## 8. 与同类产品的根本不同

| 对比维度 | Notion-with-AI / Cursor 等 | 通用 Agent 框架（LangChain 等） | RPA / 工作流（UiPath 等） | **Neptune** |
|---|---|---|---|---|
| 中心对象 | 文档/会话 | Agent 实例 | 流程图节点 | **受控运行（Run）+ 事实链** |
| 历史可重放 | 文本流 | 不强保证 | 流程版本 | **Agent 版本快照 + sha256 指纹** |
| 审计 | 聊天历史 | 无 | 审计日志 | **append-only AuditEvent + 证据 hash** |
| 复核责任 | 无 | 无 | 流程审批节点 | **HumanReview 状态机 + 决策人事实** |
| 配额拦截 | 计费 | 无 | 资源配额 | **运行前 PolicyDecision + 配额门禁** |
| 行业语义 | 无 | 无 | 流程编排 | **Solution Pack（业务对象 + 规则 + 报告）** |
| 升级安全 | 不保证 | 不保证 | 流程版本 | **Eval + Release 通道（阶段四）** |

简言之：Neptune 不是更快地让 Agent 工作，而是让 Agent 工作变成**可治理可交付的企业事实**。

---

## 9. 客户旅程示例：一次月度关账

以中国某中型企业财务月结为例：

```
1. 月初（T+0）
   财务负责人登录交付台，看到 Solution Pack = "中国 ERP 月结关账"
   交付团队已经在客户项目里配好"关账智能体" + 绑定关账技能 + 上传科目表知识

2. T+1
   财务进入关账工作台，创建 2026-05 期间工作区
   状态：open

3. T+1
   点击「生成检查」
   → 后台创建受控运行
   → 平台执行 admission：通过
   → Agent 跑总账完整性检查、未过账凭证检查、凭证编号连续性检查
   → 状态：checking

4. T+1
   3 项检查跑完：
   - 检查 1：通过（passed）
   - 检查 2：发现 2 条异常（finding，severity=warning）
   - 检查 3：发现 1 条异常（finding，severity=blocking）
   状态：review_pending

5. T+1
   财务上传银行对账单 CSV 作为证据
   → 落 Artifact + EvidenceArtifact（sha256 + sourceSystem='manual-upload'）
   → 关联到对应 finding

6. T+2
   财务对每个 finding 提交复核：
   - finding 1: submit-review with reason → human_review pending
   - finding 2: submit-review with reason → human_review pending
   - finding 3: submit-review with reason → human_review pending

7. T+2
   财务 leader 收到通知，逐个决策：
   - finding 1: approve（确认是合理的跨期调整）
   - finding 2: approve
   - finding 3: waive（一次性处理，附豁免理由）
   → 状态：approved

8. T+2
   生成关账报告
   → close_reports.snapshot 包含：3 runs + 4 evidences + 3 findings + 3 reviews + 12 audit events
   → snapshot_hash = sha256(...)
   状态：closed

9. T+3
   客户技术治理方进入治理台
   → 看到本期 3 个 Run 的完整事实链
   → 看到 12 条审计事件
   → 导出 CSV 给外部审计师

10. T+30
    年度审计，外部审计师抽查 2026-05 关账：
    → 拿到 close_report 的 snapshot_hash
    → 在治理台输入 hash 即可校验完整性
    → 顺着事实链可以追溯到具体某条凭证、某次复核、某个决策人
```

整个流程**不需要业务用户写一行 prompt**，也**不需要技术治理方读聊天记录**。

---

## 10. 阶段一里程碑数字

| 维度 | 数值 |
|---|---|
| 已支持业务对象 | 22 张表 / 9 个共享 DTO 文件 |
| 平台事实链对象 | Run / RunEvent / ToolInvocation / Artifact / EvidenceArtifact / PolicyDecision / HumanReview / AuditEvent / AgentTemplateVersion |
| 关账业务对象 | CloseWorkspace / AccountingPeriod / ChecklistItem / Finding / CloseReport |
| API 端点 | 66 REST + 1 SSE 流 |
| 中文 UI 页面 | 9 个 |
| 自动化测试 | server 340 用例 + web 17 e2e |
| 治理文档 | 错误信封规范 + SSE 协议规范 + Git workflow + 仓库约定 |
| 设计文档 | 7 份产品/技术/服务/拓扑/路线图/并行规约 |
| 不修改 `neptune-engine` | ✅ 阶段一 0 行 |

---

## 11. 给销售/方案咨询的常见问答

**Q：Neptune 跟 ChatGPT、Claude、Cursor 有什么区别？**
A：那些是模型/编程辅助产品。Neptune 是企业平台——它围绕"让 Agent 在企业里做事"提供治理、审计、版本、复核能力。LLM 是它的引擎，不是它的产品。

**Q：你们要客户切换到你们自己的模型吗？**
A：不要。Neptune 是 model-agnostic 的，客户可以用 Anthropic、OpenAI、私有部署的模型。我们只承诺"可治理性"，不承诺特定模型。

**Q：客户数据会出客户网络吗？**
A：不会。私有化部署时，所有事实数据（运行、证据、审计）都在客户网络内的 PostgreSQL；模型调用走客户配的 provider key。Neptune Cloud 控制面（阶段四）只负责签名包分发与 benchmark，不承载客户业务数据。

**Q：能保证审计合规吗？**
A：审计事实永远 append-only，证据带 sha256，关账报告带 snapshot_hash，复核责任有完整决策人/时间链。"合规"由客户法务/审计方判定，但平台提供他们做判定所需的全部事实。

**Q：第一个 Solution Pack 是关账，第二个是什么？**
A：阶段一不回答这个问题。先把关账打磨到生产可用，再选第二个。

**Q：升级 Agent 会破坏既有合规吗？**
A：不会。每次运行使用的 Agent 配置都有不可变快照（agent_template_versions + 版本指纹）；历史运行永远可解释。阶段二/三还会引入 Eval + Release 通道做升级前安全验证。

**Q：客户能自定义业务规则吗？**
A：阶段一暂时不行。规则是 Solution Pack 内置的（关账目前内置 3 条规则）。阶段三引入 ControlRuleVersion 后规则可版本化扩展，但**不会做通用自然语言规则编辑器**——那条路在企业合规场景代价过大。

---

**文档结束**。如需具体业务/技术细节，参见：

- 战略与边界：`docs/strategy/neptune-agentops-platform-strategy.md`
- 产品架构决策：`docs/neptune-lab/design/01-product-architecture.md`
- 技术实现细节：`docs/neptune-lab/technical-architecture.md`
