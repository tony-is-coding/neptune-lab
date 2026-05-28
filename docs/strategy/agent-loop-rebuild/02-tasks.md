# Agent Loop Rebuild — Batch 任务清单

> **配套**：[00-plan.md](./00-plan.md), [01-design.md](./01-design.md), [03-oracle-verification.md](./03-oracle-verification.md)

每个 batch 包含：① 目标 ② 新增/修改文件 ③ 设计要点 ④ 测试 ⑤ 验收标准 ⑥ 风险。
每个 batch 闭环 + commit + ff 进 develop。

---

## Batch 7 — SSE 解析 + content_block 累积器（M1 起点）

### 目标
建立 SSE 事件解析层。把 Anthropic 流式响应（10 种事件）解析成"完整 block"边界事件，对外屏蔽累积过程。

### 文件清单
新增（10 文件）：
- `neptune-engine/src/engine/agent-loop/types.ts`
- `neptune-engine/src/engine/agent-loop/sse/SSEParser.ts`
- `neptune-engine/src/engine/agent-loop/sse/ContentBlockAccumulator.ts`
- `neptune-engine/src/engine/agent-loop/sse/sseEvents.ts`（输入事件类型映射）
- `neptune-engine/src/engine/agent-loop/index.ts`
- `neptune-engine/src/engine/agent-loop/sse/__tests__/SSEParser.test.ts`
- `neptune-engine/src/engine/agent-loop/sse/__tests__/ContentBlockAccumulator.test.ts`
- `neptune-engine/src/engine/agent-loop/sse/__tests__/fixtures/text-only.ts`（cc oracle 输入流）
- `neptune-engine/src/engine/agent-loop/sse/__tests__/fixtures/tool-use.ts`
- `neptune-engine/src/engine/agent-loop/sse/__tests__/fixtures/thinking-with-tools.ts`

### 设计要点
- SSEParser 接受 `AsyncIterable<RawMessageStreamEvent>`，输出 `AsyncGenerator<ParsedSSEEvent>`
- 内部维护 `contentBlocks: CompleteContentBlock[]`，按 `index` 累积
- `content_block_stop` 时 emit 完整 block，丢弃累积器槽位
- `tool_use.input` 是 string 累积（input_json_delta），stop 时 `JSON.parse`
- `thinking.signature` 必须在 stop 前从 signature_delta 收齐
- 未识别事件 → fail-loud（throw EngineError，不静默 fallback）
- 错误事件（type='error'） → emit ParsedSSEEvent.error 让上层决策

### 测试
- 至少 18 个测试：
  - 6 种 happy path（纯 text / 单 tool_use / 多 tool_use / thinking + text / text + tool_use / 含 message_delta）
  - 6 种 corner case（空 message / max_tokens 截断 / pause_turn / 中途 message_stop / 未知事件 → fail-loud / signature 缺失 → error）
  - 3 种 SDK 类型边界（input_json_delta 非法 JSON / content_block_start 缺失 / content_block_stop 跨槽位）
  - 3 种 oracle 对照（fixture 流双跑 cc 实现 vs engine 实现，对比 ParsedSSEEvent 序列）

### 验收标准
- `bunx tsc --noEmit` 0 错
- `bun test src/engine/agent-loop/sse` 全过
- boundary check 通过（不引入对 product 的反向依赖）
- 不回归现有 218 测试

### 风险
- thinking signature 处理 corner case（cc 在 connector_text 分支也处理 signature_delta）→ 不抄 connector，只在 thinking block 处理
- 未识别事件 fail-loud 可能误伤未来新事件（thinking 2.0）→ 给 hook 接入扩展

---

## Batch 8 — MessageSerializer + Provider SDK 接入

### 目标
打通 Engine 内部 Message 类型 ↔ Anthropic API MessageParam 类型；让 AnthropicProvider 真正调 SDK + 消费 SSEParser。

### 文件清单
新增：
- `neptune-engine/src/engine/agent-loop/message/MessageSerializer.ts`
- `neptune-engine/src/engine/agent-loop/message/ContentBlockNormalizer.ts`
- `neptune-engine/src/engine/agent-loop/message/__tests__/MessageSerializer.test.ts`
- `neptune-engine/src/engine/agent-loop/message/__tests__/ContentBlockNormalizer.test.ts`
- `neptune-engine/src/engine/agent-loop/message/__tests__/fixtures/messages.ts`

