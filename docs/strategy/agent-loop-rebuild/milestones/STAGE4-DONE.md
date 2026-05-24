# Stage 4 完成报告 — 合规护城河 + 多 Agent 接口

> **状态**：✅ 完成（S4.1-S4.4 全绿）
> **守门**：9/9 PASS
> **测试**：1400 pass / 0 fail（Stage 3 末 1345 pass，本阶段 +55）
> **commit 链**：`1d6dc8e` (S4.1) → `0b97683` (S4.2) → `cc43983` (S4.3) → `<this>` (S4.4)

## 一、核心交付

Stage 4 完成 **合规护城河 + 多 Agent 通讯接口** 的关键基础设施：

1. **Audit hash chain**（S4.1）：jsonl 之上叠加 sha256 链，篡改可证明
2. **Channel 协议**（S4.2）：substrate 多 agent 通讯接口预留 + InMemoryChannel
3. **Checkpoint 协议**（S4.3）：任意 turn 可 resume，不只是最新位置
4. **LocalArtifactStore**（S4.4）：content-addressable 文件存储，dedup + 安全

## 二、4 个 Sub-batch 摘要

### S4.1 — AuditEventStore + Hash Chain

**接口**：
```ts
interface AuditEvent {
  index: number       // 0-based
  prevHash: string    // sha256
  hash: string        // sha256(prevHash + canonicalJson({index, payload, ts}))
  payload: unknown
  ts: string          // ISO8601
}
interface AuditEventStore {
  append(runId, payload): Promise<AuditEvent>
  load(runId): Promise<AuditEvent[]>
  verify(runId): Promise<{valid, firstBadIndex?, reason?}>
}
```

**双默认实现**：
- `NoopAuditStore`：占位，append 返填好的 event 但不持久化
- `FilesystemAuditStore`：`{rootDir}/{runId}/audit.jsonl` 行级 append

**关键特性**：
- canonical JSON：`{b:2,a:1}` 和 `{a:1,b:2}` hash 相同（key 字典序）
- 跨实例续链：cache miss 时 reload 末行
- verify 重算整个 chain，篡改任意 event 必检出 + firstBadIndex
- 0 外部依赖（仅 node:crypto）

**AgentLoop 集成**：
```ts
AgentLoop.runWithStore({
  ...,
  runStore,        // state 重建
  auditStore,      // 不可篡改证据
})
```

只审计语义敏感事件（`assistant_message` / `tool_result` / `governance_decision` / `error`），跳过噪音事件（`stream_request_start` / `progress` / `usage_update`）。

### S4.2 — Channel 协议（多 Agent 通讯接口）

**接口**：
```ts
interface Channel<T = unknown> {
  send(target: string, message: T): Promise<void>
  receive(target: string): Promise<T | null>      // FIFO 单播
  subscribe(target: string): AsyncIterable<T>     // broadcast fan-out
}
```

**InMemoryChannel**（默认实现）：
- `send + receive`：FIFO 单播队列（每条消息只被消费一次）
- `send + subscribe`：broadcast（每条消息每个订阅者各看一次）
- 两套独立：subscribe 不消耗 receive 队列

**设计决策**：
- cc 通过 SendMessageTool / TeammateTask 业务工具实现 multi-agent 通讯
- 这里抽象为 Channel 协议（与具体工具解耦）
- product 可基于此实现 Redis pubsub / NATS / WebSocket 等后端
- 用户已表态先不实现具体多 agent 业务 → 仅落接口 + 单进程默认

### S4.3 — Checkpoint 协议（任意 turn resume）

**新增类型**：
```ts
interface Checkpoint {
  runId: string
  turnNumber: number
  messages: Message[]
  cumulativeUsage: UsageSnapshot
  governanceSnapshot?: GovernanceSnapshot
  apiStopReason: StopReason | null
  capturedAt: string
}
```

**RunStore 接口扩展**：
```ts
interface RunStore {
  // ...existing
  loadCheckpoint?(id, turnNumber): Promise<Checkpoint | null>
}
```

