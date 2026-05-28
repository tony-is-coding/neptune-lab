# Stage 3 完成报告 — Harness 干净 + Stateless 基础

> **状态**：✅ 完成（S3.1–S3.6 全绿）
> **守门**：9/9 PASS（从 7/7 升级）
> **测试**：1345 pass / 0 fail（之前 baseline 1262，新增 +83）
> **commit 链**：`bcde812` (S3.1) → `56ea3af` (S3.2a) → `4d32114` (S3.3) → `5e8e84d` (S3.4) → `7ef1288` (S3.5) → `<this>` (S3.6)

## 一、核心目标达成

按用户首次定义的目标排序：

### [1] harness 强大 + 干净（首要）✅

| 维度 | Stage 3 前 | Stage 3 后 |
|---|---|---|
| Agent Loop / Memory / Skill / Tool / Hook | 完整 | **+ Sandbox 安全护栏** |
| engine deps | 含 PG/Redis/SQLite SDK | **0 数据库依赖** |
| builtin-tools 9 核心工具反向引用 | 0 | 0 |
| 守门脚本 | 7/7 | **9/9** |

### [2] 可拓展、stateless、开闭原则（次要）✅

| 协议 | InMemory 默认 | Filesystem 默认 | Product 可注入 |
|---|---|---|---|
| RunStore | ✅ InMemoryRunStore | ✅ FileRunStore | PG/Redis/S3/... |
| SessionStore | ✅ InMemorySessionStore | ✅ FilesystemSessionStore | （已迁 product） |
| ContentStore | ✅ InMemoryContentStore | ✅ FilesystemContentStore | （已迁 product） |
| MemoryStore | ✅ InMemoryMemoryStore | ✅ FilesystemMemoryStore | RedisMemoryStore（迁出） |
| AgentRegistry | ✅ InMemoryAgentRegistry | ✅ FilesystemAgentRegistry | DB / API / ... |
| SandboxAdapter | ✅ NoOpSandbox | ✅ LocalSandbox | Docker / firecracker / ... |

### [3] 可作为 SDK 被外部使用（第三）✅

3 个 examples 验证：
- `examples/sdk-pure.ts`（30 行）：纯 SDK 调用
- `examples/sdk-with-fs-store.ts`（80 行）：FileRunStore + resume
- `examples/sdk-with-server.ts`（150 行）：Node http SSE server

## 二、6 个 Sub-batch 交付

### S3.1 — Storage 双默认（filesystem-first）

- **干净度**：4 文件迁出 engine → product/storage/（PgSessionStore /
  PgContentStore / RedisMemoryStore / SQLiteSessionStore + 5 测试）
- **engine deps -3 行**：移除 postgres / drizzle-orm / ioredis
- **filesystem 默认实现**（cc sessionStorage 实战经验）：
  - FilesystemSessionStore：`{rootDir}/{id}.session.json` atomicWrite
  - FilesystemContentStore：`{rootDir}/{id}.content.jsonl` 行级 append
  - FilesystemMemoryStore：`{rootDir}/{userId}.memory.jsonl` last-wins
- **utils**：sanitizePath / atomicWrite / jsonl / djb2Hash
- 守门脚本扩展为 9/9（新增 #8 #9）
- **测试**：49 新增 / 0 fail

### S3.2a — AgentRegistry 协议 + 双默认

- **substrate 协议**：AgentManifest（type / name / description / tools /
  systemPrompt / modelHint / metadata）+ AgentRegistry 接口（get / list /
  register / unregister）
- **InMemoryAgentRegistry + FilesystemAgentRegistry**（每 manifest 一个
  `{type}.agent.json`）
- ToolUseContext.kernel.agentRegistry 接入点就位
- **测试**：16 新增 / 0 fail

> S3.2b（AgentTool / SkillTool 业务剥离）后置 — cc 业务文件 50+ 处反向引用
> 涉及 cc query() 主循环深度耦合，作为可选 product-tools 工具，不阻塞
> Stage 3 substrate 分发承诺

### S3.3 — Sandbox 协议 + LocalSandbox

- **SandboxAdapter** 接口：exec / readFile / writeFile / fetch
- **LocalSandbox**（secure-by-default，cc 实战做法）：
  - bash prefix safety：8 类危险命令静态名单
  - workingDirAllowlist（防 path traversal）
  - fetchHostAllowlist + fetchHostDenylist（支持 *.example.com 通配）
  - 协议白名单（仅 http/https）+ 文件大小兜底 + timeout 强制
- **NoOpSandbox**：pass-through（仅供 dangerous mode opt-in）
- ToolUseContext.sandbox? 接入点就位
- **测试**：24 新增 / 0 fail

### S3.4 — Run + RunStore + FileRunStore

- **Run 协议**：id / status / createdAt / updatedAt / metadata
- **RunStore 接口**：create / load / updateStatus / appendEvent /
  loadEvents / loadSnapshot / delete
- **InMemoryRunStore + FileRunStore**：
  - cc sessionStorage 同款存储格式：`{rootDir}/{runId}/{run.json + events.jsonl}`
  - run.json：atomicWrite（tmp + rename）
  - events.jsonl：行级 atomic（POSIX/NFS friendly < 4KB）
  - LoopEvent.error 序列化为 `{__errorType, message, stack, name}`
- **rebuildSnapshotFromEvents** 纯函数：
  - assistant_message + tool_update(result) → 包成 user message
  - usage_update.cumulative → 取最后一次（权威值）
  - governance_decision → 4 类计数
- **测试**：33 新增 / 0 fail（含跨实例 resume 3 测试）

### S3.5 — AgentLoop ↔ RunStore 集成 + Resume API

