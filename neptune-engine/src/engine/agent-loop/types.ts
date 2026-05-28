/**
 * agent-loop/types.ts — Agent Loop 共用类型
 *
 * 设计原则：
 * - 不暴露 SDK 类型（@anthropic-ai/sdk 类型只在 sse/sseEvents.ts 内部使用）
 * - emit 完整 block 边界，不暴露累积过程的 delta（让上层简洁）
 * - 所有 thinking signature 必须保留，否则 multi-turn 后续请求会被 API 拒
 */

/** Anthropic SSE message_delta.delta.stop_reason 的值集合。 */
export type StopReason =
	| 'end_turn'
	| 'tool_use'
	| 'max_tokens'
	| 'stop_sequence'
	| 'pause_turn'
	| 'refusal'
	| null

/**
 * Token 使用统计快照。
 *
 * 与 Anthropic API 的 BetaUsage 字段对齐，但只保留 substrate 必要的 4 档：
 * - input_tokens: 普通输入
 * - output_tokens: 模型生成
 * - cache_creation_input_tokens: 第一次写入 cache 的 input
 * - cache_read_input_tokens: 命中 cache 读出的 input
 *
 * server_tool_use（advisor 业务）不抄。
 */
export interface UsageSnapshot {
	input_tokens: number
	output_tokens: number
	cache_creation_input_tokens: number
	cache_read_input_tokens: number
}

/** 空 usage 常量。 */
export const EMPTY_USAGE: Readonly<UsageSnapshot> = Object.freeze({
	input_tokens: 0,
	output_tokens: 0,
	cache_creation_input_tokens: 0,
	cache_read_input_tokens: 0,
})

/**
 * 完整的 content block（已去除 delta，已累积完成）。
 *
 * SSEParser 在 content_block_stop 事件到达时输出完整 block。
 * 上层不需要 delta，只需要完整的 text / tool_use / thinking 三种类型。
 */
export type CompleteContentBlock =
	| { type: 'text'; text: string }
	| {
			type: 'tool_use'
			/** Anthropic 分配的 tool_use_id，与后续 tool_result 匹配。 */
			id: string
			/** 工具名称。 */
			name: string
			/**
			 * 工具输入对象（input_json_delta 累积后 JSON.parse 得到）。
			 * 解析失败时该 block 不 emit，改 emit ParsedSSEEvent.error。
			 */
			input: Record<string, unknown>
	  }
	| {
			type: 'thinking'
			thinking: string
			/**
			 * Anthropic 要求 thinking block 必须保留 signature，
			 * 用于后续 multi-turn 请求中证明 thinking 没被篡改。
			 * 缺失会被 API 拒绝。
			 */
			signature: string
	  }

/**
 * 部分 assistant message（message_start 时收到）。
 *
 * 包含 stop_reason、usage 等字段在 message_start 时是空/null，
 * message_delta 会回填。
 */
export interface PartialAssistantMessage {
	id: string
	role: 'assistant'
	model: string
	type: 'message'
	stop_reason: StopReason
	stop_sequence: string | null
	usage: UsageSnapshot
}

/**
 * SSE 解析层对外输出的事件。
 *
 * 上层（AgentLoop）只关心这 5 种事件，不感知 input_json_delta 等中间状态。
 */
export type ParsedSSEEvent =
	| {
			type: 'message_start'
			message: PartialAssistantMessage
	  }
	| {
			type: 'content_block_complete'
			/** 在原始 SSE 流中的 content_block 序号，用于上层重建顺序。 */
			index: number
			block: CompleteContentBlock
	  }
	| {
			type: 'message_delta'
			usage: UsageSnapshot
			stop_reason: StopReason
	  }
	| {
			type: 'message_stop'
	  }
	| {
			type: 'error'
			/**
			 * 错误来源：
			 * - 'sse_protocol': SSE 帧本身不合规
			 * - 'unknown_event': 出现未识别事件类型（不静默 fallback）
			 * - 'block_state': content_block 状态机非法（如未 start 就 stop）
			 * - 'invalid_input_json': tool_use input 累积后 JSON.parse 失败
			 * - 'api_error': stream 中收到 type='error' 事件
			 */
			source:
				| 'sse_protocol'
				| 'unknown_event'
				| 'block_state'
				| 'invalid_input_json'
				| 'api_error'
			error: Error
	  }
