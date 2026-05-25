# neptune-engine v3.0 — Substrate 真实功能完整（v2.0 假绿纠偏 + 路线图）

> **One-liner**：v1.0 让它强大可用；v2.0 让它**看起来**干净；v3.0 揭穿假绿、纠偏方向、给出真正落地路径。

> **Status**：v2.1 in-progress（2026-05-25）— Stage A 审计完成，Stage B 5/30 sub-batch 完成
> **守门**：11/11 PASS（保持，但已知信号有缺陷，B10 升级为 5 Gate / ~41 项含 functional check）
> **测试**：1379 pass / 0 fail（v2.0 是 1327，B 阶段累计 +52 新测试）
> **真相**：substrate v2.0 是「双轨制假绿」状态，详见 §1

---

## 0. 三版本一页对比

| 维度 | v1.0（2026-05） | v2.0（2026-05-25 早） | v3.0 / v2.1 in-progress（2026-05-25 晚）|
|---|---|---|---|
| **守门 check** | 9/9 | 11/11 | 11/11（B10 升级 5 Gate / ~41 项） |
| **核心承诺** | "强大可用 harness" | "完全自闭环 substrate" | "真实功能完整 + 测试覆盖 + 工程干净 三者齐备" |
| **AgentTool / SkillTool** | substrate（耦合 cc） | ❌ 错误迁出 product | ✅ substrate 内薄壳 ~2700 + 430 行（B2/B6） |
| **Agent Teams（teammate）** | substrate（耦合 cc） | ❌ 错误迁出 product | ✅ substrate 必备能力，TeammateChannel 协议（B5） |
| **内置 4 agents** | substrate | ❌ 视为业务 | ✅ substrate baseline（**已落 02a7cf4**） |
| **agentMemory** | cc 业务 | ❌ 视为业务 | ✅ AgentScopedMemoryStore 协议（**已落 6cf34bc**） |
| **AgentEngine.query 路径** | 走 16-batch AgentLoop | ❌ 走 200 行 HeadlessQueryEngine stub | ✅ 走 AgentLoop（B7 解开双轨制）|
| **Sandbox 生产路径** | NoOp 占位 | NoOp 占位（绕过）| ✅ BashTool/FileWrite/WebFetch 接 ctx.sandbox（B9）|
| **守门信号** | 形式 PASS | **形式 PASS**（11/11 但功能漏） | **真实 PASS**（含 functional substrate 端到端 check） |
| **baseline 测试** | 1393 / 0 fail | 1327 / 0 fail | **1379 / 0 fail（B 阶段已累计 +52）** |
| **substrate 真实功能完整度** | ~70%（耦合但齐全） | ~60%（干净但残）| ~70% → 目标 100% |

---

## 1. v2.0 假绿纠偏 — 双轨制揭示

### 1.1 v2.0 自称「substrate 自闭环硬底线达成」是**误导**

v2.0 用「守门 11/11 PASS / packages 反向引用归零 / engine 仅 Anthropic provider」三项来证明 substrate 自闭环。但 Stage A 审计揭示：substrate 实际处于**双轨制假绿状态**：

```
左轨（守门覆盖、PASS）            右轨（守门盲区，问题集中地）
─ engine/agent-loop/* ✓          ─ AgentEngine.query() 走 HeadlessQueryEngine
─ engine/run/* ✓                    （200 行 stub，单轮纯文本，无工具/无 retry/
─ engine/audit/* ✓                   无 fallback/无 audit/无 sub-agent）
─ engine/governance/* ✓          ─ AgentRegistry 协议存在但 0 caller
─ engine/agent-registry/* ✓      ─ BashTool 等绕过 ctx.sandbox 直调原生 API
─ kernel-protocol tools ✓        ─ 守门 #10 漏检相对反向引用 ../../../../../src/
                                  ─ 4 个文件 dangling import 已迁出工具
                                  ─ AgentTool / SkillTool 启动能力缺失
                                  ─ teammate (agent teams) 整体迁出 product
```

**SDK 用户拿到 v2.0**，看上去 11/11 干净，但实际：

- Stage 7 完成的 16 个 agent-loop batch 能力（retry / fallback / watchdog / caching / compaction / budget / kernel）**全部生产路径未启用**，只在单测和 examples 内被 invoke
- 不能 spawn sub-agent（AgentTool 不在 substrate）
- 不能 invoke skill（SkillTool 不在 substrate）
- 不能跑 agent teams（teammate / spawnTeammate 不在 substrate）
- BashTool 调原生 child_process，Sandbox 注入无效

### 1.2 守门为什么说谎

v1.0/v2.0 的守门 80% 是工程洁癖检查（grep import / 文件名）+ 形式存在性检查（`[ -f file.ts ]`）+ env guard grep（examples 在 `process.env.ANTHROPIC_API_KEY` 缺失时退出 → 守门只验这一行）。**0 项功能契约**。

