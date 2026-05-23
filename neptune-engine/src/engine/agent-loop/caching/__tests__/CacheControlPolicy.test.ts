/**
 * CacheControlPolicy 单测
 */

import {describe, expect, it} from 'bun:test'
import {DefaultCachePolicy, NoOpCachePolicy} from '../CacheControlPolicy.js'
import type {
	BetaMessageParam,
	BetaTextBlockParam,
	BetaToolUnion,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'

const userText = (text: string): BetaMessageParam => ({role: 'user', content: text})
const userArray = (blocks: unknown[]): BetaMessageParam => ({
	role: 'user',
	content: blocks as BetaMessageParam['content'],
})
const assistantText = (text: string): BetaMessageParam => ({
	role: 'assistant',
	content: text,
})

describe('DefaultCachePolicy', () => {
	it('system 字符串 → 转数组 + 打 cache_control', () => {
		const p = new DefaultCachePolicy()
		const out = p.plan({
			messages: [userText('hi')],
			system: 'you are X',
		})
		expect(Array.isArray(out.system)).toBe(true)
		const arr = out.system as BetaTextBlockParam[]
		expect(arr).toHaveLength(1)
		expect(arr[0]).toMatchObject({
			type: 'text',
			text: 'you are X',
			cache_control: {type: 'ephemeral'},
		})
	})

	it('system 数组 → 末块打 cache_control', () => {
		const p = new DefaultCachePolicy()
		const out = p.plan({
			messages: [userText('hi')],
			system: [
				{type: 'text', text: 'first'},
				{type: 'text', text: 'second'},
			],
		})
		const arr = out.system as BetaTextBlockParam[]
		expect((arr[0] as {cache_control?: unknown}).cache_control).toBeUndefined()
		expect((arr[1] as {cache_control?: unknown}).cache_control).toEqual({type: 'ephemeral'})
	})

	it('tools 末块打 cache_control', () => {
		const p = new DefaultCachePolicy()
		const tools = [
			{name: 'A', description: 'd', input_schema: {type: 'object'}},
			{name: 'B', description: 'd', input_schema: {type: 'object'}},
		] as unknown as BetaToolUnion[]
		const out = p.plan({
			messages: [userText('hi')],
			tools,
		})
		const newTools = out.tools as Array<BetaToolUnion & {cache_control?: unknown}>
		expect(newTools[0]?.cache_control).toBeUndefined()
		expect(newTools[1]?.cache_control).toEqual({type: 'ephemeral'})
	})

	it('messages 最末 user 字符串 → 转数组 + 打 cache_control', () => {
		const p = new DefaultCachePolicy()
		const out = p.plan({
			messages: [userText('first'), assistantText('reply'), userText('latest')],
		})
		expect(out.messages).toHaveLength(3)
		expect(out.messages[0]?.content).toBe('first')
		expect(out.messages[1]?.content).toBe('reply')
		// 最末 user 转数组 + cache_control
		const lastUser = out.messages[2]
		expect(Array.isArray(lastUser?.content)).toBe(true)
		const blocks = lastUser?.content as Array<{cache_control?: unknown}>
		expect(blocks[blocks.length - 1]?.cache_control).toEqual({type: 'ephemeral'})
	})

	it('messages 最末 user 数组 → 最末 block 打 cache_control', () => {
		const p = new DefaultCachePolicy()
		const out = p.plan({
			messages: [
				userArray([
					{type: 'text', text: 'a'},
					{type: 'text', text: 'b'},
				]),
			],
		})
		const blocks = out.messages[0]?.content as Array<{
			cache_control?: unknown
			text?: string
		}>
		expect(blocks).toHaveLength(2)
		expect(blocks[0]?.cache_control).toBeUndefined()
		expect(blocks[1]?.cache_control).toEqual({type: 'ephemeral'})
	})

	it('thinking block 不打 cache_control（cc 行为一致）', () => {
		const p = new DefaultCachePolicy()
		const out = p.plan({
			messages: [
				userArray([
					{type: 'text', text: 'a'},
					{type: 'thinking', thinking: 't', signature: 'sig'},
				]),
			],
		})
		// 因为最末是 thinking → 整条 message 不修改
		const blocks = out.messages[0]?.content as Array<{cache_control?: unknown}>
		expect(blocks[1]?.cache_control).toBeUndefined()
	})

	it('无 user message → messages 不修改', () => {
		const p = new DefaultCachePolicy()
		const out = p.plan({
			messages: [assistantText('hello')],
		})
		expect(out.messages[0]).toBe(out.messages[0])
		expect(out.messages[0]?.content).toBe('hello')
	})

	it('immutable：不 mutate 输入数组', () => {
		const p = new DefaultCachePolicy()
		const original = [userText('hi')]
		const orig0Content = original[0]!.content
		p.plan({messages: original})
		expect(original[0]?.content).toBe(orig0Content) // 原数据不变
	})

	it('注入自定义 TTL', () => {
		const p = new DefaultCachePolicy({type: 'ephemeral', ttl: '1h'})
		const out = p.plan({messages: [userText('hi')], system: 'sys'})
		const arr = out.system as Array<{cache_control: {ttl: string}}>
		expect(arr[0]?.cache_control.ttl).toBe('1h')
	})
})

describe('NoOpCachePolicy', () => {
	it('不修改任何字段', () => {
		const p = new NoOpCachePolicy()
		const messages = [userText('hi')]
		const out = p.plan({messages, system: 'sys', tools: [] as unknown as BetaToolUnion[]})
		expect(out.messages).toBe(messages)
		expect(out.system).toBe('sys')
	})
})
