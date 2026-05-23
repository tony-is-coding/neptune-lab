/**
 * HookSurface 单测
 */

import {describe, expect, it} from 'bun:test'
import {HookSurface} from '../HookSurface.js'
import type {AssistantMessage} from '../../../types/message.js'
import {randomUUID} from 'crypto'

const fakeAssistant: AssistantMessage = {
	type: 'assistant',
	uuid: randomUUID() as unknown as AssistantMessage['uuid'],
	message: {role: 'assistant', content: 'hi'},
}

describe('HookSurface', () => {
	it('初始无 hook', () => {
		const h = new HookSurface()
		expect(h.count('preStream')).toBe(0)
		expect(h.count('postStream')).toBe(0)
	})

	it('register + 顺序执行多个 preStream hook', async () => {
		const h = new HookSurface()
		const log: number[] = []
		h.register('preStream', async () => {
			log.push(1)
		})
		h.register('preStream', async () => {
			log.push(2)
		})
		await h.runPreStream({turn: 1, messageCount: 1})
		expect(log).toEqual([1, 2])
	})

	it('preStream hook 抛错 → 调 onError，loop 继续', async () => {
		const h = new HookSurface()
		const errors: Error[] = []
		h.register('onError', info => {
			errors.push(info.error)
		})
		h.register('preStream', () => {
			throw new Error('preStream broke')
		})
		const reached: number[] = []
		h.register('preStream', () => {
			reached.push(1)
		})
		await h.runPreStream({turn: 1, messageCount: 1})
		expect(errors).toHaveLength(1)
		expect(errors[0]?.message).toBe('preStream broke')
		expect(reached).toEqual([1]) // 第二个 hook 仍执行
	})

	it('postStream hook 接收 assistant message', async () => {
		const h = new HookSurface()
		let received: AssistantMessage | undefined
		h.register('postStream', info => {
			received = info.message
		})
		await h.runPostStream({turn: 1, message: fakeAssistant})
		expect(received).toBe(fakeAssistant)
	})

	it('preTool hook 返回 {allow: false} → 短路返回 reason', async () => {
		const h = new HookSurface()
		h.register('preTool', () => ({allow: false, reason: 'blocked'}))
		const decision = await h.runPreTool({
			toolUse: {type: 'tool_use', id: 't1', name: 'X', input: {}},
			context: {} as never,
		})
		expect(decision).toEqual({allow: false, reason: 'blocked'})
	})

	it('preTool 多个 hook 中第一个 deny → 短路', async () => {
		const h = new HookSurface()
		const calls: string[] = []
		h.register('preTool', () => {
			calls.push('first')
			return {allow: false, reason: 'first denied'}
		})
		h.register('preTool', () => {
			calls.push('second')
			return {allow: true}
		})
		const decision = await h.runPreTool({
			toolUse: {type: 'tool_use', id: 't1', name: 'X', input: {}},
			context: {} as never,
		})
		expect(decision.allow).toBe(false)
		expect(calls).toEqual(['first'])
	})

	it('preTool 全部 allow → 返回 allow: true', async () => {
		const h = new HookSurface()
		h.register('preTool', () => ({allow: true}))
		h.register('preTool', () => undefined) // void 也算 allow
		const decision = await h.runPreTool({
			toolUse: {type: 'tool_use', id: 't1', name: 'X', input: {}},
			context: {} as never,
		})
		expect(decision.allow).toBe(true)
	})

	it('preTool hook 抛错 → 调 onError，视为不阻拦', async () => {
		const h = new HookSurface()
		const errors: Error[] = []
		h.register('onError', info => {
			errors.push(info.error)
		})
		h.register('preTool', () => {
			throw new Error('pre broke')
		})
		const decision = await h.runPreTool({
			toolUse: {type: 'tool_use', id: 't1', name: 'X', input: {}},
			context: {} as never,
		})
		expect(decision.allow).toBe(true)
		expect(errors).toHaveLength(1)
	})

	it('postTool hook 接收 toolUse + toolResult', async () => {
		const h = new HookSurface()
		let receivedId: string | undefined
		h.register('postTool', info => {
			receivedId = info.toolResult.tool_use_id
		})
		await h.runPostTool({
			toolUse: {type: 'tool_use', id: 't1', name: 'X', input: {}},
			toolResult: {type: 'tool_result', tool_use_id: 't1', content: 'ok'},
			context: {} as never,
		})
		expect(receivedId).toBe('t1')
	})

	it('onError hook 并发派发，单个失败不影响其他', async () => {
		const h = new HookSurface()
		const reached: number[] = []
		h.register('onError', () => {
			throw new Error('inner-error') // 静默吞
		})
		h.register('onError', () => {
			reached.push(2)
		})
		await h.runOnError({phase: 'stream', error: new Error('outer')})
		expect(reached).toEqual([2])
	})

	it('initial registry 注入', () => {
		const h = new HookSurface({
			preStream: [() => undefined],
			postTool: [() => undefined, () => undefined],
		})
		expect(h.count('preStream')).toBe(1)
		expect(h.count('postTool')).toBe(2)
	})
})