证据：
- `verify-harness-v1.sh` 18 项里仅 2 项是真功能（C.1/C.2 跨实例 resume）
- B.1-B.7 是 `[ -f xxx.ts ]` 文件存在 — 把 SandboxAdapter.ts 清空只留 `export {}`，B 全绿
- D.1-D.3 是 grep 'Set ANTHROPIC_API_KEY' — examples AgentLoop 一行没跑
- 守门 #10 仅查 `from 'src/`，漏检 `from '../../../../../src/'`（实测 SendMessageTool 13 处 + BashTool 2 处）

### 1.3 根因反思

v2.0 把「守门 PASS / 反向引用归零 / 架构干净」当成**目标**，本应是「substrate 真正可用」的**副产品**。当目标和副产品颠倒，工程洁癖就以牺牲功能完整性的方式表达 — 反向引用难剥离？把整个模块迁走。守门立刻绿了，但 substrate 实际功能漏了一大块。

### 1.4 工作红线（修正后）

> 1. substrate 自闭环 = 功能齐全 + 测试覆盖 + 工程干净。**三者缺一不算 PASS**。
> 2. cc 实现是被证明过的复杂状态机；二选一前先确认（substrate 内剥离 vs 写薄壳 + cc 留 product 作参考）。
> 3. 每次纠正后先重读 → 对齐 → 提交清单 → 再动手。
> 4. substrate 必备 vs 业务，模糊地带必须问用户。
> 5. 守门必须有一条 functional substrate 端到端 check，验「能 spawn / invoke 拿结果」。
> 6. 每个 sub-batch TDD red→green→commit→ff develop。

---

## 2. Stage A 审计结论（2026-05-25）

> 完整审计文档：`docs/strategy/STAGE-A-AUDIT.md`（4 subagent 并行实证盘点）

### 2.1 真实代码量（实测 wc -l）

cc AgentTool/SkillTool/spawnMultiAgent 实测 **8400 行**（不是之前估算的 5576）：

```
AgentTool 主体        4793 行（AgentTool/runAgent/agentToolUtils/resume/fork/
                              memory/memSnapshot/prompt/resultMapping/display/
                              colorMgr/builtIn/constants）
AgentTool built-in 4 agents  352 行（generalPurpose / explore / plan / verification）
SkillTool 主体        1383 行
spawnMultiAgent.ts    1089 行（teammate 业务）
src/ 子目录 stub shim  418 行
─────────────────────────
合计                  8035 行（不含 src/ shim：7617）
```

### 2.2 substrate 必备 vs 业务边界（用户拍板的 7 项决策）

| cc 模块 | 行数 | substrate 必备性 | 处理方式 |
|---|---|---|---|
| **A. 核心 ToolDef + run loop** | ~3000 | ✅ 必备 | 完整保留 ~2500-2800 行薄壳 |
| **B. teammate / agent teams** | ~1300 | ✅ **必备**（cc 两大特性之一） | 协议化 ~1000-1200 行（TeammateChannel + spawn 接口）|
| C. fork / worktree | ~600 | ❌ cc 业务 | **舍弃**（红线 #4 worktree 列业务）|
| D. agentMemory React UI | 部分 | UI 部分舍弃 | 协议化核心 ~150-200 |
| **E. async background launch** | ~100 内部 | ✅ 必备但协议化 | 用 TaskQueue + RunStore 替代（已证明效果不差，~100 行）|
| **F. resume sub-agent** | ~250 | ✅ 必备但协议化 | 用 RunStore.loadSnapshot + 3 cleanup filter（已证明效果不差，~100 行）|
| **G. 内置 4 agents** | ~352 | ✅ **必备**（LLM 自创建 baseline） | 完整保留 |
| **H. agentMemorySnapshot** | ~197 | ✅ 必备协议化 | 三 scope + snapshot 同步 ~150-200 |
| **I. SkillTool** | ~1383 | ✅ 必备 | 切片 ~430 行薄壳（剥 cc 命令系统/plugin/EXPERIMENTAL_SKILL_SEARCH/SAFE_SKILL_PROPERTIES）|

**substrate 必备总计**：~5000 行（cc 8400 行 / 可舍 ~3400 行业务装饰）。

### 2.3 v2.1 真正完成定义（A+B+C 14 条）

#### A. 功能完整性（5 条）
- A.1 SDK 用户能 spawn sub-agent（B2 + B7 完成）
- A.2 SDK 用户能 invoke skill（B6 + B7 完成）
- A.3 AgentEngine.query 走 AgentLoop（B7 完成）
- A.4 BashTool / FileWriteTool / WebFetchTool 走 ctx.sandbox（B9 完成）
- A.5 Cancellation 链路完整（B7.3 完成）

#### B. 测试覆盖（5 条）
- B.1 ScriptedProvider e2e — spawn sub-agent
- B.2 SkillTool e2e — invoke skill
- B.3 AgentEngine e2e — RunStore + Audit + Governance 都触达
- B.4 Resume 跨实例 — AgentEngine 路径
- B.5 SDK examples USE_SCRIPTED_PROVIDER=1 真跑 1 turn

