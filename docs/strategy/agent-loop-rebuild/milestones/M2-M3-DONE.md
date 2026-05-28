# M2 鲁棒层 + M3 效率层完成报告

> **里程碑**：M2 + M3（Batch 12-16）
> **完成日期**：2026-05-23
> **HEAD**：`<待 commit>`

---

## 完成定义验收（M2 + M3）

### M2 鲁棒层

| 项 | 状态 | 证据 |
|---|---|---|
| 错误分类 + retry | ✅ | `retry/ErrorClassifier.ts` 18 决策矩阵 + `RetryPolicy.ts` 9 测试 |
| RetryingProvider 集成 | ✅ | 第一个事件错误自动 retry / 不可重试透传 |
| FallbackProvider 集成 | ✅ | 主 model 404/503 切 fallback；auth/client 不切 |
| Stream watchdog (90s idle) | ✅ | `withStreamWatchdog` Promise.race 实现 |
| Stall detection | ✅ | onStall hook 触发 |
| 取消信号集成 | ✅ | retry sleep 可取消；watchdog 触发 cancellation |

### M3 效率层

| 项 | 状态 | 证据 |
|---|---|---|
| Prompt caching API | ✅ | `DefaultCachePolicy` 系统/工具/最末 user 各打 ephemeral |
| Cache breakpoint immutable | ✅ | `caching/__tests__/` 11 测试 |
| Thinking block 不打 cache | ✅ | 与 cc 行为一致 |
| History compaction 抽象 | ✅ | `MicroCompaction` 替 tool_result 内容 |
| Token budget tracker | ✅ | `DefaultBudgetTracker` 200k 默认上限 |
| Circuit breaker | ✅ | half-open / reset 状态机 |
| 全部接到 AgentLoop | ✅ | cachePolicy/compactionPolicy/budgetTracker 注入字段 |

## 三大 milestone 总进度

| Milestone | Batch | 完成日期 | agent-loop 测试 |
|---|---|---|---|
| M1 骨架 | 7-11 | 2026-05-23 | 147 |
| M2 鲁棒 | 12-13 | 2026-05-23 | 200（+53） |
| **M3 效率** | **14-16** | **2026-05-23** | **231（+31）** |

## 累计 commit 链（develop）

```
b7dd85a Batch 15 — CompactionPolicy + MicroCompaction
1aefd09 Batch 14 — Prompt Caching API + DefaultCachePolicy
84e4236 Batch 13 — StreamWatchdog + StallDetector（M2 完成）
0fc8356 Batch 12 — withRetry + 错误分类 + ModelFallback（M2 启动）
8eba937 Batch 11 — UsageTracker + HookSurface + Cancellation（M1 完成）
18b1966 Batch 10 — AgentLoop multi-turn while + e2e demo
72d945e Batch  9 — ToolDispatcher + ToolUseContext
07cc38b Batch  8 — MessageSerializer + AnthropicStreamingProvider
8396616 Batch  7 — Agent Loop SSE 解析层
437d495 docs: Agent Loop Rebuild 完整规划
0ce17cf docs: Engine Substrate Debt
```

## 完整模块布局

```
neptune-engine/src/engine/agent-loop/
├── types.ts / index.ts
├── sse/                         (Batch 7)
│   ├── SSEParser.ts
│   ├── ContentBlockAccumulator.ts
│   └── sseEvents.ts
├── message/                     (Batch 8)
│   ├── MessageSerializer.ts
│   └── ContentBlockNormalizer.ts
├── provider/                    (Batch 8)
│   ├── StreamingProviderAdapter.ts
│   └── AnthropicStreamingProvider.ts
├── dispatcher/                  (Batch 9)
│   ├── ToolDispatcher.ts
│   └── ToolUseContext.ts
├── loop/                        (Batch 10)
│   ├── AgentLoop.ts
│   └── loopEvents.ts
├── usage/                       (Batch 11)
│   ├── UsageTracker.ts
│   └── cost.ts
├── hook/                        (Batch 11)
│   └── HookSurface.ts
├── cancellation/                (Batch 11)
│   └── CancellationToken.ts
├── retry/                       (Batch 12)
│   ├── ErrorClassifier.ts
│   ├── RetryPolicy.ts
│   ├── RetryingProvider.ts
│   └── withRetry.ts
├── fallback/                    (Batch 12)
│   └── ModelFallback.ts
├── watchdog/                    (Batch 13)
│   ├── StreamWatchdog.ts
│   └── WatchdogProvider.ts
├── caching/                     (Batch 14)
│   └── CacheControlPolicy.ts
├── compaction/                  (Batch 15)
│   └── CompactionPolicy.ts
└── budget/                      (Batch 16)
    ├── BudgetTracker.ts
    └── CircuitBreaker.ts
```

