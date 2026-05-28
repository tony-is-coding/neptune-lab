# neptune-engine v2.0 — Substrate 自闭环硬底线达成

> **One-liner**：v1.0 让它强大可用；v2.0 让它真正干净——即使 product 完全删除，engine 仍能独立编译、测试、跑通。

> **Status**：HARNESS v2.0 ✅ 完成（2026-05-25）
> **守门**：**11/11 PASS**（v1.0 是 9/9）
> **端到端验收**：18/18 PASS（不退化）
> **测试**：1327 pass / 0 fail（v1.0 1393，少 66 个迁出 provider 测试）

---

## 0. v1.0 → v2.0 本质升级（一页看清）

| 维度 | v1.0（2026-05） | v2.0（2026-05-25） | 本质改进 |
|---|---|---|---|
| **守门 check** | 9/9 | **11/11** | 新增 #10（packages 反向引用 0）+ #11（engine/provider 仅 Anthropic）|
| **packages 反向引用** | 14 文件 / 47+ 处 | **0** | 4 工具迁出：AgentTool / SkillTool / NotebookEditTool / McpAuthTool / spawnMultiAgent |
| **engine/provider/adapters** | 8 文件（含 6 unsupported） | **2 文件**（Anthropic + Base） | 6 unsupported provider 迁到 product/cc-tools/provider/ |
| **substrate 独立性** | ⚠️ 表面干净，实际有反向引用 | **✅ 完全自闭环** | 即使 product 删除也能跑 |
| **engine deps** | 0 数据库 SDK | 0 数据库 SDK（不变） | — |
| **baseline 测试** | 1393 / 0 fail | 1327 / 0 fail | 迁出 66 测试，0 退化 |
| **端到端 Gate** | 18/18 | 18/18 | 不退化 |

### 一句话总结 v1.0 的潜在风险

v1.0 的 builtin-tools 中 14 个文件含 47+ 处 `from 'src/...'` 反向引用 cc product。守门 check #4 仅查 9 个核心工具，**漏掉了 AgentTool / SkillTool / NotebookEditTool / McpAuthTool 等深度耦合工具**。如果 product 被删除或大改，这些工具立即失效——substrate 承诺没真正兑现。

### v2.0 修复（这次的本质升级）

```
v1.0 状态：
  packages/builtin-tools/src/tools/AgentTool/    ← 9 文件 47+ 反向引用 cc query() / teammate
  packages/builtin-tools/src/tools/SkillTool/    ← 2 文件 11 反向引用
  packages/builtin-tools/src/tools/NotebookEditTool/ ← 1 文件
  packages/builtin-tools/src/tools/McpAuthTool/  ← 1 文件
  packages/builtin-tools/src/tools/shared/spawnMultiAgent.ts ← 1 文件
  ↑ substrate 工具但深度耦合 cc，假设 product 永远存在

v2.0 状态：
  neptune-engine-product/src/cc-tools/AgentTool/        ← 迁出
  neptune-engine-product/src/cc-tools/SkillTool/        ← 迁出
  neptune-engine-product/src/cc-tools/NotebookEditTool/ ← 迁出
  neptune-engine-product/src/cc-tools/McpAuthTool/      ← 迁出
  neptune-engine-product/src/cc-tools/spawnMultiAgent.ts ← 迁出
  neptune-engine-product/src/cc-tools/provider/         ← 6 unsupported provider 迁出

  packages/builtin-tools/                          ← 完全自闭环，0 反向引用
  engine/provider/adapters/                        ← 仅 Anthropic + Base
  ↑ substrate 真正承诺：product 删了我也跑
```

---

## 1. Stage 7+8.1 完成清单（本次升级）

### Stage 7 — substrate 自闭环硬底线（commit `ee5fe70`）

**核心动作**：把 deeply-coupled cc 工具从 substrate 整体迁出 product。

