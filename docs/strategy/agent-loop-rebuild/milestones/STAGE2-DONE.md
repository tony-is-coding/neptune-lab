# Stage 2 完成报告 — 契约 + 治理 hook + Permission Mode

> **状态**：✅ 完成（S2.1–S2.4 全绿）
> **守门**：7/7 PASS
> **测试**：agent-loop 248/248 / engine baseline 1264 pass / 63 known fail (Postgres 噪音)
> **commit 链**：`6e010df` (S2.1) → `5b9dbf8` (S2.2) → `777dd9f` (S2.3) → `<this>` (S2.4)

## 核心交付

Stage 2 把 neptune-engine 从"会跑的 agent loop"升级为"敢分发的 agent runtime kernel"——补齐 product/审计/合规之间的稳定接缝。

### 1. 稳定契约层（shared/contracts，S2.1）

7 个 zod schema，跨层稳定协议（neptune-engine ↔ neptune-engine-product ↔ 未来 SDK）：

| 契约               | 用途                             | 字段重点                                      |
|--------------------|----------------------------------|-----------------------------------------------|
| `Run`              | 一次端到端运行                   | runId, agentTemplate, status, timing          |
| `ToolInvocation`   | 单次工具调用                     | runId, toolName, inputSnapshot, status        |
| `Artifact`         | 通用产物                         | id, kind, mime, hash, source                  |
| `EvidenceArtifact` | Evidence-grade 产物（链式签名）  | hash, source.toolName, agentTemplateVersion   |
| `AuditEvent`       | 审计事件                         | runId, eventType, severity, payload           |
| `HumanReview`      | 人工复核                         | runId, reviewer, decision (approved/rejected) |
| `PolicyDecision`   | 策略决策                         | behavior (allow/deny/require_review), rule    |

设计要点：所有 schema `passthrough()` 让 product 安全扩展私有字段；engine 只解析公共字段。

### 2. Governance Hook 接口（S2.2）

4 类 hook + NoOp 默认实现，注入式接入 AgentLoop：

```ts
interface GovernanceHooks {
  policyHook?: PolicyHook         // 工具调用前策略决策
  humanReviewHook?: HumanReviewHook  // require_review 时挂起人工
  evalHook?: EvalHook             // run 完成后评估
  artifactHook?: ArtifactHook     // tool 输出落 EvidenceArtifact
}

interface PolicyHook {
  beforeToolUse(invocation: ToolInvocation): Promise<PolicyDecision>
}
interface HumanReviewHook {
  requestReview(req: HumanReviewRequest): Promise<HumanReview>
}
interface EvalHook {
  onRunComplete(runId: string, runResult: unknown): Promise<unknown | null>
}
interface ArtifactHook {
  persistArtifact(input: ArtifactInput): Promise<EvidenceArtifact>
}
```

### 3. PermissionMode 协议（S2.3）

5 mode × 5 category 决策矩阵（与 `cc` 对齐）：

| Mode \\ Category | read       | mutation   | exec       | network    | dangerous  |
|------------------|------------|------------|------------|------------|------------|
| default          | passthrough| passthrough| passthrough| passthrough| passthrough|
| plan             | passthrough| deny       | deny       | passthrough| deny       |
| readonly         | passthrough| deny       | deny       | deny       | deny       |
| dangerous        | allow      | allow      | allow      | allow      | passthrough|
| bypass           | allow      | allow      | allow      | allow      | allow      |

实现：`engine/permissions/PermissionMode.ts` 暴露 `applyPermissionMode(mode, category)` → `{behavior, reason?}`。
集成点：`ToolDispatcher` 在 `canUseTool` 之前先做 `applyPermissionMode` 检查；deny 直接包成 `tool_result.is_error`。

### 4. AgentLoop ↔ Governance 集成（S2.4，本批）

主循环每个 `tool_use` 块上挂一条治理流水线（与 `HookSurface.preTool/postTool` 解耦，串行不冲突）：

```
PolicyHook.beforeToolUse(invocation)
  ├─ allow         → preTool hook → ToolDispatcher → postTool hook
  ├─ deny          → tool_result.is_error (含 reason) → 不执行
  └─ require_review
        └─ HumanReviewHook.requestReview()
              ├─ approved → 继续
              └─ rejected → tool_result.is_error
```

每次 ToolDispatcher 输出 `update.mcpMeta._meta.artifactInputs`（产品级元数据约定）→ 调 `ArtifactHook.persistArtifact`。
loop 退出前调一次 `EvalHook.onRunComplete(runId, LoopResult)`。

**事件协议扩展**：
- `LoopEvent` 新增 `{type: 'governance_decision', event: GovernanceEvent}`
  - 4 个 phase：`pre_tool` / `human_review` / `artifact_persisted` / `eval_complete`
- `LoopEvent.error.phase` 新增 `'governance'`（hook 抛错 fail-open，不冲垮 loop）
- `LoopResult.governanceSnapshot?: { policyDecisionsCount, humanReviewsCount, artifactsPersistedCount, evalRunsCount }`

**Fail-open 语义**：governance hook 抛错 → emit `error` event (phase: 'governance') → 继续走 preTool hook 链 → 不影响业务正确性。安全敏感的拒绝必须显式返回 `behavior: 'deny'`，不依赖异常路径。

