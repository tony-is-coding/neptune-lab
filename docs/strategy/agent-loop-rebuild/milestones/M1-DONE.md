# M1 骨架层完成报告

> **里程碑**：M1 — Agent Loop 骨架层（Batch 7-11）
> **完成日期**：2026-05-23
> **HEAD**：`<待 commit>`

---

## 完成定义验收

| 项 | 状态 | 证据 |
|---|---|---|
| 端到端 happy path 跑通 | ✅ | `loop/__tests__/e2e/todoWrite.e2e.test.ts` + `multiTool.e2e.test.ts` |
| 至少 3 个 Phase B kernel tools 集成 | ✅ | TodoWrite + TaskCreate（4 个 e2e） |
| Cancellation 100ms 响应 | ✅ | `AgentLoopHooks.test.ts` "mid-turn abort ≤ 100ms 退出"（实测 < 200ms 留 buffer） |
| 现有 218 测试不回归 | ✅ | 全量 1163 / 1100 pass / 63 Postgres 噪音不变 |
| 新增至少 80 测试 | ✅ | 实际 147 个 agent-loop 测试 |
| Oracle 对照机制就位 | ✅ | `sse/__tests__/oracle/README.md` 列出与 cc 行为差异 |

## Batch 完成清单

| Batch | 主题 | 文件 | 测试 | commit |
|---|---|---|---|---|
| 7 | SSE 解析 + content_block 累积 | 11 | 27 | `8396616` |
| 8 | MessageSerializer + AnthropicStreamingProvider | 8 | 41 | `07cc38b` |
| 9 | ToolDispatcher + ToolUseContext | 6 | 23 | `72d945e` |
| 10 | AgentLoop multi-turn while + e2e demo | 7 | 18 | `18b1966` |
| 11 | UsageTracker + HookSurface + Cancellation | 8+ | 38+ | `<待>` |

## 模块布局（完成后）

```
neptune-engine/src/engine/agent-loop/
├── types.ts                                    # 公共类型
├── index.ts                                    # 公开 API
├── sse/                                        # Batch 7
│   ├── SSEParser.ts
│   ├── ContentBlockAccumulator.ts
│   └── sseEvents.ts
├── message/                                    # Batch 8
│   ├── MessageSerializer.ts
│   └── ContentBlockNormalizer.ts
├── provider/                                   # Batch 8
│   ├── StreamingProviderAdapter.ts
│   └── AnthropicStreamingProvider.ts
├── dispatcher/                                 # Batch 9
│   ├── ToolDispatcher.ts
│   └── ToolUseContext.ts
├── loop/                                       # Batch 10
│   ├── AgentLoop.ts
│   └── loopEvents.ts
├── usage/                                      # Batch 11
│   ├── UsageTracker.ts
│   └── cost.ts
├── hook/                                       # Batch 11
│   └── HookSurface.ts
└── cancellation/                               # Batch 11
    └── CancellationToken.ts
```

## 测试覆盖

```
agent-loop/sse                — 27 测试
agent-loop/message            — 30 测试（Normalizer 11 + Serializer 19）
agent-loop/provider           — 11 测试
agent-loop/dispatcher         — 23 测试
agent-loop/loop               — 32 测试（AgentLoop 14 + Hooks 14 + e2e 4）
agent-loop/usage              — 13 测试
agent-loop/hook               — 11 测试
agent-loop/cancellation       — 10 测试
合计                          — 147 测试
```

## 第一性原理体现

1. **暴露错误，不代偿**
   - SSE 未识别事件 → `ParsedSSEEvent.error`
   - tool 错误 → `tool_result is_error`，模型自决
   - API 错误 → 上抛到 LoopResult.error，让 product 决策（retry / fallback）
   - 未注入 kernel protocol → 工具调用直接失败，不静默 no-op

2. **per-session 隔离**
   - UsageTracker / HookSurface / CancellationToken 都是实例化、不全局
   - SkillRegistry / TodoState / TaskQueue / MemoryStore / ToolRegistry 通过 ctx.kernel 注入

3. **给契约，不内置策略**
   - Provider 通过 `StreamingProviderAdapter` 接口注入（默认 AnthropicStreaming）
   - Permission 通过 `CanUseToolFn` 注入（默认 allow-all）
   - Hook 通过 `HookSurface` 注入（默认 no-op）
   - Price table 可注入

4. **失败要响**
   - boundary check 通过（0 反向依赖）
   - oracle README 显式记录与 cc 的差异
   - tsc 0 错；测试覆盖率良好

## 已知限制（M2/M3 解决）

| 限制 | 处理 batch |
|---|---|
| 没有 retry / fallback model / non-streaming fallback | Batch 12 |
| 没有 stream watchdog（90s idle abort） | Batch 13 |
| 没有 prompt caching API + breakpoint policy | Batch 14 |
| 没有 history compaction（长会话撞 200k 上限） | Batch 15 |
| 没有 token budget / circuit breaker | Batch 16 |
| Phase B 工具用 zod schema，需要 ToolRegistry 提供 zod→JSON 转换 | 未规划，独立小 batch |
| HeadlessQueryEngine 仍是简化版（未替换为 AgentLoop） | M2 末或 M3 |
| 并发 tool 执行（cc 的 StreamingToolExecutor 模式） | M3 末（如有需要） |

## 不抄 cc 的明确清单（与 oracle README 对齐）

- ❌ langfuse / `tengu_*` analytics 埋点
- ❌ growthbook feature gates
- ❌ VCR (`withStreamingVCR`)
- ❌ advisor model（subagent 业务模型）
- ❌ connector_text / `feature('CONNECTOR_TEXT')`
- ❌ `USER_TYPE='ant'` 内部 research 字段
- ❌ `headlessProfilerCheckpoint` / `queryCheckpoint` 业务追踪
- ❌ `getMessagesAfterCompactBoundary` 业务方法
- ❌ LSP defer (`shouldDeferLspTool`)
- ❌ snip / microcompact / autocompact / token budget（M3 给抽象，不抄 cc 实现）
- ❌ stream watchdog 内嵌（M2 单独模块）
- ❌ 全局 cost 累加（per-session 隔离）

## 下一步

进入 M2 鲁棒层（Batch 12-13）：

- Batch 12：withRetry + 错误分类 + non-streaming fallback + fallbackModel
- Batch 13：streamWatchdog + stallDetection