| 迁出工具 | 文件数 | 反向引用数 | 迁出后位置 |
|---|---|---|---|
| `AgentTool/` | 9 文件 | 47+ 处 src/ | `neptune-engine-product/src/cc-tools/AgentTool/` |
| `SkillTool/` | 2 文件 | 11+ 处 src/ | `neptune-engine-product/src/cc-tools/SkillTool/` |
| `NotebookEditTool/` | 1 文件 | 数处 | `neptune-engine-product/src/cc-tools/NotebookEditTool/` |
| `McpAuthTool/` | 1 文件 | 数处 | `neptune-engine-product/src/cc-tools/McpAuthTool/` |
| `shared/spawnMultiAgent.ts` | 1 文件 | 27+ 处 | `neptune-engine-product/src/cc-tools/spawnMultiAgent.ts` |

**Substrate 怎么办？** product 想用 sub-agent？基于 `AgentRegistry` 协议（已落 S3.2a）自己实现 ToolDef，或从 `product/cc-tools/` 引用 cc 参考版（reference 实现）。

**63 个 product 文件 import 路径批量替换**：
```
'@neptune/builtin-tools/tools/AgentTool/...'
↓
'@neptune/engine-product/cc-tools/AgentTool/...'
```

**守门脚本扩展（防回归红线）**：
```bash
# check #10 packages/*/src 0 反向引用（substrate 自闭环硬底线）
grep -rln "^import .*from 'src/" packages/*/src | wc -l == 0
grep -rln "from '@neptune/engine-product" packages/*/src | wc -l == 0
```

### Stage 8.1 — 6 个 unsupported Provider 收口（commit `<latest>`）

**问题**：v1.0 中 engine/provider/adapters/ 内 6 个 unsupported provider stub（OpenAIProvider/GeminiProvider/GrokProvider/BedrockProvider/VertexProvider/FoundryProvider）虽然不阻塞 substrate 分发，但违反"engine 不感知具体 provider"承诺。

**动作**：
- 6 个 provider .ts + 6 个测试 + Provider.resource-cleanup.test.ts → `neptune-engine-product/src/cc-tools/provider/`
- engine/provider/adapters/ 仅留 `AnthropicProvider.ts + BaseProvider.ts`
- OriginalQueryEngineBridge：移除硬编码 switch case，非 anthropic 走 `ProviderRegistry.get(type)`（product 通过 `register()` 注入）
- 守门 check #11：`engine/provider/adapters` 仅含 Anthropic + Base（防回归）

**结果**：
- engine 真正只感知 1 个 provider（Anthropic）
- product 想用 OpenAI 等？显式 `registry.register('openai', new OpenAIProvider())`
- 守门 11/11 PASS

---

## 2. 11 项守门 check（v2.0 完整版）

```bash
$ bash neptune-engine/scripts/verify-workspace-independent.sh

  [check 1] 1. builtin-tools 不含 .tsx 文件                              ✅ PASS
  [check 2] 2. builtin-tools 不含 react / ink import                     ✅ PASS
  [check 3] 3. packages/*/src 不含 @neptune/engine-product import         ✅ PASS
  [check 4] 4. 9 个核心工具目录不含 from 'src/' 反向引用                  ✅ PASS
  [check 5] 5. agent-tools tsc 通过                                      ✅ PASS
  [check 6] 6. mcp-client tsc 通过                                       ✅ PASS
  [check 7] 7. builtin-tools tsc 通过                                    ✅ PASS
  [check 8] 8. neptune-engine/package.json 不含 PG/Redis/SQLite 依赖     ✅ PASS
  [check 9] 9. engine/storage 下不含 Pg/Redis/SQLite 实现文件            ✅ PASS
  [check 10] 10. packages/*/src 0 反向引用（substrate 自闭环硬底线）       ✅ PASS  ← v2.0 新增
  [check 11] 11. engine/provider/adapters 仅含 Anthropic + Base           ✅ PASS  ← v2.0 新增

  ✅ Workspace independence: ALL GREEN (11/11)
```

### v1.0 vs v2.0 守门对比