#### C. 工程纪律（4 条）
- C.1 守门升级为 5 Gate / ~41 项（B10）
- C.2 守门 #10 修补相对反向引用
- C.3 清理 4 处 dangling import（**B0 ✅ 完成**）
- C.4 baseline 含 packages 测试

---

## 3. Stage B 实施进度（2026-05-25 实时）

> 完整计划：`docs/strategy/STAGE-B-PLAN.md`（11 批 ~37h）

### 3.1 已完成（5 sub-batch / 5 commits）

| Sub-batch | Commit | 内容 | 测试增量 |
|-----------|--------|------|---------|
| **B0** | `21aae69` | dangling import 清理 + AgentTool/NotebookEditTool name 常量 stub | (无新测) |
| **B1.1** | `6cf34bc` | AgentScopedMemoryStore 协议 + FilesystemAgentScopedMemoryStore | +19 |
| **B1.2** | `0fb317f` | resume messages cleanup 三 filter 流水线（cc 等价独立实现） | +17 |
| **B1.3 + B3** | `02a7cf4` | AgentRegistry.getBuiltIns + 4 baseline agents（generalPurpose/Explore/Plan/verification）| +18 |

baseline 演进：1327 → 1379 pass / 0 fail / +52 测试 / 守门 11/11 / tsc 0 错。

### 3.2 待完成（6 批 ~32h）

| 批次 | 内容 | 预估 | 关键产出 |
|------|------|------|----------|
| **B1.4** | TeammateChannel 协议 + InMemory 实现 | 1.5h | mailbox/broadcast/shutdown/plan_approval 4 类消息 |
| **B1.5** | 子进程接口预留（substrate 不引 tmux） | 0.5h | 接口定义，让 product 注入 |
| **B2** | SubAgentTool 薄壳（核心 P0）| 8h | ~2700 行 + 22 项功能契约 |
| **B4** | Async + Resume 协议化 | 3h | run_in_background + resume 走 substrate 协议 |
| **B5** | Agent Teams 薄壳 + SendMessageTool 反向引用清理 | 5h | TeammateChannel 实现 + spawnTeammate 协议 + 13 处反向引用清 |
| **B6** | SkillTool 薄壳 | 3h | ~430 行（剥 cc 命令系统/plugin/EXPERIMENTAL_SKILL_SEARCH）|
| **B7** | AgentEngine.query 改走 AgentLoop（解开双轨制）| 4h | 16 agent-loop batch 能力全上生产路径 |
| **B8** | 工具拓扑收尾（SleepTool 剥 proactive 等）| 2h | 反向引用真正归零 |
| **B9** | Sandbox 生产路径集成 | 2h | BashTool/FileWrite/WebFetch 接 ctx.sandbox |
| **B10** | 守门升级 v2.sh 5 Gate / ~41 项 + v3.1 文档 | 3h | 守门 PASS = substrate 真的可用 |

---

## 4. 真实架构（v3.0 双轨制 + 待闭合状态）

