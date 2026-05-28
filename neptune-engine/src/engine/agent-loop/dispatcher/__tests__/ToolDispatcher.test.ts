/**
 * ToolDispatcher 单测
 *
 * 覆盖：
 * - 单 tool happy path
 * - 多 tool 串行
 * - tool 抛错 → tool_result is_error: true（不冲垮 loop）
 * - tool 返非字符串 → JSON.stringify 序列化
 * - resultForAssistant 优先于 data
 * - abort 中途 → 后续 tool tool_result is_error: 'aborted'
 * - canUseTool 拒绝 → tool_result is_error
 * - canUseTool 改写 input
 * - 未知 tool name → tool_result is_error: 'unknown tool'
 * - tool 缺 call() → tool_result is_error
 * - progress 事件 emit
 */

import {describe, expect, it} from 'bun:test'
import {ToolDispatcher, type ToolUseBlock, type ToolUpdate} from '../ToolDispatcher.js'
import {createToolUseContext} from '../ToolUseContext.js'
import type {Tool} from '../../../types/tool.js'
import {
	makeEchoTool,
	makeErrorTool,
	makeAbortableTool,
	makeProgressingTool,
	makeObjectTool,
} from './fixtures/mockTools.js'

function tu(id: string, name: string, input: Record<string, unknown> = {}): ToolUseBlock {
	return {type: 'tool_use', id, name, input}
}

async function drain(gen: AsyncGenerator<ToolUpdate>): Promise<ToolUpdate[]> {
	const out: ToolUpdate[] = []
	for await (const e of gen) out.push(e)
	return out
}

