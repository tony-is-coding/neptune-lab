/**
 * agent-loop/index.ts — Agent Loop 公开 API
 *
 * Batch 7 阶段：只暴露 SSE 解析层。
 * 后续 Batch 会在这里继续追加：MessageSerializer / ToolDispatcher / AgentLoop 等。
 */

export type {
	StopReason,
	UsageSnapshot,
	CompleteContentBlock,
	PartialAssistantMessage,
	ParsedSSEEvent,
} from './types.js'
export {EMPTY_USAGE} from './types.js'

export {SSEParser} from './sse/SSEParser.js'
export {ContentBlockAccumulator} from './sse/ContentBlockAccumulator.js'
export type {AccumulatorOutput} from './sse/ContentBlockAccumulator.js'
export {accumulatorOutputToParsedEvent} from './sse/ContentBlockAccumulator.js'
export type {RawSSEEvent} from './sse/sseEvents.js'
export {mapSdkUsage, mapStopReason, partialMessageFromStart} from './sse/sseEvents.js'

// Batch 8: MessageSerializer + Streaming Provider
export {MessageSerializer} from './message/MessageSerializer.js'
export type {SerializedRequestParams, SerializeInput} from './message/MessageSerializer.js'
export {
	normalizeContentBlock,
	normalizeContentBlocks,
	findThinkingBlocksMissingSignature,
} from './message/ContentBlockNormalizer.js'
export type {
	StreamingProviderAdapter,
	StreamingQueryParams,
} from './provider/StreamingProviderAdapter.js'
export {AnthropicStreamingProvider} from './provider/AnthropicStreamingProvider.js'

// Batch 9: ToolDispatcher + ToolUseContext
export type {
	ToolUseContext,
	CanUseToolFn,
	CanUseToolResult,
	KernelProtocolBag,
	CreateToolUseContextOptions,
} from './dispatcher/ToolUseContext.js'
export {createToolUseContext, allowAllCanUseTool} from './dispatcher/ToolUseContext.js'
export {ToolDispatcher} from './dispatcher/ToolDispatcher.js'
export type {ToolUpdate, ToolResultBlock, ToolUseBlock} from './dispatcher/ToolDispatcher.js'

// Batch 10: AgentLoop multi-turn while + stop_reason 状态机
export {AgentLoop} from './loop/AgentLoop.js'
export type {AgentLoopParams} from './loop/AgentLoop.js'
export type {LoopEvent, LoopResult} from './loop/loopEvents.js'

// Batch 11: UsageTracker + HookSurface + Cancellation 硬化
export {UsageTracker} from './usage/UsageTracker.js'
export type {UsageTrackerOptions, TurnUsageRecord} from './usage/UsageTracker.js'
export {calculateCost, DEFAULT_PRICES} from './usage/cost.js'
export type {ModelPrices, PriceTable} from './usage/cost.js'
export {HookSurface} from './hook/HookSurface.js'
export type {
	HookRegistry,
	PreStreamHook,
	PostStreamHook,
	PreToolHook,
	PostToolHook,
	OnErrorHook,
} from './hook/HookSurface.js'
export {CancellationToken} from './cancellation/CancellationToken.js'
export type {CancellationReason, CancellationInfo} from './cancellation/CancellationToken.js'

// Batch 12: Retry / Fallback
export {classifyError, isRetryable} from './retry/ErrorClassifier.js'
export type {ErrorClass, ErrorClassification} from './retry/ErrorClassifier.js'
export {DefaultRetryPolicy} from './retry/RetryPolicy.js'
export type {
	RetryPolicy,
	RetryDecision,
	RetryContext,
	DefaultRetryPolicyOptions,
} from './retry/RetryPolicy.js'
export {withRetry} from './retry/withRetry.js'
export type {WithRetryOptions} from './retry/withRetry.js'
export {RetryingProvider} from './retry/RetryingProvider.js'
export type {RetryingProviderOptions} from './retry/RetryingProvider.js'
export {FallbackProvider} from './fallback/ModelFallback.js'
export type {ModelFallbackOptions} from './fallback/ModelFallback.js'

// Batch 13: Watchdog
export {withStreamWatchdog} from './watchdog/StreamWatchdog.js'
export type {StreamWatchdogOptions} from './watchdog/StreamWatchdog.js'
export {WatchdogProvider} from './watchdog/WatchdogProvider.js'