```
┌────────────────────────────────────────────────────────────────────┐
│                  External SDK Consumer                              │
│   (in-process / + FileRunStore / + http SSE server)                 │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│  @neptune/engine v3.0/v2.1 in-progress（待解开双轨制）               │
│                                                                     │
│  ⚠️ 双轨现状：                                                       │
│  ┌────────────────────────────┬──────────────────────────────┐     │
│  │ AgentLoop 轨道（16 batch） │ AgentEngine 生产轨道（B7 待）│    │
│  │ ✅ retry/fallback/watchdog│ ⚠️ 走 200 行 HeadlessQueryEngine│  │
│  │ ✅ caching/compaction     │ ⚠️ 不接 RunStore/Audit/Gov     │   │
│  │ ✅ budget/kernel          │ ⚠️ 单轮纯文本，无工具调度      │  │
│  │ ✅ 跨实例 resume e2e      │ ⚠️ Cancellation 链路断裂        │ │
│  │ 仅在测试 + examples 用    │                              │     │
│  └────────────────────────────┴──────────────────────────────┘     │
│                                                                     │
│  Core Substrate（已稳定）                                            │
│  ├─ AgentLoop + Run/RunStore + runWithStore + resume                 │
│  ├─ ToolDispatcher + ToolUseContext + Sandbox 协议                   │
│  ├─ HookSurface (5 event hook) + GovernanceHooks (4 类)              │
│  └─ PermissionMode 5×5 决策矩阵                                       │
│                                                                     │
│  Protocols + 双默认实现（已稳定）                                    │
│  ├─ RunStore: InMemoryRunStore + FileRunStore + Checkpoint           │
│  ├─ SessionStore / ContentStore                                      │
│  ├─ MemoryStore: InMemoryMemoryStore                                 │
│  ├─ AgentScopedMemoryStore: FilesystemAgentScopedMemoryStore ✅ B1.1 │
│  ├─ AgentRegistry: getBuiltIns() + 4 baseline ✅ B1.3+B3              │
│  ├─ SkillRegistry / TaskQueue / TodoState / ToolRegistry             │
│  ├─ SandboxAdapter: NoOpSandbox + LocalSandbox                       │
│  ├─ AuditEventStore: NoopAuditStore + FilesystemAuditStore           │
│  ├─ ArtifactStore: LocalArtifactStore                                │
│  ├─ Tracer / Metrics: NoOp + InMemoryMetricsProvider                 │
│  └─ Channel: 接口 + InMemoryChannel                                  │
│                                                                     │
│  packages/builtin-tools/ — 工具集（部分功能性 dangling 待清）          │
│  ├─ kernel/ × 11 ✅                                                   │
│  ├─ Bash/FileRead/Write/Edit/Glob/Grep/Web*/LSP × 9 ✅                │
│  ├─ List/ReadMcpResources × 2 ✅                                      │
│  ├─ MCPTool / SleepTool ✅                                            │
│  ├─ AgentTool/constants.ts (B0 stub) — ToolDef 待补 B2 ⏸️            │
│  ├─ NotebookEditTool/constants.ts (B0 stub) — ToolDef 留 product     │
│  ├─ REPLTool — 临时移除 AgentTool 引用，B2 后回归 ⏸️                  │
│  └─ SendMessageTool — 13 处反向引用待清，B5 处理 ⏸️                   │
│                                                                     │
│  待补（B2/B5/B6/B7/B9）：                                             │
│  ├─ ⏸️ SubAgentTool 薄壳 ~2700 行（B2）                               │
│  ├─ ⏸️ SkillTool 薄壳 ~430 行（B6）                                   │
│  ├─ ⏸️ TeammateChannel + spawnTeammate（B1.4 + B5）                   │
│  ├─ ⏸️ AgentEngine 接 AgentLoop（B7 解开双轨制）                      │
│  └─ ⏸️ BashTool/FileWrite/WebFetch 接 ctx.sandbox（B9）               │
│                                                                     │
│  Dependencies: @anthropic-ai/sdk + zod + crypto                     │
└────────────────────────────────────────────────────────────────────┘
                             ▲
                             │ 注入
┌────────────────────────────┴───────────────────────────────────────┐
│  @neptune/engine-product (业务层，参考实现，未来可废弃)              │
│                                                                     │
│  src/cc-tools/  ← v2.0 错误迁出 + v3.0 计划保留为参考                  │
│  ├─ AgentTool/    ⚠️ v3.0 应同时存在 substrate 薄壳 + 这里完整 cc      │
│  ├─ SkillTool/    ⚠️ 同上                                              │
│  ├─ NotebookEditTool/ ✅ 正确（Jupyter 业务）                          │
│  ├─ McpAuthTool/      ✅ 正确（MCP auth 业务）                         │
│  ├─ spawnMultiAgent.ts ⚠️ v3.0 拆 substrate 协议 + 这里完整 cc         │
│  └─ provider/         ✅ 正确（6 unsupported provider stub）           │
│                                                                     │
│  src/storage/      (PgRunStore / RedisMemoryStore / S3 等业务后端)     │
│  src/agent-adapter/ (cc agent-adapter 业务装饰)                       │
│  src/governance/    (LangfuseEvalHook / SlackReviewHook)              │
│  src/observability/ (OTelTracer / PrometheusMetrics)                 │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. 已完成的 substrate 关键能力（v3.0 截面）

### 5.1 Agent Loop（v1.0 完成的 16 batch）

| Batch | 能力 | 状态 |
|-------|------|------|
| 7 | SSE Parser + ContentBlockAccumulator | ✅ |
| 8 | MessageSerializer + Streaming Provider | ✅ |
| 9 | ToolDispatcher + ToolUseContext | ✅ |
| 10 | AgentLoop multi-turn while + stop_reason 状态机 | ✅ |
| 11 | UsageTracker + HookSurface + Cancellation | ✅ |
| 12 | Retry / Fallback | ✅ |
| 13 | Watchdog | ✅ |
| 14 | Prompt Caching | ✅ |
| 15 | History Compaction | ✅ |
| 16 | Budget + CircuitBreaker | ✅ |

⚠️ **当前生产路径未启用，B7 完成后才会生效**。

### 5.2 状态外化（v1.0 完成）

- `Run` + `RunStore` 协议 + InMemory + Filesystem 双默认
- `loadSnapshot` / `loadCheckpoint` 重建中间状态
- jsonl append-only events，NFS 友好
- **跨实例 resume e2e 测试**：engine A 跑完 turn 1 → engine B（独立实例）resume 续跑 turn 2 → end_turn ✅
- 5 个集成测试覆盖

### 5.3 内置 4 baseline agents（B1.3 + B3 已落 02a7cf4）

```ts
import {InMemoryAgentRegistry} from '@neptune/engine'

