# Harness 完整性深度 Review

> **产出时间**：2026-05-23
> **HEAD**：`63b7ff0`（Batch 16 收官）
> **目的**：盘清楚"完整 Agent Runtime Kernel（harness）"还缺什么，对齐战略目标

---

## 0. 一句话结论

我们这两天做的 **Batch 7-16 只解决了 substrate 的"思考 + 行动"两条腿**（agent loop + 鲁棒/效率层），是 harness 的一个**关键缺失补完**，不是完整 harness。

按战略文档（`neptune-agentops-platform-strategy.md` § 2.4 / 3.4 + `neptune-engine-runtime-kernel-design.md` 的 7 个 protocol + `neptune-engine-decoupling-handover.md` 的 5 个 P0/P1 task）盘点，**完整 harness 还有约 35-40% 的工作量没做**，主要在：

1. **workspace 解耦未完成**（builtin-tools 仍有 465 处反向依赖 src/...）
2. **shared 契约层不存在**（Run / ToolInvocation / Artifact / AuditEvent / HumanReview 都没建）
3. **治理 hook 没接入**（PolicyHook / HumanReviewHook / EvalHook / ArtifactHook 全部缺）
4. **关键工具未独立**（AgentTool / BashTool 等核心原语仍然依赖 product src/...）
5. **Channel protocol 未定义**（多 Agent 通讯接口空缺）
6. **Sandbox / Resource Limit 没有抽象**（让 agent 跑 bash 必备）
7. **Audit Trail / Append-only Log 没有协议**

---

## 1. 当前 harness 能力架构图（事实版）

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                          外部世界 / Product UX                            │
│            UI / 登录 / 远控 / Notebook / Cron 面板 / Marketplace          │
└────────────────────────────────────▲─────────────────────────────────────┘
                                     │ ❌ shared contracts (Run/Artifact/Audit/...) 缺失
┌────────────────────────────────────┴─────────────────────────────────────┐
│                      @neptune/engine （runtime kernel）                   │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────┐      │
│  │ ✅ agent-loop （Batch 7-16，本周新建）                          │      │
│  │  • SSE 解析 / MessageSerializer / ToolDispatcher / AgentLoop   │      │
│  │  • Retry / Fallback / Watchdog / Stall / Cancellation          │      │
│  │  • Caching / Compaction / Budget / CircuitBreaker              │      │
│  │  • UsageTracker / HookSurface (5 hook)                         │      │
│  └────────────────────────────────────────────────────────────────┘      │
│  ┌────────────────────────────────────────────────────────────────┐      │
│  │ ✅ Phase A protocols（cc92030 已落地）                          │      │
│  │  • Skill (manifest + formatter + InMemorySkillRegistry)         │      │
│  │  • Todo (InMemoryTodoState)                                     │      │
│  │  • TaskQueue (InMemoryTaskQueue)                                │      │
│  │  • ToolRegistry (关键词搜索)                                     │      │
│  │  • Memory (InMemoryMemoryStore)                                 │      │
│  └────────────────────────────────────────────────────────────────┘      │
│  ┌────────────────────────────────────────────────────────────────┐      │
│  │ ⚠️ permissions （半成品）                                        │      │
│  │  • PermissionDelegate / RBACPermissionDelegate / Audit / RO     │      │
│  │  • ❌ 无 Permission Mode (plan/readonly/dangerous) 协议           │      │
│  │  • ❌ 无 sandbox / resource limit 接口                            │      │
│  └────────────────────────────────────────────────────────────────┘      │
│  ┌────────────────────────────────────────────────────────────────┐      │
│  │ ⚠️ hooks （只有事件 hook，缺治理 hook）                           │      │
│  │  • HookCore / HookContext (executeNotificationHooks 等)          │      │
│  │  • ❌ PolicyHook / HumanReviewHook / EvalHook / ArtifactHook 全缺  │      │
│  └────────────────────────────────────────────────────────────────┘      │
│  ┌────────────────────────────────────────────────────────────────┐      │
│  │ ✅ provider                                                     │      │
│  │  • ProviderAdapter / Registry / 7 个 adapter (6 个 unsupported) │      │
│  │  • ✅ AnthropicStreamingProvider 真实可用                        │      │
│  │  • ⚠️ Bedrock/Vertex/OpenAI/Gemini/Grok/Foundry 6 个返 unsupported│      │
│  └────────────────────────────────────────────────────────────────┘      │
│  ┌────────────────────────────────────────────────────────────────┐      │
│  │ ⚠️ session/storage/observability/state/events                    │      │
│  │  • SessionContext / SessionManager / SQLiteStore （部分可用）     │      │
│  │  • EventBus / 事件流 (M2 已就绪)                                 │      │
│  │  • observability 模块存在但接入不深                               │      │
│  └────────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────┘
                                     │ ❌ 反向依赖污染未清零