修改：
- `neptune-engine/src/engine/provider/adapters/AnthropicProvider.ts`（去掉 `unsupportedProductRuntimeProvider`，接 SDK + SSEParser）
- `neptune-engine/src/engine/provider/ProviderAdapter.ts`（query 改成 emit ParsedSSEEvent）

### 设计要点
- `MessageSerializer.toRequestParams({ messages, system, tools, model, maxTokens, cacheControl? })` → Anthropic API params
- 正确处理 4 种 message 形态：
  - 纯 user 文本 → `{role:'user', content:'...'}`
  - user 含 tool_result block 数组 → `{role:'user', content:[{type:'tool_result',...}]}`
  - assistant 纯文本 → `{role:'assistant', content:'...'}`
  - assistant 含 tool_use + thinking → `{role:'assistant', content:[{type:'thinking',signature},{type:'tool_use',...}]}`
- ContentBlockNormalizer：去掉非 API 字段（`_geminiThoughtSignature` 等内部痕迹），保留 signature
- AnthropicProvider 用 `@anthropic-ai/sdk` 的 `client.beta.messages.create({...params, stream: true})`，把 stream 喂进 SSEParser
- API key / baseURL 通过 `AnthropicProviderConfig` 注入（已有），保留之前的 applyConfig/restoreConfig 但改成 SDK options 注入而非 env 污染
- AbortSignal 全链路传到 SDK fetch

### 测试
- 至少 20 个测试：
  - 序列化 8 种（4 形态 × 含/不含 cache_control）
  - 反序列化 4 种（API response → engine Message）
  - Normalizer 4 种（gemini metadata 剥离 / thinking signature 保留 / tool_use input 序列化 / 未知字段丢弃）
  - Provider 集成 4 种（mock SDK：拿到完整 ParsedSSEEvent 序列 / abort / SDK throw / config 注入）

### 验收
- AnthropicProvider 用真实 fixture 跑通（mock SDK，不打真实 API）
- `unsupportedProductRuntimeProvider` 从 AnthropicProvider 中删除（其余 6 个 Provider 留 unsupported）
- 现有 218 测试不回归

### 风险
- SDK 类型升级 → 在 MessageSerializer 内部隔离，对外用 engine 自定义类型
- prompt caching 接入要等 Batch 14（这里只留接口字段）

---

## Batch 9 — ToolDispatcher + ToolUseContext 构造

### 目标
建立工具调度层。给定 `tool_use` 块数组，串行执行（错误包成 `tool_result is_error`），输出 `tool_result` 块。

### 文件清单
新增：
- `neptune-engine/src/engine/agent-loop/dispatcher/ToolDispatcher.ts`
- `neptune-engine/src/engine/agent-loop/dispatcher/ToolUseContext.ts`
- `neptune-engine/src/engine/agent-loop/dispatcher/createToolUseContext.ts`（工厂）
- `neptune-engine/src/engine/agent-loop/dispatcher/__tests__/ToolDispatcher.test.ts`
- `neptune-engine/src/engine/agent-loop/dispatcher/__tests__/ToolUseContext.test.ts`
- `neptune-engine/src/engine/agent-loop/dispatcher/__tests__/fixtures/mockTools.ts`

修改：
- `neptune-engine/packages/builtin-tools/src/kernel-context.ts`（让 KernelToolContext 兼容 ToolUseContext.kernel 字段）

### 设计要点
- `ToolDispatcher.execute(toolUseBlocks, context)` → AsyncGenerator<ToolUpdate>
- ToolUpdate 形态：`{ kind: 'started' | 'progress' | 'result' | 'error', toolUseId, ... }`
- 串行执行（M1 简单版），并发版后置
- 错误处理：tool 抛错 → 包成 `{type:'tool_result', tool_use_id, is_error:true, content:'...'}`，**不冲垮 loop**
- AbortSignal：每个 tool 调用前检查 signal.aborted；in-flight 的 tool 通过 ctx.signal 自己响应
- 取消语义（按用户拍板）：abort 时所有未完成 tool 包成 `tool_result is_error: 'aborted'` 发回模型
- ToolUseContext 字段：abortController / agentId / options / permissions / kernel / hooks
- kernel 字段透传 Phase A 5 个 protocol（SkillRegistry / TodoState / TaskQueue / ToolRegistry / Memory）
- canUseTool 调用：tool 执行前调一次（默认 allow）