const registry = new InMemoryAgentRegistry()
await registry.registerBuiltIns()
// 现在可用：general-purpose / Explore / Plan / verification
```

| Agent type | 用途 | model | tools |
|------------|------|-------|-------|
| `general-purpose` | 全工具池研究 | host 默认 | 全部 |
| `Explore` | 快速 read-only 搜索 | `haiku` | Glob/Grep/FileRead/Bash/Web*/LSP |
| `Plan` | read-only 实施规划 | `inherit` | 同 Explore |
| `verification` | try-to-break 验证（runInBackground=true）| `inherit` | 同 Explore |

### 5.4 Agent-scoped Memory（B1.1 已落 6cf34bc）

cc agentMemory + agentMemorySnapshot 等价协议（剥业务依赖后）：

```ts
import {FilesystemAgentScopedMemoryStore} from '@neptune/engine'

const store = new FilesystemAgentScopedMemoryStore({
  userBaseDir: `${process.env.HOME}/.neptune/agent-memory`,
  projectBaseDir: `${cwd}/.neptune/agent-memory`,
  localBaseDir: `${cwd}/.neptune/agent-memory-local`,
  snapshotBaseDir: `${cwd}/.neptune/agent-memory-snapshots`,
})

// 三 scope 隔离写入
await store.write('reviewer', 'project', 'MEMORY.md', '...')

// snapshot 同步
const result = await store.checkSnapshot('reviewer', 'user')
if (result.action === 'initialize') {
  await store.initializeFromSnapshot('reviewer', 'user', result.snapshotTimestamp)
}
```

19 个测试覆盖三 scope 隔离 + snapshot init/replace/markSynced 幂等 + atomic write + agent type sanitize。

### 5.5 Resume 前 messages 清理（B1.2 已落 0fb317f）

cc resumeAgent 三 filter 流水线在 substrate 内独立实现：

```ts
import {cleanupForResume} from '@neptune/engine'

const cleaned = cleanupForResume(messages)
// 删半截 tool_use + 孤儿 thinking + 全空白 assistant
// 三 filter 标准组合：
//   filterUnresolvedToolUses
//   filterOrphanedThinkingOnlyMessages
//   filterWhitespaceOnlyAssistantMessages
```

17 个测试覆盖纯函数 + 边界 + 三 filter 组合。

### 5.6 Governance Hooks（v1.0 完成）

```ts
interface GovernanceHooks {
  policyHook?: PolicyHook         // 工具调用前 allow/deny/require_review
  humanReviewHook?: HumanReviewHook  // Finding 后挂起人工复核
  evalHook?: EvalHook             // Run 完成后评估
  artifactHook?: ArtifactHook     // Tool 输出落 EvidenceArtifact
}
```

接口 + NoOp 默认实现 + AgentLoop 注入点。⚠️ AgentEngine 生产路径**未接入**，B7 解开。

### 5.7 Audit 不可篡改链（v1.0 完成）

`AuditEventStore` + `FilesystemAuditStore` + sha256 prevHash 链。verify(runId) 重算整个 chain，篡改任意中间 event 必被检出。4 类篡改全检出测试覆盖。

### 5.8 Sandbox 决策矩阵（v1.0 完成）

`SandboxAdapter` + `LocalSandbox` 24 case 决策测试覆盖：
- exec 命令 deny 列表 / allow 列表
- readFile / writeFile 路径 deny / allow
- fetch URL deny / allow

⚠️ 工具生产路径未走 ctx.sandbox，B9 解开。

### 5.9 Observability（v1.0 完成）

`ITracingProvider` / `IMetricsProvider` 接口 + NoOp 默认 + InMemoryMetricsProvider。OTel-compatible，AgentLoop 主循环 + 每个 turn + 每个 tool 包 span。

### 5.10 SDK 三种使用姿势

```bash
# 1. 纯 SDK in-process
ANTHROPIC_API_KEY=sk-... bun run examples/sdk-pure.ts

# 2. SDK + FileRunStore（state 外化 + resume）
ANTHROPIC_API_KEY=sk-... bun run examples/sdk-with-fs-store.ts
ANTHROPIC_API_KEY=sk-... bun run examples/sdk-with-fs-store.ts --resume <runId>

# 3. SDK + 极简 HTTP server（SSE 流，0 外部 deps）
ANTHROPIC_API_KEY=sk-... bun run examples/sdk-with-server.ts
curl -X POST http://localhost:3000/runs -d '{"prompt":"hello"}'
curl http://localhost:3000/runs/<runId>/events
```

⚠️ examples 使用 AgentLoop 直接（绕过 AgentEngine），B7 解开后 AgentEngine 也走 AgentLoop。

---

## 6. v3.0 → v2.1 完成判定（必须三者齐备）

### 6.1 守门 v2.sh 设计（B10 实现）

替代 v1.0/v2.0 的 `verify-harness-v1.sh`，5 Gate / ~41 项：

```
─── Gate A 干净度（13 项，保留 v2.0 11 项 + 修补）───
A.1-A.11: v2.0 既有 11 项守门
A.12: 相对反向引用 ../../../../../src/ = 0
A.13: 调试残留（console.log / TODO / FIXME）上限

