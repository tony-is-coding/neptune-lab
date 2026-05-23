# Oracle 验证机制

> **避免凭空重写丢 corner case**
> **配套**：[00-plan.md](./00-plan.md), [01-design.md](./01-design.md), [02-tasks.md](./02-tasks.md)

---

## 0. 为什么需要 oracle

之前剥离丢能力的根本原因：**没有对照验证**。剥离时只验证了 `tsc 通过` + `boundary 通过`，没验证"剥离后引擎跑得动 cc 用户的真实工作流"。

这次修复要避免重蹈覆辙：把 cc 的对应函数当 **真值机（oracle）**，对关键算法做"双跑对比"，确保我们的最小干净版与 cc 行为一致（差异要么有意为之、要么是 bug）。

## 1. 哪些算法需要 oracle 对照

| Batch | 算法 | Oracle 函数（cc 侧） |
|---|---|---|
| 7 | SSE 解析（10 种事件 → ParsedSSEEvent） | `claude.ts:1993-2300` (queryModel SSE 主循环) |
| 8 | userMessageToMessageParam | `claude.ts:578-621` |
| 8 | assistantMessageToMessageParam | `claude.ts:623-672` |
| 8 | stripGeminiProviderMetadata | `claude.ts:674-690` |
| 9 | tool_result block 构造 | `StreamingToolExecutor.ts:97-110` |
| 11 | updateUsage / accumulateUsage | `claude.ts:2995-3110` |
| 12 | 错误分类（429/529/network） | `withRetry.ts` |
| 14 | addCacheBreakpoints | `claude.ts:3134-3284` |
| 15 | microcompact tool_result 替换 | cc microcompact 模块 |

不需要 oracle 的（凭空设计 OK）：HookSurface / CancellationToken / BudgetTracker / CircuitBreaker（cc 在 product 层，与 substrate 关注点不同）。

## 2. Oracle 验证的三种形态

### 2.1 Snapshot 对照（适合：纯函数）

把 cc 函数和 engine 函数都当纯函数，输入相同 fixture，比较输出 byte 一致。

```typescript
// neptune-engine/src/engine/agent-loop/message/__tests__/oracle/serializer.oracle.test.ts
import { userMessageToMessageParam as ccSerialize } from 'neptune-engine-product/src/services/api/claude.ts'
import { MessageSerializer } from '../../MessageSerializer.ts'
import { fixtures } from './fixtures.ts'

describe('oracle: userMessageToMessageParam', () => {
  for (const fixture of fixtures) {
    it(`matches cc behavior: ${fixture.name}`, () => {
      const ccResult = ccSerialize(fixture.input, false, fixture.cachingEnabled)
      const engineResult = MessageSerializer.toMessageParam(fixture.input, { caching: fixture.cachingEnabled })
      expect(engineResult).toEqual(ccResult)
    })
  }
})
```

**注意**：因为 product 编不过不修，oracle 测试可能要做特殊配置（test runner 走类型剥离编译，跳过 product 层运行时依赖；或在 oracle 模块里只 import 纯函数子集）。如果 product 完全跑不动，oracle 退化为"手工抄 cc 算法到 oracle fixture 文件"（保留来源 line ref）。

### 2.2 Stream 对照（适合：异步生成器）

给 SSEParser oracle 测试一段标准 fixture SSE 流，分别用 cc 实现和 engine 实现各跑一次，比较产生的 ParsedSSEEvent 序列。

```typescript
// neptune-engine/src/engine/agent-loop/sse/__tests__/oracle/sseParser.oracle.test.ts
const fixture = await import('./fixtures/text-with-tool-use.ts')
// 1. cc 实现：手抄到 oracle/_ccSseParser.ts（保留 line ref 注释），跑出 events
const ccEvents = await drain(_ccSseParser(fixture.rawEvents))
// 2. engine 实现：跑 SSEParser 拿到 ParsedSSEEvent
const engineEvents = await drain(SSEParser.consume(fixture.rawEvents))
// 3. 对比关键字段（content / type / index / signature），允许 metadata 字段差异
expect(normalize(engineEvents)).toEqual(normalize(ccEvents))
```

normalize 函数：去掉无关字段（langfuse trace id / queryChainId / advisor 标志等 product 干扰）。

### 2.3 Algorithm 对照（适合：决策算法）

错误分类、cache breakpoint、microcompact 这种"输入 X 输出决策 Y"的算法，写决策矩阵：