### 测试
- 至少 16 个测试：
  - 单 tool happy path
  - 多 tool 串行
  - tool 抛错 → tool_result is_error: true
  - tool 返非字符串 → 自动 JSON.stringify
  - abort 中途 → 后续 tool tool_result is_error: 'aborted'
  - canUseTool 拒绝 → tool_result is_error
  - 未知 tool name → tool_result is_error
  - kernel 字段正确透传（用 Phase B 的 TodoWrite mock 验证）

### 验收
- Phase B 的 TodoWrite tool 在集成测试里能跑通（mock context，不依赖 multi-turn loop）
- 现有 218 测试不回归

### 风险
- ToolUseContext 字段过多 → 用 builder 模式给 sane defaults
- 并发版延后 → 在文档明确"M1 不支持并发 tool 执行"

---

## Batch 10 — AgentLoop multi-turn while + stop_reason 状态机

### 目标
打通端到端 multi-turn loop：模型 emit tool_use → 执行 → 包 tool_result → 反馈 → 下一轮 → 直到 end_turn。

### 文件清单
新增：
- `neptune-engine/src/engine/agent-loop/loop/AgentLoop.ts`
- `neptune-engine/src/engine/agent-loop/loop/StopReasonHandler.ts`
- `neptune-engine/src/engine/agent-loop/loop/loopEvents.ts`（emit 给上层的事件类型）
- `neptune-engine/src/engine/agent-loop/loop/__tests__/AgentLoop.test.ts`
- `neptune-engine/src/engine/agent-loop/loop/__tests__/StopReasonHandler.test.ts`
- `neptune-engine/src/engine/agent-loop/loop/__tests__/e2e/scriptedProvider.ts`（mock provider 工厂）
- `neptune-engine/src/engine/agent-loop/loop/__tests__/e2e/todoWrite.test.ts`
- `neptune-engine/src/engine/agent-loop/loop/__tests__/e2e/taskCreate.test.ts`
- `neptune-engine/src/engine/agent-loop/loop/__tests__/e2e/multiTurn.test.ts`

修改：
- `neptune-engine/src/engine/cc-runtime/HeadlessQueryEngine.ts`（用 AgentLoop 替换内部简化实现）

### 设计要点
- `AgentLoop.run(params)` async generator，yield LoopEvent，return LoopResult
- LoopEvent 形态：`stream_request_start` / `assistant_message` / `tool_update` / `usage_update` / `error`
- LoopResult：`{ reason: 'end_turn' | 'max_tokens' | 'aborted' | 'budget_exceeded' | 'error', usage, finalMessages }`
- 主循环：
  ```
  let messages = params.messages
  while (true) {
    yield 'stream_request_start'
    const params = serializer.toRequestParams(messages, ...)
    const stream = provider.query(params)
    const assistantMsg = await collectStream(stream)  // 内部消费 SSEParser
    yield assistantMsg
    if (stop_reason === 'end_turn') break
    if (stop_reason === 'max_tokens') return reason: 'max_tokens'  // M3 处理 recovery
    if (stop_reason === 'tool_use') {
      const toolUseBlocks = extractToolUseBlocks(assistantMsg)
      const toolResults = []
      for await (const update of dispatcher.execute(toolUseBlocks, ctx)) {
        yield update
        if (update.kind === 'result') toolResults.push(update.toolResultBlock)
      }
      messages = [...messages, assistantMsg, { role: 'user', content: toolResults }]
      continue
    }
  }
  ```
- Cancellation：每轮开始前检查 signal；signal 触发时 dispatcher 自己处理；loop 退出 reason: 'aborted'

### 测试 — e2e 必须项
- TodoWrite e2e：scripted provider mock 模型先 emit tool_use(TodoWrite) → 接 tool_result 后 emit text → end_turn
- TaskCreate e2e：类似
- 多轮 e2e：模型 emit Read → tool_result → 再 emit Edit → tool_result → end_turn
- abort e2e：mid-turn 取消，loop 100ms 内退出
- max_tokens：loop 立即退出（不重试）
- 错误 e2e：tool 抛错 → tool_result is_error → 模型可见

