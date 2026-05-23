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