```
| 输入                         | cc 决策            | engine 决策     | 一致？ |
|------------------------------|--------------------|--------------------|--------|
| 429 + retry-after: 5         | retry, 5000ms      | retry, 5000ms     | ✅     |
| 529 (overloaded)             | retry, exp backoff | retry, exp backoff | ✅     |
| 401 (auth)                   | throw immediately  | throw immediately | ✅     |
| 504 + 已 retry 5 次          | throw exhausted    | throw exhausted   | ✅     |
| network err 'ECONNRESET'     | retry              | retry              | ✅     |
| 422 (validation)             | throw immediately  | throw immediately | ✅     |
```

每个 batch 的 `__tests__/oracle/` 目录都要有这种决策矩阵，机器可读（直接生成 test cases）。

## 3. Oracle 测试目录约定

```
neptune-engine/src/engine/agent-loop/<module>/__tests__/
├── <module>.test.ts                      # 单测：覆盖 happy path + edge case
├── fixtures/
│   ├── happy-path.ts                     # 正常流
│   ├── edge-cases.ts                     # 边界
│   └── ...
└── oracle/
    ├── _ccImpl.ts                        # 手抄 cc 实现 + line ref 注释（与 product 解耦）
    ├── matrix.ts                         # 决策矩阵（适用于 algorithm 类）
    ├── <module>.oracle.test.ts           # oracle 对照测试
    └── README.md                         # 说明这个 oracle 覆盖了什么、与 cc 的差异
```

## 4. Oracle 测试运行策略

- **本地开发**：每个 batch 完成时运行一次（约 30-60 秒）
- **CI**：可作为独立 job（不阻塞主流程）
- **regression**：cc 升级时主动运行 oracle 测试，发现行为差异立即评估

## 5. 与 cc 的差异如何记录

每个 batch 完成后在该模块的 `oracle/README.md` 列出：

```markdown
## Differences from cc

| Behavior | cc | engine | Reason |
|---|---|---|---|
| advisor_tool_use 块 | special-cased | 不识别（throw EngineError） | 不抄 product advisor 业务 |
| connector_text 块 | gated by feature('CONNECTOR_TEXT') | 不识别 | 不抄 product connector |
| `_geminiThoughtSignature` 字段 | strip | strip | ✅ 一致 |
| analytics 埋点 (`tengu_streaming_*`) | 内嵌 | 不内置（暴露 hook） | 第一性：engine 不感知业务 |
```

这样：
- 任何后续维护者打开 oracle/README 就知道差异
- 差异不再是隐性，是明确的设计决策
- 未来 cc 升级时知道哪些差异是有意的、哪些可能要补

## 6. Oracle 失败时的处理流程

oracle 测试失败 = engine 实现与 cc 行为不一致。三种情况：

1. **engine 是 bug**：修 engine
2. **cc 是 bug 或 product 关注点**：在 oracle/README 加差异条目，标记为"有意"
3. **fixture 错了**：修 fixture

绝不允许通过"删测试"或"模糊匹配"绕过。

## 7. 实现细节：怎么把 cc 实现"借"过来

product 编不过、模块互依严重的情况下，直接 import 不可行。三种实现方式（按优先级）：

### 方式 A（首选）：纯函数手抄
把 cc 那段函数手抄到 `oracle/_ccImpl.ts`，去掉 product 依赖（用 stub 或裁剪），保留**算法核心 + 来源 line ref 注释**：

```typescript
// oracle/_ccImpl.ts
// Copied from neptune-engine-product/src/services/api/claude.ts:578-621
// As of 2026-05-23. Removed: querySource branch (product concern)
export function ccUserMessageToMessageParam(message, addCache, enableCaching) {
  // ... 原算法
}
```

每次 cc 升级时检查这些手抄文件是否需要同步。

### 方式 B：动态 import + try/catch
某些纯函数 product 改动小、依赖少，可以直接 dynamic import：

```typescript
async function loadCcImpl() {
  try {
    const mod = await import('../../../../../neptune-engine-product/src/...')
    return mod.userMessageToMessageParam
  } catch {
    return null  // product 编不过 → skip oracle 测试 + console.warn
  }
}
```

### 方式 C：JSON snapshot
对于纯函数算法，跑一次 cc 拿到输入 → 输出，存成 JSON snapshot：

```json
{
  "fixture": "text-only.ts",
  "ccVersion": "claude.ts@a9a894e",
  "expected": [{"type":"message_start",...}, ...]
}
```

后续 oracle 测试 expected = snapshot，不再依赖 cc 运行时。
适合算法稳定的模块（SSE 解析）。

## 8. 不在 Oracle 范围内（明确）

- 不用 oracle 测：HookSurface、CancellationToken、BudgetTracker、CircuitBreaker（这些是 substrate 新设计，cc 没有对应）
- 不用 oracle 测：Phase A 5 个 protocol（已经独立设计）
- 不用 oracle 测：Phase B 11 个 kernel tools（接口契约稳定）