### 验收
- M1 完成定义全部满足（详见 01-design 第 8 节）
- HeadlessQueryEngine 替换为 AgentLoop 后，不破坏现有 sql-based session storage
- 现有 218 测试 + 新增至少 30 测试全过

### 风险
- HeadlessQueryEngine 接口契约 → 保留对外契约不变（submitMessage signature），只换内部实现

---

## Batch 11 — UsageTracker + HookSurface + Cancellation 硬化

### 目标
给 AgentLoop 装上 token 统计 + 业务 hook 注入点 + 取消硬化。

### 文件清单
新增：
- `neptune-engine/src/engine/agent-loop/usage/UsageTracker.ts`
- `neptune-engine/src/engine/agent-loop/usage/cost.ts`（4 档 token 计价）
- `neptune-engine/src/engine/agent-loop/usage/__tests__/UsageTracker.test.ts`
- `neptune-engine/src/engine/agent-loop/hook/HookSurface.ts`
- `neptune-engine/src/engine/agent-loop/hook/HookRegistry.ts`
- `neptune-engine/src/engine/agent-loop/hook/__tests__/HookSurface.test.ts`
- `neptune-engine/src/engine/agent-loop/cancellation/CancellationToken.ts`
- `neptune-engine/src/engine/agent-loop/cancellation/__tests__/CancellationToken.test.ts`

修改：
- `neptune-engine/src/engine/agent-loop/loop/AgentLoop.ts`（接入 UsageTracker / HookSurface）
- `neptune-engine/src/engine/agent-loop/dispatcher/ToolDispatcher.ts`（接入 hooks.preTool / postTool）

### 设计要点
- UsageTracker：
  - 字段：`input_tokens / output_tokens / cache_creation_input_tokens / cache_read_input_tokens`
  - `accumulate(usage, model)` 累加；`reset()` 清零；`snapshot()` 拿当前值
  - cost 计算用 model 价格表（cc 有的 calculateUSDCost）
  - per-session（不全局）
- HookSurface：
  - preStream / postStream / preTool / postTool / onError 5 个 hook
  - 每个 hook 都 async + Promise.allSettled（一个 hook 失败不影响其他）
  - HookRegistry：per-session 注册，多个 hook 顺序执行
- CancellationToken：包装 AbortController，给"原因"和"时间"标记，便于上层区分 user-abort vs watchdog-abort vs loop-budget-abort

### 测试
- UsageTracker 8 个（累加 / 4 档独立 / cost 计算 / model 切换 / cache 命中 / 重置 / snapshot）
- HookSurface 6 个（5 hook 调用顺序 / hook 失败隔离 / hook 修改 params / 多个 hook 顺序 / async 等待 / 注册顺序）
- Cancellation 4 个（reason 标记 / 时间记录 / 多次 abort 幂等 / 上下文链）

### 验收
- M1 完整闭环（端到端可用 substrate）
- 现有 218 + 新增 ~80 测试全过

### 风险
- HookSurface 设计过度（YAGNI） → M1 只暴露最常用 5 个 hook，其他延后

---

## 🎯 M1 骨架层完成（Batch 7-11）

完成定义：
- ✅ 端到端 happy path 跑通
- ✅ 至少 3 个 Phase B kernel tools 集成测试通过
- ✅ Cancellation 100ms 响应
- ✅ 现有 218 测试不回归 + 新增 ~80 测试全过
- ✅ Oracle 验证（SSE 解析 / message 序列化）通过

完成后：在 `docs/strategy/agent-loop-rebuild/milestones/M1-DONE.md` 写完成报告，列出 known limitations。

---

## Batch 12 — withRetry + 错误分类 + non-streaming fallback + fallbackModel

### 目标
让 AgentLoop 能扛真实网络条件：429/500/network blip 自动 retry、流式撞墙切非流、主模型挂切备用。

