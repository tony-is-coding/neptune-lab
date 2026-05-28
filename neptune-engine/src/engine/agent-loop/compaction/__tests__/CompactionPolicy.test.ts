/**
 * CompactionPolicy 单测
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import {MicroCompaction, NoOpCompactionPolicy} from '../CompactionPolicy.js'
import type {Message, ContentItem} from '../../../types/message.js'
import type {UsageSnapshot} from '../../types.js'

const u = (input: number): UsageSnapshot => ({
	input_tokens: input,
	output_tokens: 0,
	cache_creation_input_tokens: 0,
	cache_read_input_tokens: 0,
})

function userTool(toolUseId: string, content: string): Message {
	return {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {
			role: 'user',
			content: [
				{
					type: 'tool_result',
					tool_use_id: toolUseId,
					content,
				},
			] as unknown as ContentItem[],
		},
	}
}

function userText(text: string): Message {
	return {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'user', content: text},
	}
}

function assistantText(text: string): Message {
	return {
		type: 'assistant',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'assistant', content: text},
	}
}

describe('MicroCompaction.shouldCompact', () => {
	it('无 usage → false', () => {
		const c = new MicroCompaction()
		expect(c.shouldCompact([userText('hi')], {})).toBe(false)
	})

	it('低于阈值 → false', () => {
		const c = new MicroCompaction({tokenThreshold: 100_000})
		expect(c.shouldCompact([userText('hi')], {usage: u(50_000)})).toBe(false)
	})

	it('高于阈值但 message 太少 → false', () => {
		const c = new MicroCompaction({tokenThreshold: 100_000, preserveRecent: 20})
		expect(c.shouldCompact([userText('hi')], {usage: u(150_000)})).toBe(false)
	})

	it('高于阈值且 message 足够多 → true', () => {
		const c = new MicroCompaction({tokenThreshold: 100_000, preserveRecent: 5})
		const msgs = Array.from({length: 10}, () => userText('hi'))
		expect(c.shouldCompact(msgs, {usage: u(150_000)})).toBe(true)
	})
})

describe('MicroCompaction.compact', () => {
	it('保留最近 N 条不动，早期 tool_result 替成占位符', () => {
		const c = new MicroCompaction({preserveRecent: 3})
		const msgs = [
			userTool('tu_1', 'A'.repeat(1000)),
			userTool('tu_2', 'B'.repeat(1000)),
			userTool('tu_3', 'C'.repeat(1000)),
			userTool('tu_4', 'D'.repeat(1000)),
			userTool('tu_5', 'E'.repeat(1000)),
		]
		const result = c.compact(msgs)
		expect(result.messages).toHaveLength(5)
		expect(result.messagesCompacted).toBe(2)

		// 前 2 条被压缩
		const block0 = (result.messages[0]?.message?.content as ContentItem[])[0] as {
			content: string
		}
		expect(block0.content).toContain('[compacted:')
		expect(block0.content).toContain('tu_1')

		// 后 3 条不动
		const block4 = (result.messages[4]?.message?.content as ContentItem[])[0] as {
			content: string
		}
		expect(block4.content).toBe('E'.repeat(1000))
	})

	it('text-only 消息不被压缩', () => {
		const c = new MicroCompaction({preserveRecent: 1})
		const msgs = [userText('important user query'), assistantText('hi'), userText('latest')]
		const result = c.compact(msgs)
		expect(result.messagesCompacted).toBe(0)
		expect(result.messages[0]?.message?.content).toBe('important user query')
	})

	it('已 compacted 的 tool_result 不再压', () => {
		const c = new MicroCompaction({preserveRecent: 1})
		const msgs = [
			userTool('tu_1', '[compacted: already done]'),
			userText('latest'),
		]
		const result = c.compact(msgs)
		expect(result.messagesCompacted).toBe(0)
	})

	it('tokensFreed 估算', () => {
		const c = new MicroCompaction({preserveRecent: 0})
		const msgs = [userTool('tu_1', 'X'.repeat(4000))] // 4000 chars ≈ 1000 tokens
		const result = c.compact(msgs)
		expect(result.tokensFreed).toBeGreaterThan(800) // 留 buffer，因占位符也占字符
	})

	it('不 mutate 输入', () => {
		const c = new MicroCompaction({preserveRecent: 0})
		const original = userTool('tu_1', 'A'.repeat(1000))
		c.compact([original])
		const block = (original.message?.content as ContentItem[])[0] as {content: string}
		expect(block.content).toBe('A'.repeat(1000))
	})

	it('cutoff = 0 → 不动消息', () => {
		const c = new MicroCompaction({preserveRecent: 100})
		const msgs = [userTool('tu_1', 'A'.repeat(1000))]
		const result = c.compact(msgs)
		expect(result.messagesCompacted).toBe(0)
	})

	it('自定义 placeholder', () => {
		const c = new MicroCompaction({
			preserveRecent: 0,
			placeholder: (len, id) => `<<${id}:${len}>>`,
		})
		const msgs = [userTool('tu_1', 'A'.repeat(1000))]
		const result = c.compact(msgs)
		const block = (result.messages[0]?.message?.content as ContentItem[])[0] as {
			content: string
		}
		expect(block.content).toBe('<<tu_1:1000>>')
	})
})

describe('NoOpCompactionPolicy', () => {
	it('shouldCompact 永远 false', () => {
		const p = new NoOpCompactionPolicy()
		expect(p.shouldCompact([], {usage: u(999_999_999)})).toBe(false)
	})
	it('compact 不动消息', () => {
		const p = new NoOpCompactionPolicy()
		const msgs = [userText('hi')]
		const result = p.compact(msgs)
		expect(result.messages).toBe(msgs)
		expect(result.messagesCompacted).toBe(0)
	})
})