┌────────────────────────────────────┴─────────────────────────────────────┐
│         @neptune/builtin-tools （应该独立的工具实现包）                   │
│  ┌────────────────────────────────────────────────────────────────┐      │
│  │ ✅ kernel/ (Phase B 11 工具，733d42d)                           │      │
│  │  • TodoWrite / Task* × 6 / ToolSearch / DiscoverSkills / Memory*│      │
│  └────────────────────────────────────────────────────────────────┘      │
│  ┌────────────────────────────────────────────────────────────────┐      │
│  │ 🔥 严重污染：14 个原语工具仍然 `from 'src/...'` (共 465 处)       │      │
│  │  • AgentTool/      147 处反向引用 + UI.tsx + AgentTool.tsx       │      │
│  │  • BashTool/       107 处反向引用 + UI.tsx                       │      │
│  │  • FileEditTool    33 + UI.tsx                                   │      │
│  │  • FileReadTool    31 + UI.tsx                                   │      │
│  │  • FileWriteTool   27 + UI.tsx                                   │      │
│  │  • SkillTool       27 + UI.tsx                                   │      │
│  │  • shared/         27 (含 spawnMultiAgent 等)                    │      │
│  │  • Notebook 11 / LSP 11 / WebFetch 10 / WebSearch 9 / Grep 9 /  │      │
│  │    Glob 8 / McpAuth 6 / MCP 2                                    │      │
│  │  • 12 个 UI.tsx 文件 (React/Ink 污染)                             │      │
│  └────────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 战略目标 vs 当前状态对照表

### 2.1 7 个 Runtime Kernel Protocol（kernel-design.md §3-9）

| Protocol | 战略要求 | 当前状态 | 完成度 |
|---|---|---|---|
| Tool | CoreTool 接口已稳定 | ✅ agent-tools 包已就位 | 100% |
| Skill | Manifest + Formatter + Registry | ✅ Phase A 完成 | 100% |
| Todo | TodoState + InMemory 实现 | ✅ Phase A 完成 | 100% |
| TaskQueue | TaskQueue + Task + InMemory 实现 | ✅ Phase A 完成 | 100% |
| ToolRegistry | 注册 + 搜索 + 默认实现 | ✅ Phase A 完成 | 100% |
| Memory | MemoryStore + InMemory 实现 | ✅ Phase A 完成 | 100% |
| **Channel** | **多 Agent 通讯抽象** | ❌ **未定义**（用户拍板"先不动"） | **0%** |

**结论**：Phase A 5 个已完成，Channel 按用户拍板"先不动"。Channel 不动可以接受，但**接口最好先定义**留口子。

### 2.2 Engine 独立编译 + workspace 解耦（handover.md Task #27/#28）