### 文件清单
新增：
- `neptune-engine/src/engine/agent-loop/retry/RetryPolicy.ts`
- `neptune-engine/src/engine/agent-loop/retry/DefaultRetryPolicy.ts`
- `neptune-engine/src/engine/agent-loop/retry/ErrorClassifier.ts`
- `neptune-engine/src/engine/agent-loop/retry/__tests__/`
- `neptune-engine/src/engine/agent-loop/fallback/NonStreamingFallback.ts`
- `neptune-engine/src/engine/agent-loop/fallback/ModelFallback.ts`
- `neptune-engine/src/engine/agent-loop/fallback/__tests__/`

修改：
- AgentLoop / AnthropicProvider 接入 retry + fallback

### 设计要点
- ErrorClassifier 分类：
  - `retryable_rate_limited`（429 / 529） → 退避 retry
  - `retryable_transient`（5xx / network） → 退避 retry
  - `retryable_overloaded`（特定 anthropic overloaded_error） → 退避 retry
  - `non_retryable_auth`（401 / 403） → 立即抛
  - `non_retryable_client`（400 / 422） → 立即抛
  - `unknown` → 视配置决定
- DefaultRetryPolicy：指数退避（base 500ms × 2^n + jitter），上限 5 次，总时间不超过 60s
- NonStreamingFallback：流式拿到部分响应后失败 → 非流重试当前请求，参考 cc executeNonStreamingRequest
- ModelFallback：主模型失败超过 N 次 → 切到 fallbackModel（注入 onStreamingFallback hook）
- tombstone 处理（cc 风格）：fallback 时把已 emit 的 partial assistantMessage 标记 tombstone，避免 thinking signature 不一致

### 测试
- 至少 18 个测试：
  - 错误分类 8 种
  - 退避算法（jitter / 上限）
  - retry 成功（第 3 次成功）
  - retry 失败（5 次都失败）
  - non-streaming fallback 触发条件
  - model fallback 触发条件
  - tombstone 流程

### 验收
- 用 mock SDK 模拟 429 → 第 2 次成功，e2e 验证 retry 工作
- 现有测试不回归

### 风险
- cc 的 withRetry 200+ 行有大量 product 决策（quota / circuit）→ 只搬错误分类 + 退避算法，policy 留接口

---

## Batch 13 — streamWatchdog + stallDetection

### 目标
流卡死的物理事实必须能自救。

### 文件清单
新增：
- `neptune-engine/src/engine/agent-loop/watchdog/StreamWatchdog.ts`
- `neptune-engine/src/engine/agent-loop/watchdog/StallDetector.ts`
- `neptune-engine/src/engine/agent-loop/watchdog/__tests__/`

修改：
- AgentLoop.run / SSEParser 接入 watchdog

### 设计要点
- StreamWatchdog：默认 90s idle abort，可配置（CLAUDE_STREAM_IDLE_TIMEOUT_MS env / 注入 timeout）
- StallDetector：30s 警告，调用 hook（不 abort）
- 每个 SSE 事件到达时 reset timer
- watchdog 触发 → reason 'stream_idle_timeout'，AbortController.abort('stream_idle')
- StallDetector 触发 → 调 hook.onStall（默认 no-op）

### 测试
- 至少 10 个测试：
  - 90s 内有事件 → 不触发
  - 90s 无事件 → abort
  - 30s 无事件 → 警告 hook 调用
  - 多次 reset 工作正常
  - 注入自定义超时

### 验收
- 模拟"卡 95 秒"场景能 abort
- 现有测试不回归

### 风险
- 测试用 fake timer（bun 的 timer mock）

---

## 🎯 M2 鲁棒层完成（Batch 12-13）

完成定义：
- ✅ retry / fallback / watchdog 全套
- ✅ engine 能跑 1 小时真实任务不死

---

## Batch 14 — Prompt Caching API + 默认 cache breakpoint policy

### 目标
让 engine 利用 Anthropic prompt caching 降本提速。

### 文件清单
新增：
- `neptune-engine/src/engine/agent-loop/caching/CacheControlPolicy.ts`
- `neptune-engine/src/engine/agent-loop/caching/DefaultCachePolicy.ts`
- `neptune-engine/src/engine/agent-loop/caching/BreakpointPlanner.ts`
- `neptune-engine/src/engine/agent-loop/caching/__tests__/`

修改：
- MessageSerializer 接受 cache_control 参数
- AgentLoop 注入 CacheControlPolicy