─── Gate B 协议契约（10 项，替代 v1 文件存在）───
B.1: bun test src/engine/agent-loop PASS
B.2: bun test src/engine/run PASS（含 e2e/AgentLoopRunStore）
B.3: bun test src/engine/audit PASS
B.4: bun test src/engine/sandbox PASS
B.5: bun test src/engine/governance PASS
B.6: bun test src/engine/observability PASS
B.7: bun test src/engine/agent-registry PASS（含 builtins）
B.8: bun test src/engine/memory PASS（含 AgentScoped）
B.9: bun test src/engine/skill PASS
B.10: bun test src/engine/channel PASS

─── Gate C 工具调度（5 项，v1 完全缺失）───
C.1: e2e/multiTool 一轮多 tool_use PASS
C.2: PermissionMode 5×5 矩阵 PASS
C.3: HookSurface 5 event 串联 PASS
C.4: 11 kernel tool 协议联动 PASS
C.5: ToolRegistry / ToolDispatcher PASS

─── Gate D 端到端功能（9 项，红线 #5 — functional substrate）───
D.1: ScriptedProvider AgentLoop 完整 turn PASS
D.2: SubAgentTool spawn → result 回填 PASS（B2 后启用）
D.3: SkillTool invoke → sub-agent → result PASS（B6 后启用）
D.4: TeammateChannel mailbox 通信 PASS（B5 后启用）
D.5: AgentLoop.runWithStore + 跨实例 resume PASS
D.6: AuditEventStore 4 类篡改全检出 PASS
D.7: GovernanceHooks 4 类全链路 PASS
D.8: Cancellation parent abort → child abort PASS
D.9: SDK 3 examples USE_SCRIPTED_PROVIDER=1 真跑 1 turn PASS

─── Gate E 量化基线（5 项）───
E.1: bun test src + packages baseline ≥ 1500 PASS（含 packages 测试）
E.2: bunx tsc engine 0 错
E.3: bunx tsc 3 packages 全 0 错
E.4: SDK API .d.ts 表面快照
E.5: 守门套娃（v2.sh 自身可被 CI 跑）
```

### 6.2 v3.0 → v2.1 14 条完成判定

| # | 条目 | 状态 | 阶段 |
|---|------|------|------|
| **A. 功能完整性** |  |  |  |
| A.1 | SDK spawn sub-agent | ⏸️ | B2 + B7 |
| A.2 | SDK invoke skill | ⏸️ | B6 + B7 |
| A.3 | AgentEngine.query 走 AgentLoop | ⏸️ | B7 |
| A.4 | BashTool/FileWrite/WebFetch 走 ctx.sandbox | ⏸️ | B9 |
| A.5 | Cancellation 链路完整 | ⏸️ | B7.3 |
| **B. 测试覆盖** |  |  |  |
| B.1 | ScriptedProvider e2e spawn sub-agent | ⏸️ | B2.9 |
| B.2 | SkillTool e2e invoke | ⏸️ | B6.7 |
| B.3 | AgentEngine e2e RunStore+Audit+Gov | ⏸️ | B7.4 |
| B.4 | Resume 跨实例 AgentEngine 路径 | ⏸️ | B4 + B7 |
| B.5 | SDK examples 真跑 1 turn | ⏸️ | B10 |
| **C. 工程纪律** |  |  |  |
| C.1 | 守门升级 5 Gate / ~41 项 | ⏸️ | B10.1 |
| C.2 | 守门 #10 修补相对反向引用 | ⏸️ | B10 |
| C.3 | 4 处 dangling import 清理 | ✅ | B0 |
| C.4 | baseline 含 packages 测试 | ⏸️ | B10 |

进度：1/14 = 7%（红线 #1 — 三者齐备才算 v2.1 完成）。

---

## 7. 关键设计决策（v3.0 视角）

### 7.1 Sub-agent vs Agent Teams 都是 substrate 必备能力

cc 从 2024 → 2025 演化出**两个并立的多 agent 模式**，substrate 必须都支持：

| 维度 | Sub-agent（AgentTool） | Agent Teams（teammate） |
|------|------------------------|-------------------------|
| 启动者 | parent agent（LLM 主动用）| user / tool 显式 spawnTeammate |
| 关系 | 严格 parent → child | 平等 teammates + 一个 team lead |
| 通信 | tool_use → tool_result | mailbox 异步消息（SendMessageTool）|
| 上下文 | child 独立上下文 | 每个 teammate 独立 session |
| 终态 | child end_turn → result 回填 | shutdown_request → approve / reject |
| 后端 | 同进程串行/并发 | tmux 多 pane / in-process 多 LLM 循环 / splitpane |

v2.0 错误把 teammate 列为「业务舍弃」，v3.0 纠正：**TeammateChannel 协议 + spawnTeammate 协议是 substrate 必备**（B1.4 + B5 落地）。tmux/swarm 业务实现保留 product/cc-tools/spawnMultiAgent.ts 作参考。

### 7.2 内置 4 agents 必须保留 substrate

> 用户拍板：「未来 LLM 会越来越强，会具备更强大的自创建 agent 的能力」

internal 4 baseline agents（generalPurpose / Explore / Plan / verification）是 LLM 自创建 agent 时的 anchor，必须在 substrate 默认提供。已落 02a7cf4。

### 7.3 状态外化 ≠ 数据库

substrate 双默认（InMemory + Filesystem）覆盖 90% 场景。**Filesystem 是分布式场景下的关键选择**（NFS 友好，所有进程都能 atomic 读写）。

```
Application → @neptune/engine
              ↓
              FilesystemRunStore("/mnt/nfs/runs/")  ← 多机共享 mount
              ↓                                        atomic rename + jsonl append
              Storage Layer