| Check | v1.0 | v2.0 | 防什么 |
|---|---|---|---|
| #1-#3 | ✅ | ✅ | UI / React / cc product import |
| #4 | ✅ 但只查 9 个核心工具 | ✅ 不变 | 9 核心工具反向引用 |
| #5-#7 | ✅ | ✅ | 3 个 packages tsc |
| #8-#9 | ✅ | ✅ | 数据库 SDK 依赖 |
| **#10** | ❌ 不存在 | ✅ 新增 | **packages 整体反向引用（更严格）** |
| **#11** | ❌ 不存在 | ✅ 新增 | **engine/provider/adapters 仅 Anthropic** |

**关键洞察**：v1.0 的 check #4 只查 9 个核心工具（Bash/FileEdit/FileRead/FileWrite/Glob/Grep/WebFetch/WebSearch/LSP），但 AgentTool/SkillTool/NotebookEditTool/McpAuthTool 不在范围内 → 形成漏网之鱼。v2.0 #10 把整个 packages 都纳入硬底线。

---

## 3. Architecture（v2.0 最终图）

```
┌────────────────────────────────────────────────────────────────────┐
│                  External SDK Consumer                              │
│   (in-process / + FileRunStore / + http SSE server)                 │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│  @neptune/engine v2.0 (substrate, 完全自闭环)                       │
│                                                                     │
│  Core (强壮)                                                         │
│  ├─ AgentLoop + Run 协议 + runWithStore + resume                     │
│  ├─ ToolDispatcher + Sandbox protocol                                │
│  ├─ HookSurface (5 event hook) + GovernanceHooks (4 类)              │
│  └─ PermissionMode 5×5 决策矩阵                                       │
│                                                                     │
│  Protocols + 双默认实现                                              │
│  ├─ RunStore: InMemoryRunStore + FileRunStore + Checkpoint           │
│  ├─ SessionStore / ContentStore / MemoryStore                        │
│  ├─ AgentRegistry / SkillRegistry                                    │
│  ├─ SandboxAdapter: NoOpSandbox + LocalSandbox                       │
│  ├─ AuditEventStore: NoopAuditStore + FilesystemAuditStore           │
│  ├─ ArtifactStore: LocalArtifactStore                                │
│  ├─ Tracer / Metrics: NoOp + InMemoryMetricsProvider                 │
│  └─ Channel: 接口 + InMemoryChannel                                  │
│                                                                     │
│  packages/                                                           │
│  ├─ builtin-tools/                                                   │
│  │   • 11 kernel tools (TodoWrite / Task* x 6 / ToolSearch /         │
│  │     DiscoverSkills / Memory* x 2)                                 │
│  │   • 9 原语工具 (Bash/FileRead/Write/Edit/Glob/Grep/Web*/LSP)       │
│  │   • REPLTool / SendMessageTool / SleepTool                        │
│  │   • ListMcpResourcesTool / ReadMcpResourceTool                    │
│  ├─ agent-tools/                                                     │
│  └─ mcp-client/                                                      │
│  → 0 反向引用 src/ ✅                                                 │
│  → 0 product import ✅                                                │
│                                                                     │
│  engine/provider/adapters/   ← 仅 Anthropic + Base                   │
│                                                                     │
│  Dependencies: @anthropic-ai/sdk + zod + crypto                     │
│  (No DB, no Redis, no React, no OTel SDK, no 6 unsupported providers) │
└────────────────────────────────────────────────────────────────────┘
                             ▲
                             │ 注入（product 实现 substrate 协议）
┌────────────────────────────┴───────────────────────────────────────┐
│  @neptune/engine-product (业务层，可独立废弃)                       │
│                                                                     │
│  src/cc-tools/  ← v2.0 新增（cc 业务工具，substrate 不知道存在）       │
│  ├─ AgentTool/        ← v2.0 从 substrate 迁入                        │
│  ├─ SkillTool/        ← v2.0 从 substrate 迁入                        │
│  ├─ NotebookEditTool/ ← v2.0 从 substrate 迁入                        │
│  ├─ McpAuthTool/      ← v2.0 从 substrate 迁入                        │
│  ├─ spawnMultiAgent.ts ← v2.0 从 substrate 迁入                       │
│  └─ provider/         ← v2.0 6 unsupported provider 全迁入            │
│      ├─ OpenAIProvider.ts                                            │
│      ├─ GeminiProvider.ts                                            │
│      ├─ GrokProvider.ts                                              │
│      ├─ BedrockProvider.ts                                           │
│      ├─ VertexProvider.ts                                            │
│      └─ FoundryProvider.ts                                           │
│                                                                     │
│  src/storage/      (PgRunStore / RedisMemoryStore / S3 等业务后端)     │
│  src/agent-adapter/ (cc agent-adapter / teammate / agent-context)    │
│  src/governance/    (LangfuseEvalHook / SlackReviewHook / DbPolicy)  │
│  src/observability/ (OTelTracer / PrometheusMetrics)                 │
└────────────────────────────────────────────────────────────────────┘

substrate 承诺：product 完全删除，engine + packages 仍能独立编译、测试、跑通。
```