### 设计要点
- CacheControlPolicy 接口：`plan(messages, system, tools) → CacheBreakpoints`
- 默认 policy：
  - system prompt 末尾打 1 个 ephemeral cache（5 分钟）
  - tools schema 末尾打 1 个 ephemeral cache
  - 最末 user message 打 1 个 ephemeral cache（rolling）
- BreakpointPlanner 算法：参考 cc addCacheBreakpoints (3134-3284)，但只保留 anthropic API 必要逻辑
- 每个 turn cache hit 上报到 UsageTracker（cache_read_input_tokens）

### 测试
- 至少 12 个测试

### 验收
- e2e：3 轮对话第 2、3 轮看到 cache_read_input_tokens > 0

### 风险
- 1h cache TTL 决策（cc 有 querySource 分支） → 只用 5min ephemeral，1h 留扩展

---

## Batch 15 — CompactionPolicy + 默认 microcompact

### 目标
长会话不撞 200k 上限。给 CompactionPolicy 接口 + 默认 microcompact 实现。

### 文件清单
新增：
- `neptune-engine/src/engine/agent-loop/compaction/CompactionPolicy.ts`
- `neptune-engine/src/engine/agent-loop/compaction/MicroCompaction.ts`
- `neptune-engine/src/engine/agent-loop/compaction/__tests__/`

修改：
- AgentLoop 每轮开始前调 compaction.shouldCompact + compact

### 设计要点
- CompactionPolicy 接口：`shouldCompact(messages, usage) → bool` + `compact(messages) → { messages, tokensFreed }`
- 默认 microcompact：
  - 当 token usage 超过阈值（默认 150k）触发
  - 找最早的 N 个 tool_result block，按 tool_use_id 替换 content 为 "[compacted: <summary>]"
  - 不动 user / assistant text，只动 tool_result（cc 同样策略）
- 阈值 / 替换数量 / 摘要算法都可注入

### 测试
- 至少 14 个测试

### 验收
- mock 200 轮长会话不撞 200k

### 风险
- cc microcompact 200 行 + cached_microcompact 是优化 → 只搬最小算法，cached 后置

---

## Batch 16 — BudgetTracker + CircuitBreaker

### 目标
模型跑飞防御 + 连败保护。

### 文件清单
新增：
- `neptune-engine/src/engine/agent-loop/budget/BudgetTracker.ts`
- `neptune-engine/src/engine/agent-loop/budget/DefaultBudget.ts`
- `neptune-engine/src/engine/agent-loop/budget/CircuitBreaker.ts`
- `neptune-engine/src/engine/agent-loop/budget/__tests__/`

修改：
- AgentLoop 接入 BudgetTracker.shouldStop + CircuitBreaker.recordFailure/Success

### 设计要点
- BudgetTracker 接口：`recordUsage(usage)` / `shouldStop()` / `remaining()`
- 默认 budget：每 turn 200k token 上限，超过 emit budget_exceeded 退出 loop
- CircuitBreaker 简化版：5 次连续失败 → 30s 冷却，期间所有请求 reject
- 都 per-session

### 测试
- 至少 12 个测试

### 验收
- mock 跑飞 → loop emit budget_exceeded 在 1 turn 内退出
- mock 连续失败 → 第 6 次 immediate reject

### 风险
- circuit breaker 误伤合理 retry → 失败计数只算 non_retryable_*

---

## 🎯 M3 效率层完成（Batch 14-16）

完成定义：
- ✅ caching / compaction / budget / circuit breaker 全套
- ✅ engine 能跑 200 轮长会话、不撞墙、不烧钱
- ✅ Substrate 全部能力到位，Phase B 11 个 kernel tools 全 e2e 通过

---

## 工作流程（每 batch 重复）

1. 从 02-tasks.md 拿到 batch 目标 + 文件清单 + 设计要点
2. 新增/修改文件（按文件清单）
3. 跑验证三件套：
   ```bash
   bash neptune-engine/scripts/verify-runtime-boundaries.sh
   cd neptune-engine && bunx tsc --noEmit --pretty false
   cd neptune-engine && bun test src/engine
   ```
4. 跑 oracle 验证（详见 03-oracle-verification.md）
5. commit + ff 进 develop
6. 简短汇报：本 batch 做了什么、测试通过情况、与 cc 的差异
7. 进入下一个 batch
