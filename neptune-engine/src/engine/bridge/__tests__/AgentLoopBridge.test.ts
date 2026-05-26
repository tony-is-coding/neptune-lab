/**
 * AgentLoopBridge.test.ts — P0.1a 单测
 *
 * 验证 LoopEvent → QueryEvent 桥接的所有映射分支：
 * - stream_request_start → system{turn_start, turn}
 * - assistant_message 含 text → assistant{content}
 * - assistant_message 含 tool_use → tool_use{id, name, input}
 * - assistant_message 同时含 text + tool_use → 多个 QueryEvent
 * - tool_update.kind=result → tool_result{toolUseId, content, isError}
 * - tool_update.kind=started/progress → 不 emit
 * - usage_update → 不 emit
 * - governance_decision → system{governance, event}
 * - error → error{error, phase}
 * - LoopResult.end_turn → system{result, success: true}
 * - LoopResult.aborted → error{reason: 'aborted'}
 * - LoopResult.error → error{reason: 'error', error}
 * - LoopResult.max_turns → system{result, success: false, reason: 'max_turns'}
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import {bridgeAgentLoopToSDK} from '../AgentLoopBridge.js'
import type {LoopEvent, LoopResult} from '../../agent-loop/loop/loopEvents.js'
import type {QueryEvent} from '../../types/query-events.js'
import type {AssistantMessage, Message} from '../../types/message.js'
import {EMPTY_USAGE} from '../../agent-loop/types.js'

// ============================================================
// 辅助：构造 fake LoopEvent generator
// ============================================================

async function* fakeLoop(
	events: LoopEvent[],
	finalResult: LoopResult,
): AsyncGenerator<LoopEvent, LoopResult, unknown> {
	for (const e of events) yield e
	return finalResult
}

function makeAssistantMessage(content: unknown[]): AssistantMessage {
	return {
		type: 'assistant',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'assistant', content: content as Message['message'] extends infer T ? T extends {content?: infer C} ? C : never : never},
	} as AssistantMessage
}

async function collect(
	gen: AsyncGenerator<QueryEvent, void, unknown>,
): Promise<QueryEvent[]> {
	const out: QueryEvent[] = []
	for await (const e of gen) out.push(e)
	return out
}

const okResult: LoopResult = {
	reason: 'end_turn',
	apiStopReason: 'end_turn',
	cumulativeUsage: {...EMPTY_USAGE},
	finalMessages: [],
	turnCount: 1,
}

// ============================================================
// LoopEvent → QueryEvent 映射
// ============================================================

describe('AgentLoopBridge — LoopEvent 映射', () => {
	it('stream_request_start → system turn_start', async () => {
		const events = await collect(
			bridgeAgentLoopToSDK(fakeLoop([{type: 'stream_request_start', turn: 1}], okResult)),
		)
		const turnStart = events.find(
			e => e.type === 'system' && (e as Record<string, unknown>).subtype === 'turn_start',
		)
		expect(turnStart).toBeDefined()
		expect((turnStart as Record<string, unknown>).turn).toBe(1)
	})

	it('assistant_message 含 text → assistant{content}', async () => {
		const events = await collect(
			bridgeAgentLoopToSDK(
				fakeLoop(
					[
						{
							type: 'assistant_message',
							message: makeAssistantMessage([
								{type: 'text', text: 'Hello world'},
							]),
						},
					],
					okResult,
				),
			),
		)
		const assistant = events.find(e => e.type === 'assistant')
		expect(assistant).toBeDefined()
		expect((assistant as Record<string, unknown>).content).toBe('Hello world')
	})

	it('assistant_message 含 tool_use → tool_use{id,name,input}', async () => {
		const events = await collect(
			bridgeAgentLoopToSDK(
				fakeLoop(
					[
						{
							type: 'assistant_message',
							message: makeAssistantMessage([
								{type: 'tool_use', id: 'tu_1', name: 'Bash', input: {command: 'ls'}},
							]),
						},
					],
					okResult,
				),
			),
		)
		const toolUse = events.find(e => e.type === 'tool_use')
		expect(toolUse).toBeDefined()
		expect((toolUse as Record<string, unknown>).id).toBe('tu_1')
		expect((toolUse as Record<string, unknown>).name).toBe('Bash')
		expect((toolUse as Record<string, unknown>).input).toEqual({command: 'ls'})
	})

	it('assistant_message 同时含 text + tool_use → 多 QueryEvent（text 先，tool_use 后）', async () => {
		const events = await collect(
			bridgeAgentLoopToSDK(
				fakeLoop(
					[
						{
							type: 'assistant_message',
							message: makeAssistantMessage([
								{type: 'text', text: 'Running ls'},
								{type: 'tool_use', id: 'tu_1', name: 'Bash', input: {command: 'ls'}},
								{type: 'tool_use', id: 'tu_2', name: 'Grep', input: {pattern: 'foo'}},
							]),
						},
					],
					okResult,
				),
			),
		)
		// 顺序：先 text，再 2 个 tool_use（system result 跟在最后）
		expect(events[0]?.type).toBe('assistant')
		expect((events[0] as Record<string, unknown>).content).toBe('Running ls')
		expect(events[1]?.type).toBe('tool_use')
		expect((events[1] as Record<string, unknown>).id).toBe('tu_1')
		expect(events[2]?.type).toBe('tool_use')
		expect((events[2] as Record<string, unknown>).id).toBe('tu_2')
	})

	it('thinking block 不 emit', async () => {
		const events = await collect(
			bridgeAgentLoopToSDK(
				fakeLoop(
					[
						{
							type: 'assistant_message',
							message: makeAssistantMessage([
								{type: 'thinking', thinking: 'reasoning...', signature: 'sig'},
								{type: 'text', text: 'final answer'},
							]),
						},
					],
					okResult,
				),
			),
		)
		// 应只 emit 1 个 assistant + 1 个 system result
		const nonSystemEvents = events.filter(e => e.type !== 'system')
		expect(nonSystemEvents).toHaveLength(1)
		expect(nonSystemEvents[0]?.type).toBe('assistant')
	})

	it('tool_update.kind=result → tool_result', async () => {
		const events = await collect(
			bridgeAgentLoopToSDK(
				fakeLoop(
					[
						{
							type: 'tool_update',
							update: {
								kind: 'result',
								toolUseId: 'tu_1',
								result: {output: 'ok'},
								isError: false,
							} as unknown as LoopEvent extends infer E ? E extends {update: infer U} ? U : never : never,
						} as LoopEvent,
					],
					okResult,
				),
			),
		)
		const toolResult = events.find(e => e.type === 'tool_result')
		expect(toolResult).toBeDefined()
		expect((toolResult as Record<string, unknown>).toolUseId).toBe('tu_1')
		expect((toolResult as Record<string, unknown>).isError).toBe(false)
	})

	it('tool_update.kind=started → 不 emit（仅 result 暴露给 SDK）', async () => {
		const events = await collect(
			bridgeAgentLoopToSDK(
				fakeLoop(
					[
						{
							type: 'tool_update',
							update: {
								kind: 'started',
								toolUseId: 'tu_1',
								toolName: 'Bash',
							} as unknown as LoopEvent extends infer E ? E extends {update: infer U} ? U : never : never,
						} as LoopEvent,
					],
					okResult,
				),
			),
		)
		const toolEvents = events.filter(
			e => e.type === 'tool_use' || e.type === 'tool_result',
		)
		expect(toolEvents).toHaveLength(0)
	})

	it('usage_update → 不 emit', async () => {
		const events = await collect(
			bridgeAgentLoopToSDK(
				fakeLoop(
					[
						{
							type: 'usage_update',
							usage: {...EMPTY_USAGE, input_tokens: 100},
							cumulative: {...EMPTY_USAGE, input_tokens: 100},
						},
					],
					okResult,
				),
			),
		)
		// 应只剩 system result
		expect(events.every(e => e.type === 'system')).toBe(true)
	})

	it('governance_decision → system{governance}', async () => {
		const events = await collect(
			bridgeAgentLoopToSDK(
				fakeLoop(
					[
						{
							type: 'governance_decision',
							event: {
								phase: 'pre_tool',
								toolUseId: 'tu_1',
								toolName: 'Bash',
								decision: {decision: 'allow'},
							},
						},
					],
					okResult,
				),
			),
		)
		const gov = events.find(
			e => e.type === 'system' && (e as Record<string, unknown>).subtype === 'governance',
		)
		expect(gov).toBeDefined()
	})

	it('LoopEvent.error → ErrorEvent', async () => {
		const events = await collect(
			bridgeAgentLoopToSDK(
				fakeLoop(
					[
						{
							type: 'error',
							error: new Error('stream broken'),
							phase: 'stream',
						},
					],
					okResult,
				),
			),
		)
		const err = events.find(e => e.type === 'error')
		expect(err).toBeDefined()
		expect((err as Record<string, unknown>).phase).toBe('stream')
	})
})

// ============================================================
// LoopResult → QueryEvent 映射
// ============================================================

describe('AgentLoopBridge — LoopResult 终结事件', () => {
	it('end_turn → system{result, success: true}', async () => {
		const events = await collect(
			bridgeAgentLoopToSDK(
				fakeLoop([], {
					reason: 'end_turn',
					apiStopReason: 'end_turn',
					cumulativeUsage: {...EMPTY_USAGE},
					finalMessages: [],
					turnCount: 1,
				}),
			),
		)
		const result = events.find(
			e => e.type === 'system' && (e as Record<string, unknown>).subtype === 'result',
		)
		expect(result).toBeDefined()
		expect((result as Record<string, unknown>).success).toBe(true)
		expect((result as Record<string, unknown>).turnCount).toBe(1)
	})

	it('aborted → ErrorEvent', async () => {
		const events = await collect(
			bridgeAgentLoopToSDK(
				fakeLoop([], {
					reason: 'aborted',
					apiStopReason: null,
					cumulativeUsage: {...EMPTY_USAGE},
					finalMessages: [],
					turnCount: 0,
				}),
			),
		)
		const err = events.find(e => e.type === 'error')
		expect(err).toBeDefined()
		expect((err as Record<string, unknown>).reason).toBe('aborted')
	})

	it('error reason → ErrorEvent + 含 LoopResult.error', async () => {
		const myError = new Error('rate limited')
		const events = await collect(
			bridgeAgentLoopToSDK(
				fakeLoop([], {
					reason: 'error',
					apiStopReason: null,
					cumulativeUsage: {...EMPTY_USAGE},
					finalMessages: [],
					turnCount: 0,
					error: myError,
				}),
			),
		)
		const err = events.find(e => e.type === 'error')
		expect(err).toBeDefined()
		expect((err as Record<string, unknown>).error).toBe(myError)
	})

	it('max_turns → system{result, success: false, reason: max_turns}', async () => {
		const events = await collect(
			bridgeAgentLoopToSDK(
				fakeLoop([], {
					reason: 'max_turns',
					apiStopReason: null,
					cumulativeUsage: {...EMPTY_USAGE},
					finalMessages: [],
					turnCount: 50,
				}),
			),
		)
		const result = events.find(
			e => e.type === 'system' && (e as Record<string, unknown>).subtype === 'result',
		)
		expect(result).toBeDefined()
		expect((result as Record<string, unknown>).success).toBe(false)
		expect((result as Record<string, unknown>).reason).toBe('max_turns')
	})

	it('pause_turn → system{paused}', async () => {
		const events = await collect(
			bridgeAgentLoopToSDK(
				fakeLoop([], {
					reason: 'pause_turn',
					apiStopReason: 'pause_turn',
					cumulativeUsage: {...EMPTY_USAGE},
					finalMessages: [],
					turnCount: 2,
				}),
			),
		)
		const paused = events.find(
			e => e.type === 'system' && (e as Record<string, unknown>).subtype === 'paused',
		)
		expect(paused).toBeDefined()
	})
})

// ============================================================
// 完整流：模拟 1 turn 端到端
// ============================================================

describe('AgentLoopBridge — 完整流', () => {
	it('完整 1 turn：start → assistant text + tool_use → tool_result → end_turn', async () => {
		const events = await collect(
			bridgeAgentLoopToSDK(
				fakeLoop(
					[
						{type: 'stream_request_start', turn: 1},
						{
							type: 'assistant_message',
							message: makeAssistantMessage([
								{type: 'text', text: "I'll run ls"},
								{type: 'tool_use', id: 'tu_1', name: 'Bash', input: {command: 'ls'}},
							]),
						},
						{
							type: 'tool_update',
							update: {
								kind: 'result',
								toolUseId: 'tu_1',
								result: 'file1.txt\nfile2.txt',
								isError: false,
							} as unknown as LoopEvent extends infer E ? E extends {update: infer U} ? U : never : never,
						} as LoopEvent,
					],
					okResult,
				),
			),
		)

		// 按顺序：turn_start → assistant → tool_use → tool_result → result(success)
		const types = events.map(e => `${e.type}/${(e as Record<string, unknown>).subtype ?? ''}`)
		expect(types).toEqual([
			'system/turn_start',
			'assistant/',
			'tool_use/',
			'tool_result/',
			'system/result',
		])
	})
})