---

## 4. v2.0 量化总览

| 维度 | v1.0 | v2.0 | Δ |
|---|---|---|---|
| 守门 check | 9/9 | **11/11** | +2 |
| 端到端 Gate | 18/18 | 18/18 | 不退化 |
| baseline tests | 1393 / 0 fail | 1327 / 0 fail | -66（迁出 provider 测试） |
| engine 源文件 | 193 | ~180 | -13（迁出工具 + provider） |
| engine 测试文件 | 100 | ~93 | -7（迁出测试） |
| **packages 反向引用** | **14 文件 / 47+ 处** | **0** | ✅ 完全清零 |
| **engine/provider/adapters 文件** | **8** | **2** | ✅ 仅 Anthropic + Base |
| engine 总核心依赖 | 3 | 3 | 不变（@anthropic-ai/sdk + zod + crypto） |
| 协议 + 双默认实现 | 9 类 | 9 类 | 不变 |
| 治理 hook | 4 类 | 4 类 | 不变 |
| Sandbox 决策矩阵 | 24 测试 | 24 测试 | 不变 |
| 跨实例 resume | 5 集成测试 | 5 集成测试 | 不变 |
| Audit 篡改检出 | 4 类全检出 | 4 类全检出 | 不变 |
| SDK examples | 3 种姿势 | 3 种姿势 | 不变 |

---

## 5. 设计决策回顾（v2.0 关键判断）

### 5.1 为什么不"业务剥离 + 改造"，而是"整体迁出"

**v1.0 spec 设计**：把 AgentTool 业务部分剥离到 product，substrate 保留薄壳 + AgentRegistry 注入。

**v2.0 实际选择**：整体迁出 product/cc-tools/，substrate 不再有 AgentTool。

**判断**：
- AgentTool 本质是 cc product 特有的 sub-agent 启动器（含 cc query 主循环 / teammate 模式 / agent context 状态机 / agent summary / memdir）
- 这些业务逻辑深度耦合 cc，剥离 = 重写 = 5+ 天工作
- substrate 的真正价值是 **AgentRegistry 协议** —— 已经落了（S3.2a）
- product 想要 sub-agent 能力？基于协议自己实现 ToolDef，或拷贝 cc 参考版

**结论**：substrate 不应该提供 AgentTool 实现。AgentRegistry 协议 + 双默认（InMemoryAgentRegistry / FilesystemAgentRegistry）已经是完整 substrate 责任。

### 5.2 为什么 engine/provider/adapters 仅留 Anthropic

**v1.0 状态**：engine 内自动注册 Anthropic + 4 个非 Anthropic + 3 个可选 Provider stub（共 7 个）。

**v2.0 决策**：仅 Anthropic 是 substrate 默认（唯一真实可用）；其他 6 个迁到 product/cc-tools/provider/。

**判断**：
- 6 个 stub 全部返 `unsupportedProductRuntimeProvider()` —— 占位代码，不解决任何实际问题
- substrate 自动注册它们 = 让用户误以为可用 = 反模式
- product 想用 OpenAI？显式 `registry.register('openai', new OpenAIProvider())` —— 1 行代码，更明确