| 子目标 | 当前状态 |
|---|---|
| engine 源码 0 反向依赖 product | ✅ 已完成 |
| engine package.json 移除 product 依赖 | ✅ 已完成 |
| builtin-tools 0 反向依赖 src/... | ❌ **仍有 465 处** |
| builtin-tools 0 React/Ink 依赖 | ❌ **12 个 UI.tsx + 32 处 react import** |
| mcp-client 独立编译 | ✅ （0 反向依赖） |
| agent-tools 独立编译 | ✅ （0 反向依赖） |
| `cd neptune-engine && bunx tsc --noEmit` 通过 | ✅ 通过（因为 engine 自己干净） |
| `cd packages/builtin-tools && bunx tsc --noEmit` 通过 | ❌ 大量错误（依赖 src/...） |

**结论**：engine 自己干净了，但是兄弟包 builtin-tools **重度污染**，导致整个 workspace 不能独立打包。**Task #27 是当前最大的债**。

### 2.3 Shared 契约层（handover.md Task #29）

| 契约对象 | 用途 | 当前状态 |
|---|---|---|
| Run | Agent 执行核心事实 | ❌ **不存在** |
| ToolInvocation | 单次工具调用记录 | ❌ **不存在** |
| Artifact | 通用产物 | ❌ **不存在** |
| EvidenceArtifact | 受审计的证据子类型 | ❌ **不存在** |
| AuditEvent | append-only 审计事件 | ❌ **不存在** |
| HumanReview | 人工复核记录 | ❌ **不存在** |
| PolicyDecision | 策略决策记录 | ❌ **不存在** |
| EvalRun | 评估运行 | ❌ **不存在** |

`shared/types/neptune-ai/` 目录存在但**只放了 web/server API 类型**（threads / projects / chat-events 等），**完全没有这 8 个跨层稳定契约**。

**结论**：契约层完全空白，导致后续 #30/#31 治理 hook 无法成立（hook 接口签名需要这些类型）。

### 2.4 治理 Hook（handover.md Task #30/#31）

| Hook | 用途 | 当前状态 |
|---|---|---|
| PolicyHook | 工具调用前 policy 决策（allow/deny/require_review） | ❌ **未实现** |
| HumanReviewHook | finding 产生后挂起等待人工复核 | ❌ **未实现** |
| EvalHook | run 完成后触发评估 | ❌ **未实现** |
| ArtifactHook | 工具产出物落 EvidenceArtifact 边界 | ❌ **未实现** |

我们做的 Batch 11 `HookSurface` 只覆盖了**5 个事件 hook**（preStream / postStream / preTool / postTool / onError），属于"运行时切面"层面，不等于治理 hook。

**治理 hook 的关键差异**：
- 事件 hook 是"通知 + 旁路逻辑"，失败时 loop 继续
- 治理 hook 是"决策点 + 强制等待"（HumanReview 可能等几小时）+ 持久化结果（PolicyDecision / HumanReview / AuditEvent 都要写库）

**结论**：这是一个**完全独立的工程**，需要先做 #29 契约层再做这 4 个 hook。

### 2.5 Permission / Sandbox / Resource Limit（战略文档 §6 责任边界）

| 能力 | 当前状态 |
|---|---|
| `PermissionDelegate` 接口（onToolAccess） | ✅ 存在 |
| `RBACPermissionDelegate` / `AuditPermissionDelegate` / `ReadOnlyPermissionDelegate` | ✅ 存在 |
| **Permission Mode**（`bypass` / `default` / `plan` / `readonly` / `dangerous`）协议 | ❌ **未定义** |
| **Sandbox 接口**（让 BashTool 跑在隔离环境） | ❌ **未定义**（cc 用 SandboxManager 但耦合在 src/utils/sandbox） |
| **Resource Limit**（CPU / 内存 / 磁盘 / 网络配额） | ❌ **未定义** |
| **Working Directory 隔离** | ⚠️ 部分（cwd 字段存在，但无强制隔离） |

**结论**：Permission Mode 是 cc 用户每天都在用的核心特性（plan mode / readonly mode），engine 没有协议化。Sandbox 是企业部署必需，也没抽象。