describe('ToolDispatcher.execute', () => {
	it('单 tool happy path: started → result', async () => {
		const tools = [makeEchoTool('Echo', 'hello')]
		const ctx = createToolUseContext({tools})
		const updates = await drain(ToolDispatcher.execute([tu('t1', 'Echo')], ctx))
		expect(updates).toHaveLength(2)
		expect(updates[0]).toMatchObject({kind: 'started', toolUseId: 't1', toolName: 'Echo'})
		expect(updates[1]).toMatchObject({
			kind: 'result',
			toolResultBlock: {type: 'tool_result', tool_use_id: 't1', content: 'hello'},
		})
	})

	it('多 tool 串行：按顺序 emit 每个 tool 的 started+result', async () => {
		const tools = [makeEchoTool('A', 'a-output'), makeEchoTool('B', 'b-output')]
		const ctx = createToolUseContext({tools})
		const updates = await drain(
			ToolDispatcher.execute([tu('t1', 'A'), tu('t2', 'B')], ctx),
		)
		const results = updates.filter(u => u.kind === 'result')
		expect(results).toHaveLength(2)
		expect((results[0] as {toolResultBlock: {content: string}}).toolResultBlock.content).toBe('a-output')
		expect((results[1] as {toolResultBlock: {content: string}}).toolResultBlock.content).toBe('b-output')
	})

	it('tool 抛错 → tool_result is_error: true，不冲垮 dispatcher', async () => {
		const tools = [makeErrorTool('Boom', 'kaboom')]
		const ctx = createToolUseContext({tools})
		const updates = await drain(ToolDispatcher.execute([tu('t1', 'Boom')], ctx))
		const result = updates.find(u => u.kind === 'result')
		expect(result).toMatchObject({
			toolResultBlock: {is_error: true, content: 'Tool error: kaboom'},
		})
	})

	it('错误 tool 之后 dispatcher 继续执行后续 tool', async () => {
		const tools = [makeErrorTool('Bad', 'x'), makeEchoTool('Good', 'g')]
		const ctx = createToolUseContext({tools})
		const updates = await drain(
			ToolDispatcher.execute([tu('t1', 'Bad'), tu('t2', 'Good')], ctx),
		)
		const results = updates.filter(u => u.kind === 'result')
		expect(results).toHaveLength(2)
		expect((results[0] as {toolResultBlock: {is_error?: boolean}}).toolResultBlock.is_error).toBe(true)
		expect((results[1] as {toolResultBlock: {content: string}}).toolResultBlock.content).toBe('g')
	})

	it('tool 返非字符串 → JSON.stringify 后给模型', async () => {
		const tools = [makeObjectTool('Obj')]
		const ctx = createToolUseContext({tools})
		const updates = await drain(ToolDispatcher.execute([tu('t1', 'Obj')], ctx))
		const result = updates.find(u => u.kind === 'result') as Extract<ToolUpdate, {kind: 'result'}>
		expect(result.toolResultBlock.content).toContain('"a": 1')
		expect(result.toolResultBlock.content).toContain('"b": "hello"')
	})

	it('resultForAssistant 优先于 data', async () => {
		const tools = [makeProgressingTool('Prog')]
		const ctx = createToolUseContext({tools})
		const updates = await drain(ToolDispatcher.execute([tu('t1', 'Prog')], ctx))
		const result = updates.find(u => u.kind === 'result') as Extract<ToolUpdate, {kind: 'result'}>
		expect(result.toolResultBlock.content).toBe('final-output')
	})

	it('progress 事件被 emit', async () => {
		const tools = [makeProgressingTool('Prog')]
		const ctx = createToolUseContext({tools})
		const updates = await drain(ToolDispatcher.execute([tu('t1', 'Prog')], ctx))
		const progresses = updates.filter(u => u.kind === 'progress')
		expect(progresses).toHaveLength(2)
		expect((progresses[0] as Extract<ToolUpdate, {kind: 'progress'}>).data).toMatchObject({
			type: 'tick',
			step: 1,
		})
	})

	it('abort 已经触发 → 工具不被调用，result 标 aborted', async () => {
		const tools = [makeEchoTool('Echo', 'should-not-run')]
		const ctrl = new AbortController()
		ctrl.abort()
		const ctx = createToolUseContext({tools, abortController: ctrl})
		const updates = await drain(ToolDispatcher.execute([tu('t1', 'Echo')], ctx))
		const result = updates.find(u => u.kind === 'result') as Extract<ToolUpdate, {kind: 'result'}>
		expect(result.toolResultBlock.is_error).toBe(true)
		expect(result.toolResultBlock.content).toContain('aborted')
		// 不应该 emit started
		expect(updates.find(u => u.kind === 'started')).toBeUndefined()
	})

	it('abort 中途 → 后续工具直接标 aborted', async () => {
		const tools = [makeEchoTool('First', 'ok'), makeEchoTool('Second', 'should-not-run')]
		const ctrl = new AbortController()
		const ctx = createToolUseContext({tools, abortController: ctrl})

		// abort after first tool
		const blocks = [tu('t1', 'First'), tu('t2', 'Second')]
		const gen = ToolDispatcher.execute(blocks, ctx)
		const updates: ToolUpdate[] = []
		for await (const u of gen) {
			updates.push(u)
			if (u.kind === 'result' && u.toolUseId === 't1') {
				ctrl.abort()
			}
		}

		const t2Result = updates.find(
			u => u.kind === 'result' && u.toolUseId === 't2',
		) as Extract<ToolUpdate, {kind: 'result'}>
		expect(t2Result.toolResultBlock.is_error).toBe(true)
		expect(t2Result.toolResultBlock.content).toContain('aborted')
	})

	it('运行中 tool 通过 ctx.abortController.signal 自己响应 abort', async () => {
		const tools = [makeAbortableTool('LongTask')]
		const ctrl = new AbortController()
		const ctx = createToolUseContext({tools, abortController: ctrl})
		// 立即 abort：tool 内部 setTimeout 5ms，能监听到
		setTimeout(() => ctrl.abort(), 1)
		const updates = await drain(ToolDispatcher.execute([tu('t1', 'LongTask')], ctx))
		const result = updates.find(u => u.kind === 'result') as Extract<ToolUpdate, {kind: 'result'}>
		expect(result.toolResultBlock.is_error).toBe(true)
		expect(result.toolResultBlock.content).toContain('Aborted by signal')
	})

	it('canUseTool 拒绝 → tool_result is_error，不调 tool', async () => {
		let toolCalled = false
		const blockedTool = {
			name: 'Blocked',
			description: 'd',
			inputJSONSchema: {type: 'object'},
			async call() {
				toolCalled = true
				return {data: 'ok'}
			},
		} as unknown as Tool
		const ctx = createToolUseContext({
			tools: [blockedTool],
			canUseTool: () => ({behavior: 'deny', message: 'policy says no'}),
		})
		const updates = await drain(ToolDispatcher.execute([tu('t1', 'Blocked')], ctx))
		const result = updates.find(u => u.kind === 'result') as Extract<ToolUpdate, {kind: 'result'}>
		expect(result.toolResultBlock.is_error).toBe(true)
		expect(result.toolResultBlock.content).toBe('policy says no')
		expect(toolCalled).toBe(false)
	})

	it('canUseTool 改写 input', async () => {
		let receivedInput: Record<string, unknown> | undefined
		const tool = {
			name: 'X',
			description: 'd',
			inputJSONSchema: {type: 'object'},
			async call(input: Record<string, unknown>) {
				receivedInput = input
				return {data: 'done'}
			},
		} as unknown as Tool
		const ctx = createToolUseContext({
			tools: [tool],
			canUseTool: () => ({behavior: 'allow', updatedInput: {modified: true}}),
		})
		await drain(ToolDispatcher.execute([tu('t1', 'X', {original: true})], ctx))
		expect(receivedInput).toEqual({modified: true})
	})

	it('未知 tool name → tool_result is_error: Unknown tool', async () => {
		const ctx = createToolUseContext({tools: []})
		const updates = await drain(ToolDispatcher.execute([tu('t1', 'NotExist')], ctx))
		const result = updates.find(u => u.kind === 'result') as Extract<ToolUpdate, {kind: 'result'}>
		expect(result.toolResultBlock.is_error).toBe(true)
		expect(result.toolResultBlock.content).toContain('Unknown tool: NotExist')
	})

	it('tool 缺 call() → tool_result is_error', async () => {
		const noCallTool = {
			name: 'NoCall',
			description: 'd',
			inputJSONSchema: {type: 'object'},
		} as unknown as Tool
		const ctx = createToolUseContext({tools: [noCallTool]})
		const updates = await drain(ToolDispatcher.execute([tu('t1', 'NoCall')], ctx))
		const result = updates.find(u => u.kind === 'result') as Extract<ToolUpdate, {kind: 'result'}>
		expect(result.toolResultBlock.is_error).toBe(true)
		expect(result.toolResultBlock.content).toContain('no call() method')
	})

	it('canUseTool 抛错 → 兜底 tool_result is_error', async () => {
		const ctx = createToolUseContext({
			tools: [makeEchoTool('X', 'ok')],
			canUseTool: () => {
				throw new Error('permission system broke')
			},
		})
		const updates = await drain(ToolDispatcher.execute([tu('t1', 'X')], ctx))
		const result = updates.find(u => u.kind === 'result') as Extract<ToolUpdate, {kind: 'result'}>
		expect(result.toolResultBlock.is_error).toBe(true)
		expect(result.toolResultBlock.content).toContain('permission system broke')
	})

	it('kernel.skillRegistry 透传给 tool（Phase B 集成验证）', async () => {
		let receivedKernel: unknown
		const tool = {
			name: 'KernelInspect',
			description: 'd',
			inputJSONSchema: {type: 'object'},
			async call(_input: unknown, ctx: unknown) {
				receivedKernel = (ctx as {kernel?: unknown}).kernel
				return {data: 'ok'}
			},
		} as unknown as Tool
		const fakeSkill = {ID: 'skill-mock'} as never
		const ctx = createToolUseContext({tools: [tool], kernel: {skillRegistry: fakeSkill}})
		await drain(ToolDispatcher.execute([tu('t1', 'KernelInspect')], ctx))
		expect((receivedKernel as {skillRegistry: {ID: string}}).skillRegistry.ID).toBe('skill-mock')
	})
})