```

Pg / Redis / S3 后端由 product 注入，substrate 不绑数据库。

### 7.4 cc 实现是被证明过的复杂状态机

> 红线 #2：你的判断「重写更薄/更干净」必须跑过用户 review 才能执行

v2.0 错误把 cc AgentTool 5576 行整体迁出 + 自负判断「重写薄壳更干净」，结果 substrate 失去 sub-agent 启动能力。v3.0 纠正：substrate 内薄壳 ~2700 行（剥业务装饰，保留状态机骨架），cc 完整版保留 product 作参考。

### 7.5 守门必须有 functional substrate 端到端 check

> 红线 #5：守门必须有一条 functional substrate 端到端测试，验「能 spawn / invoke 拿结果」。**只检查反向引用归零的守门是骗人的**。

v2.0/v1.0 的守门 80% 是工程洁癖，0 项功能契约。B10 升级后守门 ~41 项含 D Gate 9 项端到端功能 check。

---

## 8. v3.0 量化总览（双轨制 + 进展）

| 维度 | v1.0 | v2.0 | v3.0/v2.1-in-progress |
|---|---|---|---|
| **守门 check** | 9/9 | 11/11 | 11/11（B10 升级 ~41 项）|
| **总测试** | 1393/0 fail | 1327/0 fail | **1379/0 fail** |
| **测试 +/− vs 上一版** | — | -66（迁出 provider 测试）| **+52（B 阶段）** |
| **packages 反向引用** | 14 文件 / 47+ 处 | 形式 0 | **形式 0 + 1 处功能性待清（SendMessageTool resumeAgent，B5）**|
| **functional substrate 守门** | ❌ | ❌ | **B10 后启用** |
| **Sub-agent 启动能力** | ✅（耦合 cc） | ❌ 整体迁出 | **B2 后恢复（薄壳）**|
| **Skill 启动能力** | ✅（耦合 cc）| ❌ 整体迁出 | **B6 后恢复（薄壳）**|
| **Agent Teams** | ✅（耦合 cc） | ❌ 整体迁出 | **B5 后恢复（协议化）**|
| **内置 4 agents** | ✅（cc 业务）| ❌ 视为业务 | **✅ B1.3+B3 已落（baseline）**|
| **agentMemory 协议** | ❌ 散落 cc | ❌ 视为业务 | **✅ B1.1 已落（FilesystemAgentScopedMemoryStore）**|
| **resume cleanup filter** | cc-shim 依赖 | cc-shim 依赖 | **✅ B1.2 已落（substrate 独立）**|
| **AgentEngine.query 路径** | 16 batch AgentLoop | 200 行 stub | **B7 解开双轨制** |
| **生产路径接 RunStore** | ✅ | ❌ | **B7 解开** |
| **生产路径接 Audit** | ✅ | ❌ | **B7 解开** |
| **生产路径接 Sandbox** | ⚠️ 占位 | ⚠️ 占位 | **B9 解开** |
| **协议 + 双默认实现** | 9 类 | 9 类 | **10 类**（+ AgentScopedMemoryStore）|
| **agent-registry baseline** | 0 | 0 | **4 个**（已落）|

---

## 9. 给老板的一页总结

```
neptune-engine v3.0 = 揭穿 v2.0 假绿 + 给出真正落地路径

v2.0 自称 substrate 自闭环，实际是「双轨制假绿」：
✗ 守门 11/11 但 80% 是工程洁癖检查，0 项功能契约
✗ AgentTool / SkillTool / agent-teams 整体迁出 → substrate 残
✗ AgentEngine.query 走 200 行 stub，不接 16-batch AgentLoop
✗ BashTool 等绕过 ctx.sandbox 直调原生 API

v3.0 通过 Stage A 实证审计 + Stage B 落地修复，
分 11 批 ~37h 让 substrate 真正功能完整：

