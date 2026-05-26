/**
 * AgentLoopBridge — substrate AgentLoop → SDK QueryEvent 适配器
 *
 * 设计目的（v5.0 / B7）：
 * - AgentEngine.query 当前走 HeadlessQueryEngine.submitMessage（200 行单轮 stub）
 * - v5.0 解开双轨制：让 AgentEngine.query 走 AgentLoop.runWithStore
 * - AgentLoop emit 的是 LoopEvent，SDK 用户消费的是 QueryEvent —— 中间需要桥接
 *
 * 桥接策略（基于 cc HeadlessQueryEngine 实测的 SDK 事件形态对齐）：
 *
 *   LoopEvent.stream_request_start → SDK system{subtype:'turn_start', turn}
 *   LoopEvent.assistant_message    → 拆出 text blocks → assistant{content}
 *                                     拆出 tool_use blocks → tool_use{id, name, input}
 *                                     可同时 emit 多个（一轮多 tool_use）
 *   LoopEvent.tool_update.kind=result → tool_result{toolUseId, content, isError}
 *   LoopEvent.tool_update.kind=started/progress → 不 emit（SDK 不需要 progress 事件）
 *   LoopEvent.usage_update         → 不 emit（caller 用 LoopResult.cumulativeUsage）
 *   LoopEvent.governance_decision  → system{subtype:'governance', event}
 *   LoopEvent.error                → error{error, phase}
 *
 *   LoopResult.reason='end_turn'  → system{subtype:'result', success: true}
 *   LoopResult.reason='aborted'    → error{error: 'aborted'}
 *   LoopResult.reason='error'      → error{error: result.error}
 *   LoopResult.reason='max_turns' / 'budget_exceeded' / 'max_tokens' → system{subtype:'result', success: false}
 *
 * 设计原则：
 * - 纯桥接，不做业务决策（governance / runStore 等都是 AgentLoopParams 注入）
 * - LoopEvent 不丢弃（每条 LoopEvent 至少 yield 一个 SDK 事件，或显式 skip 注释）
 * - 错误事件透传（不吞）
 * - 0 外部依赖
 */

import type {LoopEvent, LoopResult} from '../agent-loop/loop/loopEvents.js'
import type {ContentItem, AssistantMessage} from '../types/message.js'
import type {QueryEvent} from '../types/query-events.js'

// ============================================================
// 主桥接函数
// ============================================================

/**
 * 把 AgentLoop AsyncGenerator 包装成 SDK QueryEvent 流。
 *
 * 用法（在 AgentEngine.query 内）：
 *   for await (const event of bridgeAgentLoopToSDK(
 *     AgentLoop.runWithStore({...})
 *   )) {
 *     yield event
 *   }
 */
export async function* bridgeAgentLoopToSDK(
	gen: AsyncGenerator<LoopEvent, LoopResult, unknown>,
): AsyncGenerator<QueryEvent, void, unknown> {
	while (true) {
		const next = await gen.next()
		if (next.done) {
			// LoopResult → 终结事件
			yield* mapLoopResult(next.value)
			return
		}
		const event = next.value
		yield* mapLoopEvent(event)
	}
}

// ============================================================
// LoopEvent → QueryEvent 映射（每条事件可能产生 0..N 个 QueryEvent）
// ============================================================

function* mapLoopEvent(event: LoopEvent): Generator<QueryEvent, void, unknown> {
	switch (event.type) {
		case 'stream_request_start':
			yield {
				type: 'system',
				subtype: 'turn_start',
				turn: event.turn,
			} as QueryEvent
			return

		case 'assistant_message':
			yield* mapAssistantMessage(event.message)
			return

		case 'tool_update':
			// 只 emit 'result' kind（已经是工具完成结果），started/progress 不 emit 给 SDK
			if (event.update.kind === 'result') {
				yield {
					type: 'tool_result',
					toolUseId: event.update.toolUseId,
					content: event.update.result,
					isError: event.update.isError ?? false,
				} as QueryEvent
			}
			return

		case 'usage_update':
			// 不 emit（caller 用 LoopResult.cumulativeUsage 拿最终值）
			return

		case 'governance_decision':
			yield {
				type: 'system',
				subtype: 'governance',
				event: event.event,
			} as QueryEvent
			return

		case 'error':
			yield {
				type: 'error',
				error: event.error,
				phase: event.phase,
			} as QueryEvent
			return
	}
}

// ============================================================
// AssistantMessage → 多个 QueryEvent（拆 text + tool_use）
// ============================================================

function* mapAssistantMessage(
	message: AssistantMessage,
): Generator<QueryEvent, void, unknown> {
	const blocks = (message.message?.content as ContentItem[] | undefined) ?? []
	const textParts: string[] = []
	const toolUses: Array<{id: string; name: string; input: Record<string, unknown>}> = []

	for (const block of blocks) {
		const type = (block as {type?: string}).type
		if (type === 'text') {
			const text = (block as {text?: string}).text ?? ''
			textParts.push(text)
		} else if (type === 'tool_use') {
			const tu = block as {id?: string; name?: string; input?: unknown}
			if (tu.id && tu.name) {
				toolUses.push({
					id: tu.id,
					name: tu.name,
					input: (tu.input as Record<string, unknown>) ?? {},
				})
			}
		}
		// thinking / 其他 block 不 emit 给 SDK
	}

	// 先 emit 文本（SDK 习惯先看 assistant 文本再看 tool_use）
	if (textParts.length > 0) {
		yield {
			type: 'assistant',
			content: textParts.join(''),
		} as QueryEvent
	}

	// 再 emit tool_use（一轮可能有多个）
	for (const tu of toolUses) {
		yield {
			type: 'tool_use',
			id: tu.id,
			name: tu.name,
			input: tu.input,
		} as QueryEvent
	}
}

// ============================================================
// LoopResult → 最终事件
// ============================================================

function* mapLoopResult(result: LoopResult): Generator<QueryEvent, void, unknown> {
	switch (result.reason) {
		case 'end_turn':
		case 'stop_sequence':
			yield {
				type: 'system',
				subtype: 'result',
				success: true,
				turnCount: result.turnCount,
				usage: result.cumulativeUsage,
			} as QueryEvent
			return

		case 'pause_turn':
			yield {
				type: 'system',
				subtype: 'paused',
				turnCount: result.turnCount,
				usage: result.cumulativeUsage,
			} as QueryEvent
			return

		case 'aborted':
			yield {
				type: 'error',
				error: 'Query aborted',
				reason: 'aborted',
			} as QueryEvent
			return

		case 'error':
			yield {
				type: 'error',
				error: result.error ?? new Error('Unknown error'),
				reason: 'error',
			} as QueryEvent
			return

		case 'max_turns':
		case 'max_tokens':
		case 'budget_exceeded':
		case 'refusal':
			yield {
				type: 'system',
				subtype: 'result',
				success: false,
				reason: result.reason,
				turnCount: result.turnCount,
				usage: result.cumulativeUsage,
			} as QueryEvent
			return
	}
}