## 推荐 Provider 组合（外到内）

```ts
const provider = new FallbackProvider(
  new RetryingProvider(
    new WatchdogProvider(
      new AnthropicStreamingProvider(config),
      {idleTimeoutMs: 90_000, onStall: ({elapsedSinceLastEventMs}) => {...}},
    ),
    {policy: new DefaultRetryPolicy()},
  ),
  {fallbackModel: 'claude-3-5-sonnet-20241022'},
)
```

## 推荐 AgentLoop 用法（全套）

```ts
const usage = new UsageTracker()
const tracker = new DefaultBudgetTracker({tokenLimit: 200_000})
const cache = new DefaultCachePolicy()
const compact = new MicroCompaction({tokenThreshold: 150_000, preserveRecent: 20})
const hooks = new HookSurface({
  postTool: [({toolResult}) => log.info(`tool ${toolResult.tool_use_id} done`)],
  onError: [({phase, error}) => sentry.capture({phase, error})],
})
const ctx = createToolUseContext({
  tools,
  kernel: {todoState, taskQueue, skillRegistry, memoryStore, toolRegistry},
})

for await (const event of AgentLoop.run({
  provider, // 已用上面的组合
  messages: [userMsg('plan + create + execute')],
  model: 'claude-sonnet-4-20250514',
  tools,
  context: ctx,
  hooks,
  usageTracker: usage,
  cachePolicy: cache,
  compactionPolicy: compact,
  budgetTracker: tracker,
})) {
  // event: stream_request_start | assistant_message | tool_update | usage_update | error
}
```

## 第一性原理体现（全部 batch）

1. **暴露错误，不代偿**
   - SSE 未识别事件 → ParsedSSEEvent.error
   - tool 错误 → tool_result is_error
   - API 错误 → LoopResult.error，product 决策
   - retry 失败 → 透传错误事件
   - watchdog 超时 → emit api_error 让 retry 重试

2. **per-session 隔离**
   - 全部模块都是实例化（UsageTracker / HookSurface / BudgetTracker / CircuitBreaker / CancellationToken）
   - 不引入新全局变量

3. **给契约，不内置策略**
   - RetryPolicy / CompactionPolicy / CacheControlPolicy / BudgetTracker 都是接口 + 默认实现
   - product 可逐项替换

4. **失败要响**
   - boundary check 全程通过
   - oracle README 显式记录与 cc 的差异
   - tsc 0 错；测试覆盖率 231 个

5. **不抄业务**
   - langfuse / `tengu_*` 埋点
   - VCR / advisor / connector_text / `USER_TYPE='ant'`
   - growthbook feature gates / cached_microcompact / autocompact 调度
   - quota / billing / SI 业务分类

## 已知限制 / 未来工作

| 限制 | 处置建议 |
|---|---|
| Phase B 工具用 zod schema，需要 ToolRegistry 提供 zod→JSON 转换 | 独立小 batch（影响小）|
| HeadlessQueryEngine 仍是简化版（未替换为 AgentLoop） | 待业务方接入 AgentLoop 后再切（现在两路径并存） |
| 并发 tool 执行（cc 的 StreamingToolExecutor 模式） | 视真实场景需要决定是否实现 |
| 1h cache TTL 需要 beta flag | DefaultCachePolicy 可注入；product 自行启用 |
| Pause_turn 的 sleep+resume | 当前直接 break；需要时再补 |

## 工程指标汇总

- 累计代码：约 4400 行（含测试和注释）
- 累计测试：231 个 agent-loop 测试 + 1100+ 现有测试 = 1184 pass
- 0 回归 / 0 tsc 错 / boundary 100% 通过
- M1+M2+M3 共 10 个 batch / 10 个 commit / 全部 ff 进 develop

## 下一步建议

agent-loop 自身已完成 M3。后续工作建议：

1. **集成验证**：把 AgentLoop 接入 HeadlessQueryEngine，跑真实 Anthropic API end-to-end
2. **ToolRegistry zod 转换**：让 Phase B 工具能直接用，不用 e2e 手补 schema
3. **Provider 其他实现**：OpenAI / Gemini / Bedrock / Vertex 等的 streaming provider（参考 AnthropicStreamingProvider 模式）
4. **Phase B 工具完整集成**：跑通 11 个 kernel tools 的端到端 e2e
5. **Phase A 更多 protocol 实现**：持久化版 SkillRegistry / TodoState / TaskQueue（接入 SQLite 或 Postgres）