**结论**：substrate 应该 **secure-by-default**：默认只暴露真实可用的能力，可选能力 product 显式 opt-in。

### 5.3 product 跑不跑 vs substrate 干净度

**用户拍板**：product 跑不跑不重要，substrate 自闭环优先。

**为什么这是对的**：
1. **product 是 reference 实现**（cc-best 拷贝 + 改造），未来大概率废弃 → 不能让 substrate 受其拖累
2. **substrate 是长期资产**（neptune-engine SDK 对外）→ 必须能独立演进
3. 即使 product 跑不通，substrate 仍能独立用 → SDK 用户不受影响

**v2.0 验证策略**：
- substrate side：守门 11/11 + tsc 0 错 + baseline 1327 / 0 fail + 端到端 18/18
- product side：63 个文件 import 路径已修，但 product 整体 tsc 错误数（621）由其他历史遗留问题主导，**不验证**

### 5.4 4 道防线的设计

- **防线 1（编译期）**：tsconfig 不含 src/* path mapping → 即使有人写 `from 'src/...'` 也无法解析
- **防线 2（守门期）**：verify-workspace-independent.sh check #10 + #11
- **防线 3（CI 期）**：.github/workflows/ci.yml 跑守门 → PR 红线
- **防线 4（IDE 期）**：（可选）ESLint no-restricted-imports 规则

---

## 6. v2.0 之后的待办（剩余 P0/P1/P2）

### 🔴 P0 — 已完成（v2.0 收口）✅

- ~~AgentTool / SkillTool / NotebookEditTool / McpAuthTool 迁出~~ ✅ Stage 7
- ~~6 个 unsupported Provider 迁出~~ ✅ Stage 8.1
- ~~守门 check #10 + #11 防回归~~ ✅ Stage 7+8.1

### 🟠 P1 — 完善生产可用性（约 3-4 小时）

#### P1.1 — BashTool / FileWriteTool / WebFetchTool 接入 ctx.sandbox

**现状**：Sandbox 协议已就位（S3.3），但工具仍直接用 Node `child_process.exec` / `fs.writeFile` / `fetch`，未通过 `ctx.sandbox`。

**影响**：sandbox 配置不强制；用户即使注入 LocalSandbox，工具仍可能绕过。

**方案**（约 2 小时）：
1. 改 BashTool 调用 `ctx.sandbox?.exec(...)`，无 sandbox fallback NoOpSandbox + emit warning
2. 改 FileWriteTool / FileEditTool 调用 `ctx.sandbox?.writeFile(...)`
3. 改 WebFetchTool 调用 `ctx.sandbox?.fetch(...)`
4. 集成测试：注入 LocalSandbox + BashTool 跑 dangerous 命令 → deny

#### P1.2 — RunStore.archive + retention policy

**现状**：FileRunStore.delete 是硬删除；没有 retention（运行完的 run 永久占盘）。

**方案**（约 1 小时）：
1. Run.status 加 'archived' 状态
2. RunStore 加 `archive(id)` / `cleanup(olderThan: Date)` 可选方法
3. FilesystemRunStore 实现 archive = mv 到 `{rootDir}/.archived/`

### 🟡 P2 — 开发者体验 / 文档（约 4-5 小时）

#### P2.1 — engine/index.ts API 收敛

**现状**：engine 通过 `exports.*` wildcard 暴露所有 src/engine/ 子路径。SDK 表面积太大。

**方案**：收敛 engine/index.ts 顶层 export，内部模块用 namespace 隐藏。

#### P2.2 — Getting Started + API Reference + Cookbook

**现状**：仅有 STAGE-DONE.md 阶段报告 + neptune-engine-v1.0.md / v2.0.md 说明书。缺：
- `docs/neptune-engine/getting-started.md`（30 分钟跑通教程）
- `docs/neptune-engine/api-reference.md`（按模块分组，每个 export 一段 JSDoc 摘要）
- `docs/neptune-engine/cookbook.md`（5 个场景：基础调用 / 治理 hook / Sandbox / 分布式部署 / 自定义 Provider）
- `docs/neptune-engine/migration-from-cc.md`（cc 用户迁移指南）

#### P2.3 — examples/ 加 advanced-cases.ts

**现状**：3 个 examples 是基础用法。缺：完整生产配置 + 治理 + sandbox + audit 的端到端例子。

### 🟢 P3 — 长期演进

- 真正的容器 Sandbox（Docker / firecracker）—— product 责任
- Audit chain 跨 Run 索引（MerkleTreeAuditStore）
- Multi-tenant / 配额系统
- Channel 实现（Redis pubsub / NATS）—— 用户已表态先不动

---

## 7. v2.0 验收 — verify-harness-v1.sh 18/18 ALL GREEN

```
$ bash neptune-engine/scripts/verify-harness-v1.sh

── Gate A: 干净度 ──────────────────────────────────────────────
  [Gate 1] A.1 engine 0 数据库 SDK 依赖              ✅ PASS
  [Gate 2] A.2 builtin-tools 9 工具反向引用 = 0       ✅ PASS
  [Gate 3] A.3 守门脚本 9/9 PASS（实际 11/11）        ✅ PASS

── Gate B: Harness 强化 ────────────────────────────────────────
  [Gate 4] B.1 Sandbox 模块就位                       ✅ PASS
  [Gate 5] B.2 AuditEventStore 模块就位               ✅ PASS
  [Gate 6] B.3 Run / RunStore 协议就位                ✅ PASS
  [Gate 7] B.4 Channel 协议就位                       ✅ PASS
  [Gate 8] B.5 Observability 接口就位                 ✅ PASS
  [Gate 9] B.6 ArtifactStore 就位                     ✅ PASS
  [Gate 10] B.7 AgentRegistry 协议就位                ✅ PASS

── Gate C: Stateless ───────────────────────────────────────────
  [Gate 11] C.1 跨实例 resume 测试通过                ✅ PASS
  [Gate 12] C.2 RunStore Filesystem 实现可用          ✅ PASS

── Gate D: SDK ─────────────────────────────────────────────────
  [Gate 13] D.1 sdk-pure example 可加载               ✅ PASS
  [Gate 14] D.2 sdk-with-fs-store example 可加载       ✅ PASS
  [Gate 15] D.3 sdk-with-server example 可加载         ✅ PASS

── Gate E: 量化 ────────────────────────────────────────────────
  [Gate 16] E.1 engine baseline 测试 ≥ 1300 pass     ✅ PASS
  [Gate 17] E.2 engine tsc 0 错                       ✅ PASS
  [Gate 18] E.3 examples 文件齐全（3 个）             ✅ PASS

✅ HARNESS v1.0: ALL GREEN (18/18)
```

注：verify-harness-v1.sh 当前文案仍是 v1.0；下次更新会改为 verify-harness-v2.sh + 加 Gate F（守门 11/11 + Substrate 自闭环验证）。

---

## 8. 给老板的一页总结（v2.0 版）

```
neptune-engine v2.0 = substrate 自闭环硬底线达成

v1.0 → v2.0 本质升级：
✅ 守门 9/9 → 11/11（新增 #10 packages 0 反向引用 + #11 engine/provider 仅 Anthropic）
✅ packages 反向引用从 14 文件 47+ 处 清零到 0
✅ engine/provider/adapters 从 8 文件 收敛到 2（仅 Anthropic + Base）
✅ 4 工具迁出（AgentTool / SkillTool / NotebookEditTool / McpAuthTool）
✅ 6 unsupported provider 迁出（OpenAI / Gemini / Grok / Bedrock / Vertex / Foundry）
✅ baseline 1327 pass / 0 fail（不退化）
✅ 端到端 18/18 PASS（不退化）

substrate 真正承诺：product 完全删除，engine + packages 仍能独立编译、测试、跑通。

下一步（剩余 P1+P2，4-5 天）：
🟠 P1.1: BashTool / FileWriteTool / WebFetchTool 接入 ctx.sandbox（约 2h）
🟠 P1.2: RunStore.archive + retention policy（约 1h）
🟡 P2.1: engine/index.ts API 收敛（约 1h）
🟡 P2.2: Getting Started + API Reference + Cookbook 文档（约 4h）
🟡 P2.3: examples/ advanced-cases.ts（约 1h）
```

---

## 附录 A — 4 道防线如何工作

```
1. tsconfig（编译期）
   packages/*/tsconfig.json 不含 'src/*' path mapping
   → 即使有人写 from 'src/...' 也无法解析