- `AgentLoopParams` 新增 `runStore? + runId?` 字段
- **AgentLoop.runWithStore**：每个 LoopEvent yield 前同步 append 到 store；
  退出时 updateStatus 按 reason 映射到 RunStatus
- **AgentLoop.resume(runId, params)**：从 loadSnapshot 重建 messages 续跑
- **容错**：store 写入失败 → emit error event 但不冲垮 loop
- **测试**：10 新增 / 0 fail（核心 Stateless 跨实例 resume × 5）

### S3.6 — 3 个 Examples + STAGE3-DONE

- `examples/sdk-pure.ts`（30 行 / 纯 SDK）
- `examples/sdk-with-fs-store.ts`（80 行 / FileRunStore + --resume）
- `examples/sdk-with-server.ts`（150 行 / Node http SSE 包一层）

## 三、关键设计决策

### filesystem-first（不死磕数据库）

- 每个 IO 协议提供 InMemory + Filesystem 双默认 → 0 中间件即可分布式
- NFS 共享路径：多进程 append jsonl 行级 atomic（< 4KB）
- atomic rename 写小元数据，跨实例并发安全

### Resume 语义对齐 cc

- jsonl append-only 是 source of truth
- snapshot 是从 events 重建的中间产物（不持久化）
- engine A 写 + engine B 用同 store → loadSnapshot 重建 messages → 续跑

### Sandbox = 规则级护栏（非容器）

- 不引入 docker/firecracker
- bash prefix 静态名单 + path allowlist + fetch domain allowlist
- 与 cc 实战做法对齐（cc 也是规则护栏 + 用户对话 + macOS sandbox-exec）
- product 可注入更严格实现（容器 / unshare）

## 四、验证 Gate（5 类自动化）

### Gate A — 干净度 ✅

- engine package.json 0 数据库 SDK：`grep -E '"(postgres|drizzle-orm|ioredis|...)"' engine/package.json` → 空
- builtin-tools 9 工具反向引用 = 0
- 守门脚本 9/9 PASS

### Gate B — Harness 强化 ✅

- Sandbox 决策矩阵：12 测试通过
- AgentRegistry filesystem round-trip：8 测试
- 总 Stage 3 新增 sandbox + agent-registry：40 测试

### Gate C — Stateless（核心证明）✅

```ts
// 跨实例 resume 测试通过
it('engine A 跑完 turn 1 → engine B（独立实例）resume → end_turn', async () => {
  const storeA = new FileRunStore(dir)
  const run = await storeA.create()
  await consume(AgentLoop.runWithStore({...providerA, runStore: storeA, runId: run.id}))

  const storeB = new FileRunStore(dir) // 完全独立实例
  await consume(AgentLoop.resume(run.id, {provider: providerB, runStore: storeB, ...}))
  // ✓ 通过
})
```

### Gate D — SDK 三种姿势 ✅

3 个 examples 都能加载（API key 缺时优雅退出）。

### Gate E — 量化 ✅

| 指标 | 之前 | 当前 |
|---|---|---|
| 守门脚本 | 7/7 | **9/9** |
| baseline | 1262 pass / 0 fail | **1345 pass / 0 fail** |
| 新增测试 | — | **+83** |
| engine deps 行数 | N | **N - 3** |
| examples | 0 | **3** |

## 五、产物索引（共 ~18 个新文件）

```
neptune-engine/src/engine/
├── utils/                          ← S3.1 工具内联
│   ├── sanitizePath.ts
│   ├── djb2Hash.ts
│   ├── atomicWrite.ts
│   ├── jsonl.ts
│   └── index.ts
├── storage/                        ← S3.1 双默认
│   ├── FilesystemSessionStore.ts
│   ├── FilesystemContentStore.ts
│   └── FilesystemMemoryStore.ts
├── agent-registry/                 ← S3.2a 协议
│   ├── AgentRegistry.ts
│   ├── InMemoryAgentRegistry.ts
│   ├── FilesystemAgentRegistry.ts
│   └── index.ts
├── sandbox/                        ← S3.3 安全护栏
│   ├── SandboxAdapter.ts
│   ├── NoOpSandbox.ts
│   ├── LocalSandbox.ts
│   └── index.ts
├── run/                            ← S3.4 状态外化
│   ├── Run.ts
│   ├── InMemoryRunStore.ts
│   ├── FileRunStore.ts
│   ├── rebuildSnapshot.ts
│   └── index.ts
└── agent-loop/loop/AgentLoop.ts   ← S3.5 runWithStore + resume

neptune-engine/examples/             ← S3.6 SDK 验证
├── sdk-pure.ts
├── sdk-with-fs-store.ts
└── sdk-with-server.ts
```

## 六、下一步

Stage 3 完成意味着 harness v0.9 就位。Stage 4-6 按既定 spec 推进：
- **Stage 4** — Audit hash chain + Channel + Checkpoint + LocalArtifactStore
- **Stage 5** — Provider 收口（6 unsupported 砍 product）+ zod→JSON
- **Stage 6** — Observability（Tracer / Metrics / 结构化 Log）+ HARNESS-V1-DONE

整体 14 工作日规划（已耗 3 天 Stage 3，剩 8 天 Stage 4-6 + 3 天验收）。

## 七、给老板的一页总结

```
Stage 3 = 把 engine 从 "在用的 agent" 升级为 "敢分发的 SDK"

✅ engine 0 数据库依赖（drizzle/postgres/ioredis 全迁 product）
✅ 5 个 IO 协议双默认（InMemory + Filesystem）→ 0 中间件即可分布式
✅ Sandbox 安全护栏（cc 实战做法：规则级，不依赖容器）
✅ Run 协议 + RunStore + cross-instance resume API（核心 Stateless 证明）
✅ 3 个 SDK examples（纯 / + fs store / + server）

守门 9/9，1345 pass / 0 fail，0 退化。
```