### 2.6 Audit Trail / Append-only Log

| 能力 | 当前状态 |
|---|---|
| EventBus（运行时事件流） | ✅ 存在 |
| append-only AuditEvent 协议 | ❌ **未定义** |
| 不可篡改 trace（hash chain / signed） | ❌ **未实现** |
| RunEvent 持久化 | ⚠️ 部分（observability 有但接入浅） |

**结论**：合规场景（财务关账）必须有完整审计链。当前只是 EventBus，离 audit-grade 还有距离。

### 2.7 Provider 多模型路由

| 能力 | 当前状态 |
|---|---|
| ProviderAdapter 接口 | ✅ 存在 |
| ProviderRegistry | ✅ 存在 |
| AnthropicStreamingProvider | ✅ 真实可用（Batch 8 落地） |
| OpenAI / Gemini / Bedrock / Vertex / Grok / Foundry | ❌ **6 个全部返 unsupportedProductRuntimeProvider** |
| 多 model 路由策略（按 tier / 成本 / 能力） | ❌ **未定义** |

**结论**：除了 Anthropic，其他 6 个 provider 都是"门面"。要么真实做，要么从 engine 移走。当前状态是"半截"。

### 2.8 工具实现独立性

回顾 Phase B + agent-loop 之外的现状：

| 工具 | 应该 | 当前 | 行动 |
|---|---|---|---|
| BashTool | substrate 核心（行动能力） | 🔥 严重耦合 src/utils/Shell / sandbox / permissions | 解耦 + 抽象 Shell/Sandbox |
| FileRead/Write/Edit | substrate 核心（行动能力） | 🔥 中度耦合 src/utils/* + UI.tsx | 解耦 + 拆 UI |
| Glob/Grep | substrate 核心 | ⚠️ 轻度耦合 | 解耦相对容易 |
| AgentTool | substrate 核心（多 agent） | 🔥 极重耦合 + AgentTool.tsx + UI.tsx | 这是最大的一块 |
| SkillTool | substrate 核心（扩展） | 🔥 中度耦合 + UI.tsx | 解耦 + 转为 ctx.skillRegistry 调用 |
| WebFetch/WebSearch | substrate 通用 | ⚠️ 轻度耦合 | 解耦 |
| LSPTool | dev-time 通用 | ⚠️ 中度耦合 + UI.tsx | 解耦 |
| MCP* / McpAuth | substrate 标准 | ⚠️ 轻度耦合 | 解耦 |
| NotebookEditTool | product 特定（用户已表态） | 暂留 + UI.tsx | 移到 product |
| REPLTool / SendMessageTool / SleepTool | 待定 | 当前在 builtin-tools | 用户表态过 SendMessage 先不动 |

---

## 3. 完整 harness 应该是什么样

按"通用 Agent 应该有什么 vs Product 用户体验"边界，**完整 harness = 12 个能力维度**：

```text
Harness 完整能力图（终极目标）

┌─────────────────────────────────────────────────────────────────────────┐
│                              Harness Kernel                              │
│                                                                          │
│  [1] Agent Loop（思考闭环）       [2] Tool Dispatch（行动）              │
│      ✅ 100% (本周完成)             ✅ 100% (本周完成)                   │
│                                                                          │
│  [3] Memory（记忆）               [4] Planning（Todo + TaskQueue）       │
│      ✅ Phase A InMemory            ✅ Phase A InMemory                  │
│                                                                          │
│  [5] Skill（扩展能力）            [6] Tool Discovery（工具发现）         │
│      ✅ Phase A 完成                ✅ Phase A 完成                      │
│                                                                          │
│  [7] Multi-Agent Channel          [8] Provider Routing                  │
│      ⚠️ 用户拍板先不动              ⚠️ 仅 Anthropic 真实可用              │
│                                                                          │
│  [9] Permission / Sandbox         [10] Hook Surface（事件切面）          │
│      ⚠️ Delegate 部分               ✅ 5 hook (本周完成)                 │
│      ❌ Mode / Sandbox 缺           ❌ 治理 hook 4 类全缺                 │
│                                                                          │
│  [11] Observability / Audit       [12] Workspace 独立性                 │
│      ⚠️ EventBus 有                 ❌ builtin-tools 重度污染             │
│      ❌ Audit-grade 协议缺            ❌ shared 契约层缺                   │
└─────────────────────────────────────────────────────────────────────────┘

完成度估算：
  ✅ 4 项 100%      [1][2][6] + Phase A 五个 protocol 中的 [3][4][5]
  ⚠️ 5 项 部分      [3][4][7][8][9][10]
  ❌ 3 项 缺失       [11][12] + 治理 hook
```

整体完成度 **约 60-65%**（按能力维度加权）。

---

## 4. 必须补完才算 harness 闭环的清单

按工作量从大到小排，给用户一个明确的"还差什么"清单：

### 🔴 P0 — 阻塞独立分发的（不补 engine 不能算 substrate）

| 项 | 工作量 | 备注 |
|---|---|---|
| **A. builtin-tools 反向依赖清零（Task #27）** | 5-7 天 | 465 处 src/... 引用，最大的一块 |
| **B. 12 个 UI.tsx 文件迁移到 product** | 1-2 天 | substrate 不应有 React/Ink |
| **C. AgentTool 业务部分迁回 product，留接口** | 2-3 天 | 单 batch 最大 |
| **D. shared 契约层 6 个核心对象（Task #29）** | 2 天 | Run/ToolInvocation/Artifact/EvidenceArtifact/AuditEvent/HumanReview |

### 🟠 P1 — 阻塞合规与治理的

| 项 | 工作量 | 备注 |
|---|---|---|
| **E. PolicyHook + HumanReviewHook + EvalHook（Task #30）** | 2 天 | 依赖 D 的契约 |
| **F. ArtifactHook（Task #31）** | 1 天 | 依赖 D 的契约 |
| **G. Permission Mode 协议化** | 1-2 天 | plan/readonly/dangerous 五种模式 |
| **H. Sandbox 抽象**（让 BashTool 解耦 cc 的 SandboxManager） | 1-2 天 | 企业部署必备 |

### 🟡 P2 — 完善体验的

| 项 | 工作量 | 备注 |
|---|---|---|
| **I. Channel protocol 接口定义**（不实现，留口子） | 0.5 天 | 用户已表态先不动实现，但接口最好先定义 |
| **J. Audit-grade trail（hash chain + signed events）** | 2-3 天 | 财务关账场景刚需 |
| **K. Provider 6 个 unsupported 处理**（要么真做，要么砍） | 视决策 | 当前是"半截"状态 |
| **L. Phase B 工具的 zod→JSON Schema 转换层** | 0.5 天 | 让 Phase B 工具能直接接 AgentLoop |

### 总工作量估算

- **P0**：10-14 天（最关键）
- **P1**：5-7 天
- **P2**：3-7 天（J/K 视决策）
- **合计**：18-28 个工作日

---

## 5. 推荐的下一步路径（拆 5 阶段）

为了避免一次摊大饼，按"先拆，再补，最后治理"分阶段：

### Stage 1：解开 builtin-tools 死结（P0 A+B+C，10 天）

这是当前最大债。建议拆 3 个 sub-phase：

- **S1.1**：拆 UI 层（12 个 UI.tsx 全部迁到 product，**约 1 天**）
- **S1.2**：拆原语工具（FileRead/Write/Edit/Glob/Grep/Bash/Web*/LSP/MCP* —— 把 src/utils/* 引用改为 ctx 注入，**约 5 天**）
- **S1.3**：拆 AgentTool（拆出 builtInAgents 业务到 product，留 substrate 接口，**约 3 天**）

这一阶段做完，`bunx tsc --noEmit` 在所有 packages 都过，engine workspace 真正独立可分发。

### Stage 2：契约层 + 治理 hook（P0 D + P1 E+F+G，4-5 天）

- **S2.1**：shared 契约 6 个对象 zod schema（**约 2 天**）
- **S2.2**：PolicyHook + ArtifactHook + HumanReviewHook + EvalHook 接口 + 默认 NoOp 实现（**约 2 天**）
- **S2.3**：Permission Mode 协议化（**约 1 天**）

### Stage 3：Sandbox + Audit Trail（P1 H + P2 J，3-5 天）

- **S3.1**：Sandbox 接口抽象 + 默认 NoSandbox 实现（**约 2 天**）
- **S3.2**：Audit-grade trail（hash chain）（**约 2-3 天**）

### Stage 4：补口子（P2 I + L，1 天）

- Channel 接口定义（不实现）
- zod→JSON schema 转换层

### Stage 5：Provider 决策（P2 K，视决策）

- 真做（每个 provider 1-2 天）
- 砍（移到 product 作为 adapter，半天）

---

## 6. 第一性原理校验

让我用三个问题校验上面的清单是不是"屎上雕花"：

### Q1：这些项是不是 substrate 必须有的？

- A/B/C（workspace 独立）：**必须**。否则 engine 不能独立分发，目标自动失败。
- D（契约层）：**必须**。否则 server / engine / web 各自定义类型，永远无法统一。
- E/F（治理 hook）：**必须**。合规场景（财务关账）engine 必须暴露这些决策点，否则 product 无法挂钩。
- G（Permission Mode）：**必须**。"plan mode"是用户每天用的核心特性，没有抽象等于丢功能。
- H（Sandbox）：**必须**。让 LLM 跑 bash 没 sandbox 是企业部署红线。
- J（Audit Trail）：**必须**。审计场景刚需。
- I（Channel 接口）：**软必须**。不定义未来加会破坏 ABI。
- K（Provider 6 个）：**视决策**。要么真做要么砍 — 当前半截状态最差。
- L（zod→JSON）：**实用**。让 Phase B 真正可用。

**11 项里 8 项是 substrate 必须，2 项强烈推荐，1 项视决策**。没有屎上雕花。

### Q2：能不能再减？

可以减的地方：
- J（Audit-grade hash chain）可以**降级**成"事件持久化 + 顺序不可变"，hash chain 后置
- K（6 个 unsupported provider）建议**直接砍**到 product，不拖

但 A/B/C/D/E/F/G/H 都减不掉，否则不算 harness。

### Q3：会不会有更"通用 Agent 应该有"的能力被漏掉？

我对照了 LangChain / AutoGen / cc / OpenAI Assistant API 几家 agent runtime 的能力面，能想到的还有：

- **State persistence / Checkpoint**（让 agent 暂停 + 恢复）：当前 SQLiteSessionStore 部分覆盖，但没有"任意时刻 snapshot + 可恢复"能力。**建议加入 Stage 3**。
- **Streaming UI delta**（让用户看到逐字打字）：HookSurface 有 onStreamingDelta 钩子，但默认不暴露。**保持现状，product 接 hook 即可**。
- **Tool input schema 自校验**（在调 tool 之前用 schema 校验 input）：cc 有 `validateInput`，engine 有 ToolDispatcher 但没强制校验。**建议加入 Stage 2 末**。

---

## 7. 给用户的清晰汇报

### 7.1 我们这两天做了什么

- 把 cc agent loop 完整核心**重写最小干净版**搬进 engine（16 batch / 4400 行 / 231 测试 / 0 回归）
- 这相当于给 harness 装了**思考闭环 + 行动闭环 + 鲁棒性 + 效率层**
- engine 自己已经能独立编译、独立分发（**但 builtin-tools 还污染，整个 workspace 还不能**）

### 7.2 离完整 harness 还差什么

按 12 项能力维度，**完成度约 60-65%**。

最大的 3 块缺口：
1. **builtin-tools 反向依赖**（465 处 src/... + 12 个 UI.tsx + AgentTool 业务耦合）
2. **shared 契约层 + 4 个治理 hook**（合规场景刚需）
3. **Permission Mode + Sandbox**（企业部署刚需）

总剩余工作量约 **18-28 天**（5 个 stage）。

### 7.3 我建议的优先级

- **Stage 1（10 天）**：拆 builtin-tools 死结。**这一步如果不做，前面 16 batch 的成果也没法独立分发**，等于白做了一半。
- **Stage 2（5 天）**：契约层 + 治理 hook。**这是合规护城河的基石，对应战略文档的核心价值主张**。
- **Stage 3（5 天）**：Sandbox + Audit Trail。
- **Stage 4（1 天）**：补口子。
- **Stage 5（视决策）**：Provider 6 个砍 / 真做。

### 7.4 待用户拍板的事

1. **是否按 5 个 stage 推进**？还是先做 Stage 1 + Stage 2（最高优先级）？
2. **Stage 5 的 6 个 unsupported provider**：砍掉迁 product，还是真实做？
3. **Stage 3 的 Audit-grade trail**：是要 hash chain（合规级）还是只要持久化（开发级）？
4. **State persistence / Checkpoint** 是否纳入 Stage 3？

---

## 8. 模块完整度速查表（一页看清）

| 模块 | 文件 / 行数 | 测试 | 完成度 |
|---|---|---|---|
| **agent-loop（本周新建）** | 36 文件 / ~4400 行 | 231 | 🟢 100% |
| Phase A protocols | 20 文件 / ~2200 行 | 72 | 🟢 100% |
| Phase B kernel tools | 11 工具 / ~1500 行 | 集成 | 🟢 100% |
| ProviderAdapter / Anthropic | 8 文件 / ~600 行 | 11 | 🟢 100% |
| Provider 其他 6 个 | 6 文件 / unsupported | — | 🔴 0%（半截） |
| permissions/Delegate | 5 文件 / ~400 行 | 部分 | 🟡 60%（缺 Mode） |
| permissions/Sandbox | — | — | 🔴 0% |
| hooks/事件 hook | 2 文件 / ~80 行 | 11 | 🟢 100% |
| hooks/治理 hook | — | — | 🔴 0% |
| shared/契约 | — | — | 🔴 0% |
| session/storage | 多文件 | 部分 | 🟡 70% |
| events/EventBus | 多文件 | 部分 | 🟡 70% |
| observability | 多文件 | 浅 | 🟡 50% |
| **builtin-tools 原语工具** | 14 工具 / 大量 | 部分 | 🔴 30%（污染） |
| **builtin-tools UI** | 12 UI.tsx | — | 🔴 0%（应迁出） |

---

## 9. 一页总结（给老板看的版本）

```
✅ 已完成：
  • Agent Loop 完整核心（思考 + 行动 + 鲁棒 + 效率）
  • Phase A 5 个 protocol（Skill/Todo/Task/ToolReg/Memory）
  • Phase B 11 个 kernel tools
  • engine 自身 0 反向依赖

❌ 未完成（按重要性）：
  • builtin-tools 14 工具仍重度耦合 product (465 处反向引用 + 12 UI.tsx)
  • shared 契约层完全缺失（Run/ToolInvocation/Artifact/AuditEvent/HumanReview/...）
  • 治理 hook 全缺（PolicyHook/HumanReviewHook/EvalHook/ArtifactHook）
  • Permission Mode + Sandbox 协议化未做
  • Channel 多 Agent 通讯接口未定义
  • Audit-grade trail 未实现
  • 6 个非 Anthropic provider 还是 unsupported

剩余工作量：18-28 个工作日，分 5 个 stage 推进。
当前完成度：约 60-65%（按 12 项能力维度加权）。
```