2. 守门脚本（构建期）
   verify-workspace-independent.sh check #10
   → grep -rln "^import .*from 'src/" packages/*/src
   → grep -rln "from '@neptune/engine-product" packages/*/src
   → 任一不为空 → exit 1

3. CI（PR 期）
   .github/workflows/ci.yml 跑守门
   → 任何反向引用 → CI fail，PR 不能 merge

4. IDE（写代码期）— 可选
   ESLint no-restricted-imports
   → 写 from 'src/...' 立即 IDE 红色波浪线
```

## 附录 B — 文件迁移清单（v2.0）

```
Stage 7 迁出（substrate → product/cc-tools/）：
─────────────────────────────────────────────────────────────
neptune-engine/packages/builtin-tools/src/tools/AgentTool/        (9 files)
  → neptune-engine-product/src/cc-tools/AgentTool/
neptune-engine/packages/builtin-tools/src/tools/SkillTool/        (2 files)
  → neptune-engine-product/src/cc-tools/SkillTool/
neptune-engine/packages/builtin-tools/src/tools/NotebookEditTool/ (1 file)
  → neptune-engine-product/src/cc-tools/NotebookEditTool/
neptune-engine/packages/builtin-tools/src/tools/McpAuthTool/      (1 file)
  → neptune-engine-product/src/cc-tools/McpAuthTool/
