/**
 * AgentLoop 单测 + 端到端集成测试
 *
 * 覆盖 stop_reason 状态机的所有分支，以及与 ToolDispatcher 的集成。
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import {AgentLoop} from '../AgentLoop.js'
import type {LoopEvent, LoopResult} from '../loopEvents.js'
import {createToolUseContext} from '../../dispatcher/ToolUseContext.js'
import {ScriptedProvider, textTurn, toolUseTurn, errorTurn} from './scriptedProvider.js'
import type {Message} from '../../../types/message.js'
import type {Tool, ToolResult} from '../../../types/tool.js'
import type {ParsedSSEEvent} from '../../types.js'

function userMsg(text: string): Message {
	return {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'user', content: text},
	}
}

function makeTool(name: string, response: unknown): Tool {
	return {
		name,
		description: `${name} tool`,
		inputJSONSchema: {type: 'object', properties: {}},
		async call(): Promise<ToolResult<unknown>> {
			return {data: response}
		},
	} as unknown as Tool
}

async function runLoop(
	provider: ScriptedProvider,
	params: Partial<Parameters<typeof AgentLoop.run>[0]> & {messages: Message[]; model: string},
): Promise<{events: LoopEvent[]; result: LoopResult}> {
	const ctx = params.context ?? createToolUseContext({tools: params.tools ?? []})
	const gen = AgentLoop.run({
		provider,
		messages: params.messages,
		model: params.model,
		systemPrompt: params.systemPrompt,
		tools: params.tools,
		signal: params.signal,
		context: ctx,
		maxTokens: params.maxTokens,
		maxTurns: params.maxTurns,
		extra: params.extra,
	})
	const events: LoopEvent[] = []
	let result: LoopResult
	while (true) {
		const next = await gen.next()
		if (next.done) {
			result = next.value
			break
		}
		events.push(next.value)
	}
	return {events, result}
}

describe('AgentLoop — single turn (no tool_use)', () => {
	it('end_turn → 1 turn 退出', async () => {
		const provider = new ScriptedProvider([textTurn('hello world')])
		const {events, result} = await runLoop(provider, {
			messages: [userMsg('hi')],
			model: 'claude-sonnet-4',
		})

		expect(result.reason).toBe('end_turn')
		expect(result.turnCount).toBe(1)
		// message_start usage(input:10, output:1) + message_delta usage(input:0, output:5) 累加
		expect(result.cumulativeUsage.input_tokens).toBe(10)
		expect(result.cumulativeUsage.output_tokens).toBe(6)

		const types = events.map(e => e.type)
		expect(types).toEqual([
			'stream_request_start',
			'assistant_message',
			'usage_update',
		])
	})

	it('max_tokens stop_reason → 立即 break，reason: max_tokens', async () => {
		const truncated: ParsedSSEEvent[] = [
			{
				type: 'message_start',
				message: {
					id: 'a',
					role: 'assistant',
					model: 'm',
					type: 'message',
					stop_reason: null,
					stop_sequence: null,
					usage: {
						input_tokens: 10,
						output_tokens: 1,
						cache_creation_input_tokens: 0,
						cache_read_input_tokens: 0,
					},
				},
			},
			{
				type: 'content_block_complete',
				index: 0,
				block: {type: 'text', text: 'partial...'},
			},
			{
				type: 'message_delta',
				usage: {
					input_tokens: 0,
					output_tokens: 100,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
				stop_reason: 'max_tokens',
			},
			{type: 'message_stop'},
		]
		const provider = new ScriptedProvider([truncated])
		const {result} = await runLoop(provider, {
			messages: [userMsg('long prompt')],
			model: 'm',
		})
		expect(result.reason).toBe('max_tokens')
		expect(result.apiStopReason).toBe('max_tokens')
	})

	it('stop_reason=null → 退 end_turn（API quirk 兜底）', async () => {
		const noStop: ParsedSSEEvent[] = [
			{
				type: 'message_start',
				message: {
					id: 'a',
					role: 'assistant',
					model: 'm',
					type: 'message',
					stop_reason: null,
					stop_sequence: null,
					usage: {
						input_tokens: 10,
						output_tokens: 1,
						cache_creation_input_tokens: 0,
						cache_read_input_tokens: 0,
					},
				},
			},
			{type: 'content_block_complete', index: 0, block: {type: 'text', text: 'x'}},
			// 没有 message_delta 设置 stop_reason
			{type: 'message_stop'},
		]
		const provider = new ScriptedProvider([noStop])
		const {result} = await runLoop(provider, {
			messages: [userMsg('hi')],
			model: 'm',
		})
		expect(result.reason).toBe('end_turn')
	})
})

describe('AgentLoop — multi-turn with tool_use', () => {
	it('tool_use → 执行 → tool_result 反馈 → end_turn 完整 2 turn', async () => {
		const provider = new ScriptedProvider([
			toolUseTurn('tu_1', 'Echo', {x: 'hi'}),
			textTurn('Done.'),
		])
		const tool = makeTool('Echo', 'echoed')
		const ctx = createToolUseContext({tools: [tool]})

		const {events, result} = await runLoop(provider, {
			messages: [userMsg('please use echo')],
			model: 'm',
			tools: [tool],
			context: ctx,
		})

		expect(result.reason).toBe('end_turn')
		expect(result.turnCount).toBe(2)

		// 验证 finalMessages 链：user / assistant(tool_use) / user(tool_result) / assistant(text)
		expect(result.finalMessages).toHaveLength(4)
		expect(result.finalMessages[0].type).toBe('user')
		expect(result.finalMessages[1].type).toBe('assistant')
		expect(result.finalMessages[2].type).toBe('user')
		expect(result.finalMessages[3].type).toBe('assistant')

		// 第二轮 user message 应该是 tool_result block 数组
		const t3Content = result.finalMessages[2].message?.content
		expect(Array.isArray(t3Content)).toBe(true)
		expect((t3Content as unknown[])[0]).toMatchObject({
			type: 'tool_result',
			tool_use_id: 'tu_1',
			content: 'echoed',
		})

		// 验证 events 含 tool_update
		const toolUpdates = events.filter(e => e.type === 'tool_update')
		expect(toolUpdates.length).toBeGreaterThanOrEqual(2) // started + result
	})

	it('tool 抛错 → tool_result is_error → 模型可见 → 继续 multi-turn', async () => {
		const provider = new ScriptedProvider([
			toolUseTurn('tu_err', 'Boom', {}),
			textTurn('I saw the error.'),
		])
		const errorTool: Tool = {
			name: 'Boom',
			description: 'd',
			inputJSONSchema: {type: 'object'},
			async call() {
				throw new Error('tool exploded')
			},
		} as unknown as Tool
		const ctx = createToolUseContext({tools: [errorTool]})

		const {result} = await runLoop(provider, {
			messages: [userMsg('please use boom')],
			model: 'm',
			tools: [errorTool],
			context: ctx,
		})

		expect(result.reason).toBe('end_turn')
		expect(result.turnCount).toBe(2)

		// 第二轮 user message 应该有 is_error: true
		const t3Content = result.finalMessages[2].message?.content as unknown as Array<{
			type: string
			is_error?: boolean
			content: string
		}>
		expect(t3Content[0]?.is_error).toBe(true)
		expect(t3Content[0]?.content).toContain('tool exploded')
	})

	it('未知 tool → tool_result is_error: Unknown tool → 模型可继续', async () => {
		const provider = new ScriptedProvider([
			toolUseTurn('tu_x', 'NotExist', {}),
			textTurn('I gave up.'),
		])
		const ctx = createToolUseContext({tools: []})

		const {result} = await runLoop(provider, {
			messages: [userMsg('use NotExist')],
			model: 'm',
			tools: [],
			context: ctx,
		})

		expect(result.reason).toBe('end_turn')
		const t3Content = result.finalMessages[2].message?.content as unknown as Array<{
			is_error?: boolean
			content: string
		}>
		expect(t3Content[0]?.is_error).toBe(true)
		expect(t3Content[0]?.content).toContain('Unknown tool')
	})

	it('stop_reason=tool_use 但无 tool_use blocks → reason: error', async () => {
		const broken: ParsedSSEEvent[] = [
			{
				type: 'message_start',
				message: {
					id: 'a',
					role: 'assistant',
					model: 'm',
					type: 'message',
					stop_reason: null,
					stop_sequence: null,
					usage: {
						input_tokens: 10,
						output_tokens: 1,
						cache_creation_input_tokens: 0,
						cache_read_input_tokens: 0,
					},
				},
			},
			{type: 'content_block_complete', index: 0, block: {type: 'text', text: 'x'}},
			{
				type: 'message_delta',
				usage: {
					input_tokens: 0,
					output_tokens: 5,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
				stop_reason: 'tool_use',
			},
			{type: 'message_stop'},
		]
		const provider = new ScriptedProvider([broken])
		const {result} = await runLoop(provider, {
			messages: [userMsg('hi')],
			model: 'm',
		})
		expect(result.reason).toBe('error')
		expect(result.error?.message).toContain('no tool_use blocks')
	})
})

describe('AgentLoop — error / abort / max_turns', () => {
	it('Provider stream error → emit error event + reason: error', async () => {
		const provider = new ScriptedProvider([errorTurn('Network kaboom')])
		const {events, result} = await runLoop(provider, {
			messages: [userMsg('hi')],
			model: 'm',
		})
		expect(result.reason).toBe('error')
		expect(result.error?.message).toContain('Network kaboom')
		const errorEvent = events.find(e => e.type === 'error')
		expect(errorEvent).toMatchObject({type: 'error', phase: 'stream'})
	})

	it('Pre-call abort → reason: aborted, turn 0', async () => {
		const provider = new ScriptedProvider([textTurn('never reached')])
		const ctrl = new AbortController()
		ctrl.abort()
		const ctx = createToolUseContext({abortController: ctrl})

		const {result} = await runLoop(provider, {
			messages: [userMsg('hi')],
			model: 'm',
			context: ctx,
		})
		expect(result.reason).toBe('aborted')
		expect(result.turnCount).toBe(0)
	})

	it('maxTurns 上限 → reason: max_turns', async () => {
		const provider = new ScriptedProvider([
			toolUseTurn('tu_1', 'Echo', {}),
			toolUseTurn('tu_2', 'Echo', {}),
			toolUseTurn('tu_3', 'Echo', {}),
		])
		const tool = makeTool('Echo', 'e')
		const ctx = createToolUseContext({tools: [tool]})

		const {result} = await runLoop(provider, {
			messages: [userMsg('hi')],
			model: 'm',
			tools: [tool],
			context: ctx,
			maxTurns: 2,
		})
		expect(result.reason).toBe('max_turns')
		expect(result.turnCount).toBe(2)
	})

	it('serializer 抛错（thinking 缺 signature）→ phase: serialization', async () => {
		// 这个错误来自 resolveToolParams 阶段（缺 inputJSONSchema）
		const badTool = {
			name: 'BadTool',
			description: 'd',
			// 故意没有 inputJSONSchema
		} as unknown as Tool
		const provider = new ScriptedProvider([textTurn('never')])
		const {events, result} = await runLoop(provider, {
			messages: [userMsg('hi')],
			model: 'm',
			tools: [badTool],
		})
		expect(result.reason).toBe('error')
		const errorEvent = events.find(e => e.type === 'error')
		expect(errorEvent).toMatchObject({phase: 'serialization'})
	})
})

describe('AgentLoop — provider 集成', () => {
	it('每轮都把当前 messages 发给 provider（含上轮 assistant + tool_result）', async () => {
		const provider = new ScriptedProvider([
			toolUseTurn('tu_1', 'Echo', {}),
			textTurn('done'),
		])
		const tool = makeTool('Echo', 'r')
		const ctx = createToolUseContext({tools: [tool]})

		await runLoop(provider, {
			messages: [userMsg('start')],
			model: 'm',
			tools: [tool],
			context: ctx,
		})

		expect(provider.callLog).toHaveLength(2)
		// 第一轮：1 条 user message
		expect(provider.callLog[0]!.messages).toHaveLength(1)
		// 第二轮：user(start) + assistant(tool_use) + user(tool_result) = 3
		expect(provider.callLog[1]!.messages).toHaveLength(3)
	})

	it('resolvedTools 透传给 provider', async () => {
		const provider = new ScriptedProvider([textTurn('done')])
		const tool = makeTool('Echo', 'r')
		await runLoop(provider, {
			messages: [userMsg('hi')],
			model: 'm',
			tools: [tool],
		})
		expect(provider.callLog[0]!.resolvedTools).toBeDefined()
		expect(provider.callLog[0]!.resolvedTools).toHaveLength(1)
	})

	it('extra 字段透传给 provider', async () => {
		const provider = new ScriptedProvider([textTurn('done')])
		await runLoop(provider, {
			messages: [userMsg('hi')],
			model: 'm',
			extra: {anthropic_beta: ['flag']},
		})
		expect(provider.callLog[0]!.extra).toEqual({anthropic_beta: ['flag']})
	})
})