### 5. ToolDispatcher 协议升级（S2.4 顺带）

`ToolUpdate (kind: 'result')` 透传 `mcpMeta?: { _meta?, structuredContent? }`。让 AgentLoop 能从 dispatcher 输出读 product-level metadata（含 `artifactInputs` 数组），不必用 ctx-stash 传递（避免 race / 状态泄漏）。

## 测试覆盖

| 文件                                       | 测试数 | 覆盖场景                                               |
|--------------------------------------------|--------|--------------------------------------------------------|
| `shared/types/contracts/__tests__/`        |  18    | 7 schema 各 ~2-3 个 valid/invalid case                |
| `engine/governance/__tests__/`             |  11    | 4 hook NoOp 行为 + GovernanceHooks bag                |
| `engine/permissions/__tests__/`            |  38    | 5×5 决策矩阵 + AgentLoop 集成 (deny / passthrough)    |
| `engine/agent-loop/loop/__tests__/AgentLoopGovernance.test.ts` | 8 | PolicyHook deny/require_review/allow + ArtifactHook + EvalHook + 抛错 fail-open + snapshot 计数 |

总计 **75 新测试 / 0 fail**。

## Product 接入示例

```ts
import {AgentLoop} from '@neptune/engine'
import {createDbPolicyHook, createSlackReviewHook, createS3ArtifactHook} from './governance'

const result = await consume(AgentLoop.run({
  // ...
  governance: {
    policyHook: createDbPolicyHook({rulesTable: 'policy_rules'}),
    humanReviewHook: createSlackReviewHook({channel: '#audit'}),
    artifactHook: createS3ArtifactHook({bucket: 'evidence-prod'}),
    evalHook: createLangfuseEvalHook(),
  },
  context: {...ctx, runId: 'run-123', agentTemplateVersion: 'v2.4.0'},
}))

// result.governanceSnapshot.policyDecisionsCount === N
// result.governanceSnapshot.artifactsPersistedCount === M
```

## 进步 vs 上一阶段

1. **从"engine 单点决策"→"product 注入策略"**：engine 不再编码具体业务规则（哪个 tool 必须人工批准、哪些金额要审计），只提供"决策点"。
2. **从"日志滥用"→"结构化产物"**：EvidenceArtifact 强制 hash + source 指纹链，product 落 S3/IPFS/链上都行；engine 只算 sha256 默认。
3. **从"abort 是唯一红线"→"5 mode 配置"**：plan/readonly/dangerous/bypass 给上层 product UI 提供细粒度控制（cc PermissionMode 完整对齐）。
4. **从"单 SDK 风格"→"7 契约边界"**：未来要做 webhook / external-runner / multi-language SDK，shared/contracts 都是同一份 schema。

## 已知问题与下一步

### 问题
1. **`AgentTool` / `SkillTool` 业务剥离（S1.5/S1.6）**：仍含产品级业务字段，作为 post-Stage-2 处理（不阻塞 substrate 分发，因为它们是可选注入）。
2. **63 个 Postgres 测试失败**：与 governance 无关的预存噪音（数据库连接 / 连接池 / 事务回滚）。
3. **Sandbox 抽象（Stage 3）**：本阶段未做。tool 内部如何沙箱执行 shell / fs / net 还是依赖各 tool 自己实现；未来需要 `SandboxAdapter` 接口（local / docker / firecracker）。

### 下一步最佳计划

**Stage 3 — Sandbox 抽象 + Connector 协议层**（2 个核心方向）：

1. **Sandbox**（最高优）：抽象 `SandboxAdapter` 接口，本地默认实现复用 `cc` 的 prefix-aware bash + fs guards；docker 实现给到 product 注入。Sandbox 是 deny 之后唯一的真正护栏。
2. **Connector**：当前 builtin-tools 的 BashTool / FileEditTool / WebFetchTool 是 cc-shim 直跑；上 connector 协议（capability + version + scopes）后能：
   - 跨 agent 共享（一个 connector 实例多 agent 复用）
   - 注入 connectorVersion 到 EvidenceArtifact source（合规需求）
   - product 级 marketplace（"装上 Stripe connector"）

**优先级建议**：Sandbox > Connector > Telemetry（OpenTelemetry trace export）。

### 我的理解

Stage 1+2 完成定义达到："engine 可以独立编译 / 打包 / 分发给 product，product 按合规要求注入治理 hook + 沙箱后能落地金融 / 医疗 / 政务等强监管场景"。

实质性的进步 ≠ "代码重构得更整齐"，而是：
- **可测**：governance 全链路有 mock 注入路径（8 个新集成测试覆盖了 deny / require_review / approved / fail-open / snapshot 计数）
- **可分发**：守门脚本 7/7 PASS（builtin-tools 0 反向引用 / 0 React / 0 product import）
- **可信任**：合规链条闭环（PolicyDecision → ToolInvocation → EvidenceArtifact → HumanReview → AuditEvent，全部 zod schema 强类型）

距离"敢拿出去给金融客户"的目标还差 **Sandbox + Connector 协议**——这是 Stage 3 的事。