**rebuildCheckpointFromEvents** 纯函数：
- 扫到 `turnNumber+1` 的 `stream_request_start` 截止
- 累计 usage / governance 截止到该 turn 末尾
- turnNumber 超过实际跑过的轮数 → null

**AgentLoop.resume 扩展**：
```ts
AgentLoop.resume(runId, params, {fromCheckpoint: 2})
// 从 turn 2 末尾续跑（而非最新位置）
```

### S4.4 — LocalArtifactStore（content-addressable）

**实现 ArtifactHook 接口**：
- 文件名 = sha256 hash（content-addressable）
- 路径分桶：`{rootDir}/artifacts/{hash[:2]}/{hash}` 防单目录爆炸
- dedup：相同 content 自动复用（不重写）
- 配套 `read(hash)` / `has(hash)` API

**用法**：
```ts
const artifactStore = new LocalArtifactStore('./artifacts')
const governance: GovernanceHooks = {
  artifactHook: artifactStore,
  // ...
}
// AgentLoop 内部 tool 输出 mcpMeta._meta.artifactInputs 时自动落盘
```

## 三、合规链条闭环（Stage 4 完成定义）

```
PolicyDecision (governance hook)
  ↓
ToolInvocation (audit append)
  ↓
EvidenceArtifact (LocalArtifactStore)
  ↓
HumanReview (governance hook)
  ↓
AuditEvent (hash chain) ← 可证明不可篡改
  ↓
verify(runId) → {valid: true | false, firstBadIndex?}
```

每个环节都有：
- 明确的 contract（shared/types/contracts/ zod schema）
- 默认 NoOp / Filesystem 实现
- product 可注入定制后端

## 四、测试增量

| Sub-batch | 测试数 | 关键场景 |
|---|---|---|
| S4.1 | 26 | hash chain + 4 类篡改检出 + 跨实例 verify + AgentLoop 集成 |
| S4.2 | 11 | FIFO 单播 + broadcast fan-out + dispose 清理 |
| S4.3 | 10 | 任意 turn checkpoint + 跨实例 + AgentLoop.resume(fromCheckpoint) |
| S4.4 | 8 | content-addressable + dedup + 路径分桶 + 二进制 |

**累计**：55 新测试 / 0 fail。

## 五、文件索引（Stage 4 新增 9 个核心文件）

```
neptune-engine/src/engine/
├── audit/                          ← S4.1
│   ├── AuditEventStore.ts
│   ├── canonicalJson.ts
│   ├── NoopAuditStore.ts
│   ├── FilesystemAuditStore.ts
│   └── index.ts
├── channel/                        ← S4.2
│   ├── Channel.ts
│   ├── InMemoryChannel.ts
│   └── index.ts
├── artifact/                       ← S4.4
│   ├── LocalArtifactStore.ts
│   └── index.ts
└── run/
    ├── Run.ts                      ← S4.3 加 Checkpoint 类型
    └── rebuildSnapshot.ts          ← S4.3 加 rebuildCheckpointFromEvents
```

## 六、下一步

Stage 5 — Provider 收口 + zod→JSON：
- S5.1 把 6 个 unsupported provider stub 砍到 product
- S5.2 Provider 治理接入（pre-request hook）
- S5.3 zod→JSON Schema 转换 + STAGE5-DONE

## 七、给老板的一页总结

```
Stage 4 = 让 engine 具备"敢拿出去给金融客户"的合规底线

✅ Audit hash chain：每个事件 sha256(prev + canonical(payload))，篡改可证
✅ Channel 协议：多 agent 通讯接口预留（具体实现 product 注入）
✅ Checkpoint：任意 turn resume，不只最新（合规审查重放需要）
✅ LocalArtifactStore：content-addressable 文件存储，自动 dedup

5 个新模块 / 55 新测试 / 0 fail / 守门 9/9 不退化。
```