neptune-engine/packages/builtin-tools/src/tools/shared/spawnMultiAgent.ts
  → neptune-engine-product/src/cc-tools/spawnMultiAgent.ts

Stage 8.1 迁出（substrate → product/cc-tools/provider/）：
─────────────────────────────────────────────────────────────
neptune-engine/src/engine/provider/adapters/
  ├─ OpenAIProvider.ts   → neptune-engine-product/src/cc-tools/provider/OpenAIProvider.ts
  ├─ GeminiProvider.ts   → neptune-engine-product/src/cc-tools/provider/GeminiProvider.ts
  ├─ GrokProvider.ts     → neptune-engine-product/src/cc-tools/provider/GrokProvider.ts
  ├─ BedrockProvider.ts  → neptune-engine-product/src/cc-tools/provider/BedrockProvider.ts
  ├─ VertexProvider.ts   → neptune-engine-product/src/cc-tools/provider/VertexProvider.ts
  └─ FoundryProvider.ts  → neptune-engine-product/src/cc-tools/provider/FoundryProvider.ts

测试同迁。

substrate 现状：
─────────────────────────────────────────────────────────────
neptune-engine/packages/builtin-tools/src/tools/  (剩余 16 工具)
  ├─ kernel/ × 11   (TodoWrite, Task* x6, ToolSearch, DiscoverSkills, Memory* x2)
  ├─ BashTool, FileEdit, FileRead, FileWrite, GlobTool, GrepTool
  ├─ WebFetchTool, WebSearchTool, LSPTool
  ├─ ListMcpResourcesTool, ReadMcpResourceTool
  └─ REPLTool, SendMessageTool, SleepTool

neptune-engine/src/engine/provider/adapters/  (剩余 2 文件)
  ├─ AnthropicProvider.ts
  └─ BaseProvider.ts
```

---

**文档版本**：v2.0
**最后更新**：2026-05-25
**对应 commit**：`<S8.1 commit>`（HARNESS-V2 substrate 自闭环硬底线达成）
**前作**：[neptune-engine-v1.0.md](./neptune-engine-v1.0.md)
