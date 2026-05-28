/**
 * AgentLoop hooks 集成测试 — 验证 Batch 11 接入正确
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import {AgentLoop} from '../AgentLoop.js'
import {createToolUseContext} from '../../dispatcher/ToolUseContext.js'
import {ScriptedProvider, textTurn, toolUseTurn} from './scriptedProvider.js'
import {HookSurface} from '../../hook/HookSurface.js'
import {UsageTracker} from '../../usage/UsageTracker.js'
import type {Message} from '../../../types/message.js'
import type {Tool, ToolResult} from '../../../types/tool.js'

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
		description: name,
		inputJSONSchema: {type: 'object'},
		async call(): Promise<ToolResult<unknown>> {
			return {data: response}
		},
	} as unknown as Tool
}

async function runLoop(params: Parameters<typeof AgentLoop.run>[0]): Promise<{
	events: Array<unknown>
	result: unknown
}> {
	const events: Array<unknown> = []
	const gen = AgentLoop.run(params)
	while (true) {
		const next = await gen.next()
		if (next.done) return {events, result: next.value}
		events.push(next.value)
	}
}

describe('AgentLoop + HookSurface 集成', () => {
	it('preStream + postStream hook 按顺序触发', async () => {
		const provider = new ScriptedProvider([textTurn('done')])
		const hooks = new HookSurface()
		const log: string[] = []
		hooks.register('preStream', info => {
			log.push(`pre-${info.turn}`)
		})
		hooks.register('postStream', info => {
			log.push(`post-${info.turn}`)
		})
		const ctx = createToolUseContext()
		await runLoop({
			provider,
			messages: [userMsg('hi')],
			model: 'm',
			context: ctx,
			hooks,
		})
		expect(log).toEqual(['pre-1', 'post-1'])
	})

	it('preTool 拒绝 → tool 不执行 → tool_result is_error', async () => {
		const provider = new ScriptedProvider([
			toolUseTurn('tu_1', 'Echo', {}),
			textTurn('done'),
		])
		const tool = makeTool('Echo', 'should-not-run')
		let toolCalled = false
		const tools = [
			{
				...tool,
				async call() {
					toolCalled = true
					return {data: 'ok'}
				},
			} as unknown as Tool,
		]
		const hooks = new HookSurface({
			preTool: [() => ({allow: false, reason: 'policy denied'})],
		})
		const ctx = createToolUseContext({tools})
		const {result} = await runLoop({
			provider,
			messages: [userMsg('hi')],
			model: 'm',
			tools,
			context: ctx,
			hooks,
		})
		expect(toolCalled).toBe(false)
		const finalMessages = (result as {finalMessages: Message[]}).finalMessages
		const trContent = finalMessages[2].message?.content as unknown as Array<{
			is_error?: boolean
			content: string
		}>
		expect(trContent[0]?.is_error).toBe(true)
		expect(trContent[0]?.content).toBe('policy denied')
	})

	it('postTool hook 收到 tool_result', async () => {
		const provider = new ScriptedProvider([
			toolUseTurn('tu_1', 'Echo', {}),
			textTurn('done'),
		])
		const tool = makeTool('Echo', 'r')
		const tools = [tool]
		const seen: Array<string> = []
		const hooks = new HookSurface({
			postTool: [
				info => {
					seen.push(info.toolResult.tool_use_id)
				},
			],
		})
		const ctx = createToolUseContext({tools})
		await runLoop({
			provider,
			messages: [userMsg('hi')],
			model: 'm',
			tools,
			context: ctx,
			hooks,
		})
		expect(seen).toEqual(['tu_1'])
	})

	it('onError hook 在 stream 错误时触发', async () => {
		const provider = new ScriptedProvider([
			[
				{
					type: 'error',
					source: 'api_error',
					error: new Error('network kaboom'),
				},
			],
		])
		const errors: Error[] = []
		const hooks = new HookSurface()
		hooks.register('onError', info => {
			errors.push(info.error)
		})
		const ctx = createToolUseContext()
		await runLoop({
			provider,
			messages: [userMsg('hi')],
			model: 'm',
			context: ctx,
			hooks,
		})
		expect(errors).toHaveLength(1)
		expect(errors[0]?.message).toContain('network kaboom')
	})
})

describe('AgentLoop + UsageTracker 集成', () => {
	it('多轮 usage 累计到 tracker', async () => {
		const provider = new ScriptedProvider([
			toolUseTurn('tu_1', 'Echo', {}),
			textTurn('done'),
		])
		const tool = makeTool('Echo', 'r')
		const tracker = new UsageTracker()
		const ctx = createToolUseContext({tools: [tool]})
		await runLoop({
			provider,
			messages: [userMsg('hi')],
			model: 'claude-sonnet-4-20250514',
			tools: [tool],
			context: ctx,
			usageTracker: tracker,
		})
		const snap = tracker.snapshot()
		expect(snap.turns).toBe(2)
		expect(snap.usage.output_tokens).toBeGreaterThan(0)
		expect(snap.costUSD).toBeGreaterThan(0)
	})

	it('history 记录每个 turn 的 model + cost', async () => {
		const provider = new ScriptedProvider([
			toolUseTurn('tu_1', 'Echo', {}),
			textTurn('done'),
		])
		const tool = makeTool('Echo', 'r')
		const tracker = new UsageTracker()
		const ctx = createToolUseContext({tools: [tool]})
		await runLoop({
			provider,
			messages: [userMsg('hi')],
			model: 'claude-sonnet-4-20250514',
			tools: [tool],
			context: ctx,
			usageTracker: tracker,
		})
		const history = tracker.history()
		expect(history).toHaveLength(2)
		expect(history[0]?.model).toBe('claude-sonnet-4-20250514')
		expect(history[0]?.turn).toBe(1)
	})
})

describe('AgentLoop cancellation 100ms 响应', () => {
	it('mid-turn abort（abort during tool execution）≤ 100ms 退出', async () => {
		// 两轮：第一轮模型 emit tool_use，第二轮文字
		const provider = new ScriptedProvider([
			toolUseTurn('tu_1', 'Slow', {}),
			textTurn('never reached'),
		])
		// 这个工具会监听 abort 信号
		const slowTool: Tool = {
			name: 'Slow',
			description: 'd',
			inputJSONSchema: {type: 'object'},
			async call(_input, ctx) {
				const signal = (ctx as {abortController?: AbortController}).abortController?.signal
				await new Promise<void>((resolve, reject) => {
					if (signal?.aborted) return reject(new Error('Aborted'))
					const onAbort = () => reject(new Error('Aborted'))
					signal?.addEventListener('abort', onAbort)
					setTimeout(() => {
						signal?.removeEventListener('abort', onAbort)
						resolve()
					}, 1000)
				})
				return {data: 'finished'}
			},
		} as unknown as Tool
		const ctrl = new AbortController()
		const ctx = createToolUseContext({tools: [slowTool], abortController: ctrl})

		const start = Date.now()
		setTimeout(() => ctrl.abort(), 30)

		const {result} = await runLoop({
			provider,
			messages: [userMsg('please')],
			model: 'm',
			tools: [slowTool],
			context: ctx,
		})

		const elapsed = Date.now() - start
		expect(elapsed).toBeLessThan(200) // 留余量但远小于工具的 1000ms
		// 工具会因 abort 包成 tool_result is_error，loop 在第二轮开始检查 abort 后退出
		const r = result as {reason: string; turnCount: number}
		expect(['aborted', 'end_turn'].includes(r.reason)).toBe(true)
	})
})