已完成（5/30 sub-batch / 5 commits / +52 测试）：
✅ B0  dangling import 清理
✅ B1.1 AgentScopedMemoryStore 协议（cc agentMemory 等价）
✅ B1.2 resume messages cleanup 三 filter（cc 等价独立实现）
✅ B1.3 + B3 AgentRegistry.getBuiltIns + 4 baseline agents

待完成（25/30 sub-batch / ~32h）：
⏸️ B1.4-B1.5 TeammateChannel + 子进程接口预留（2h）
⏸️ B2  SubAgentTool 薄壳 ~2700 行（8h）
⏸️ B4  Async + Resume 协议化（3h）
⏸️ B5  Agent Teams 薄壳 + SendMessageTool 反向引用清理（5h）
⏸️ B6  SkillTool 薄壳 ~430 行（3h）
⏸️ B7  AgentEngine 接 AgentLoop（解开双轨制，4h）
⏸️ B8  工具拓扑收尾（2h）
⏸️ B9  Sandbox 生产路径（2h）
⏸️ B10 守门升级 5 Gate / ~41 项 + v3.1 文档（3h）

v2.1 完成定义（14 条）：
- A 功能完整性 5 条 ⏸️
- B 测试覆盖 5 条 ⏸️
- C 工程纪律 4 条（C.3 ✅，C.1/C.2/C.4 ⏸️）

substrate 真正承诺：功能齐全 + 测试覆盖 + 工程干净，三者齐备才算 PASS。
```

---

## 附录 A — Stage A 审计的关键证据（精选）

### A.1 AgentRegistry 协议存在但 0 caller

```bash
$ grep -r "agentRegistry" packages/builtin-tools/src src/engine
# 仅协议定义本身，0 实际调用
```

### A.2 守门 #10 漏检相对反向引用

```bash
$ grep -rln "from '\.\./\.\./\.\./\.\./\.\./src/" packages/*/src
packages/builtin-tools/src/tools/SendMessageTool/SendMessageTool.ts  # 13 处
packages/builtin-tools/src/tools/BashTool/BashTool.ts                # 2 处
```

### A.3 AgentEngine 生产路径走 200 行 stub

```ts
// engine/cc-runtime/HeadlessQueryEngine.ts (实测 200 行)
async* submitMessage(input: unknown) {
  // 单轮 fetch + text_delta，不走 AgentLoop
  // 不接 RunStore / Audit / Governance / kernel bag
}
```

### A.4 examples 守门是 grep env guard

```bash
# verify-harness-v1.sh:88
"D.1 sdk-pure example 可加载"
  bun run examples/sdk-pure.ts 2>&1 | grep -q 'Set ANTHROPIC_API_KEY'
# AgentLoop 一行没跑过
```

---

## 附录 B — 主目标不丢失锚点（每批必检）

```
1. 每个 sub-batch TDD red→green→commit→ff develop
2. 守门必跑 verify-workspace-independent.sh
3. baseline 不退化（bun test src + packages，pass 不能少）
4. 任一改动若与 7 项决策不符 → 立即停手汇报
5. 大改前先红测试（B7 重接 AgentLoop 必须先有 e2e red 测试）
6. 任一退化立即 git revert
7. 任一新念头「这一步绿就够了」→ 停手向用户求证
```

---

## 附录 C — 7 项决策回顾（用户已 approve）

| # | 决策 | 根据 |
|---|------|------|
| 1 | Sub-agent + Agent Teams 都是 substrate 必备 | cc 两大特性 / 红线 #4 |
| 2 | 内置 4 agents 必须保留 substrate | LLM 自创建 baseline 需要 anchor |
| 3 | agentMemory 双文件协议化（FilesystemAgentScopedMemoryStore）| substrate memory 范畴 |
| 4 | async background launch 协议化（TaskQueue + RunStore 替代 cc 807 行 LocalAgentTask）| 已证明效果不差 |
| 5 | resume sub-agent 协议化（RunStore.loadSnapshot + 3 cleanup filter）| 已证明效果不差 |
| 6 | SkillTool 切片保留 7 段 ~430 行薄壳 | 剥 cc 命令系统/plugin/EXPERIMENTAL_SKILL_SEARCH/SAFE_SKILL_PROPERTIES |
| 7 | substrate 必备 ~5000 行（cc 8400 - 业务 ~3400）| 实测 wc -l + 切片审计 |

---

**文档版本**：v3.0
**最后更新**：2026-05-25
**对应 commit**：`02a7cf4`（B0 + B1.1 + B1.2 + B1.3 + B3 已落 develop）
**前作**：[neptune-engine-v2.0.md](./neptune-engine-v2.0.md) | [neptune-engine-v1.0.md](./neptune-engine-v1.0.md)
**相关文档**：
- `docs/strategy/STAGE-A-AUDIT.md`（审计盘点）
- `docs/strategy/STAGE-B-PLAN.md`（11 批实施计划）
- `docs/strategy/agent-loop-rebuild/milestones/HARNESS-V1-DONE.md`（v1.0 完成报告）
