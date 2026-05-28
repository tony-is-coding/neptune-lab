# SSEParser Oracle — 与 cc 行为差异表

> 配套 `03-oracle-verification.md` 第 5 节"与 cc 的差异如何记录"

参考 cc 实现：`neptune-engine-product/src/services/api/claude.ts:1993-2310`（queryModel 主循环 SSE 分发段）

## 实现策略

Batch 7 阶段不做"运行时双跑对照"（product 整体编不过、import 不可行），改为：
- **Algorithm 对照**：手工对比"输入 X cc 输出 Y" vs "输入 X engine 输出 Y'"，列在下方差异表
- 后续 batch（如有 nightly CI）可加 snapshot 对照（用 fixture 跑 engine、把结果存 JSON）

## 共同行为（一致）

- `message_start` 时累积 partialMessage（id / model / usage / stop_reason）
- `content_block_start` 区分 text / tool_use / thinking 三类，按 index 累积
- `content_block_start` 自带的 text 内容**故意忽略**（cc 注释：SDK 会在 delta 重复 emit 同样 text）
- `text_delta` / `input_json_delta` / `thinking_delta` / `signature_delta` 累积到对应槽位
- `citations_delta` 静默忽略（cc 行为相同）
- `content_block_stop` 时把累积器槽位 emit 成完整 block
- `tool_use.input` 在 stop 时 `JSON.parse(partialJson || '{}')`
- `thinking.signature` 必须保留（API 后续 multi-turn 强制要求）

## 有意差异（不抄）

| Behavior | cc 行为 | engine 行为 | 理由 |
|---|---|---|---|
| `server_tool_use` block | special-case 处理（advisor 业务） | emit error (unknown_event) | 不抄 advisor |
| `connector_text` block + `connector_text_delta` | gated by `feature('CONNECTOR_TEXT')` | emit error (unknown_event) | 不抄 connector 业务 |
| `advisor_tool_result` block | special-case，标记 isAdvisorInProgress | emit error (unknown_event) | 不抄 advisor |
| `research` 字段提取 (`USER_TYPE='ant'`) | 内部业务字段 | 不识别 | 不抄内部分支 |
| `tengu_streaming_*` analytics 埋点 | 大量 logEvent 调用 | 没有 | engine 不感知业务，hook 留给 product |
| stall detection (30s 警告) | 内嵌在 SSE 主循环 | 不在本 batch 做（Batch 13） | 关注点分离 |
| stream watchdog (90s idle abort) | 内嵌在 SSE 主循环 | 不在本 batch 做（Batch 13） | 关注点分离 |
| `message_stop` 后 cleanupStream | 立即调 stream.controller.abort() | 不做（取消由 AgentLoop 决策） | substrate 不替上层决策 |
| 历史消息 mutation (`lastMsg.message.usage = usage`) | 直接 mutate（cc 注释解释为何） | 不做（accumulator 是不可变 emit） | engine 用 immutable emit，简化推理 |

## 故意收紧（更严格）

| Behavior | cc 行为 | engine 行为 | 理由 |
|---|---|---|---|
| 未识别事件类型 | logEvent + 静默继续 | emit error (unknown_event) | fail-loud 是第一性原则 |
| 流提前结束（有 open slot） | 静默退出 | emit error (block_state) | fail-loud |
| 无 message_start 的流 | 容忍 | emit error (sse_protocol) | fail-loud |
| `tool_use.input` 累积后非 object | 容忍（throw RangeError 后 product 重试） | emit error (invalid_input_json) | 错误标准化 |

## 待 oracle 双跑验证（追加项）

后续 batch 可考虑落地：
1. 用 cc 真实 fixture（一段 logged production SSE）跑 cc + engine，比较 ParsedSSEEvent 序列
2. 用 mock Anthropic SDK fixture 跑 e2e，确保 SDK 类型变化时 oracle 失败而非静默通过

## 维护

- cc 升级（`claude.ts` 改动）→ review 是否影响 SSE 分发逻辑、更新本文档
- 发现新差异 → 立即添加条目（不允许隐性差异）
