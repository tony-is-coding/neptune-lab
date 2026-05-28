/**
 * messageFilters.test.ts — Stage B1.2 单测
 *
 * 验证 cc resumeAgent.ts:71-75 三 filter 流水线在 substrate 内的等价行为。
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import type {Message, ContentItem} from '../../types/message.js'
import {
	filterUnresolvedToolUses,
	filterOrphanedThinkingOnlyMessages,
	filterWhitespaceOnlyAssistantMessages,
	cleanupForResume,
} from '../messageFilters.js'

function userMsg(content: string | ContentItem[]): Message {
	return {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'user', content},
	}
}

function assistantMsg(content: ContentItem[]): Message {
	return {
		type: 'assistant',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'assistant', content},
	}
}

function toolUse(id: string, name = 'Bash'): ContentItem {
	return {type: 'tool_use', id, name, input: {}} as ContentItem
}

function toolResult(toolUseId: string, content = 'ok'): ContentItem {
	return {
		type: 'tool_result',
		tool_use_id: toolUseId,
		content,
	} as ContentItem
}

function textBlock(text: string): ContentItem {
	return {type: 'text', text} as ContentItem
}

function thinkingBlock(thinking = 'reasoning...'): ContentItem {
	return {type: 'thinking', thinking, signature: 'sig'} as ContentItem
}

describe('filterUnresolvedToolUses', () => {
	it('保留所有 tool_use 都被 resolve 的 assistant', () => {
		const msgs = [
			userMsg('start'),
			assistantMsg([toolUse('tu1')]),
			userMsg([toolResult('tu1')]),
			assistantMsg([textBlock('done')]),
		]
		const out = filterUnresolvedToolUses(msgs)
		expect(out).toHaveLength(4)
	})

	it('删除半截 tool_use 的 assistant（无 tool_result 匹配）', () => {
		const msgs = [
			userMsg('start'),
			assistantMsg([toolUse('tu_unresolved')]),
			// 没有 user message 含 tu_unresolved 的 tool_result
		]
		const out = filterUnresolvedToolUses(msgs)
		// assistant 应被删，user 留
		expect(out).toHaveLength(1)
		expect(out[0]?.type).toBe('user')
	})

	it('一个 assistant 内多个 tool_use，任一未 resolve → 整条删', () => {
		const msgs = [
			userMsg('q'),
			assistantMsg([toolUse('tu1'), toolUse('tu2')]),
			userMsg([toolResult('tu1')]), // tu2 没 resolve
		]
		const out = filterUnresolvedToolUses(msgs)
		// assistant 被删
		expect(out.filter(m => m.type === 'assistant')).toHaveLength(0)
	})

	it('纯文本 assistant 不受影响', () => {
		const msgs = [userMsg('q'), assistantMsg([textBlock('hi')])]
		expect(filterUnresolvedToolUses(msgs)).toHaveLength(2)
	})

	it('user 消息任何情况都不被过滤', () => {
		const msgs = [userMsg('a'), userMsg('b'), userMsg('c')]
		expect(filterUnresolvedToolUses(msgs)).toHaveLength(3)
	})
})

describe('filterOrphanedThinkingOnlyMessages', () => {
	it('保留有 text/tool_use 的 assistant（有 thinking 也行）', () => {
		const msgs = [
			assistantMsg([thinkingBlock(), textBlock('answer')]),
			assistantMsg([thinkingBlock(), toolUse('tu1')]),
		]
		expect(filterOrphanedThinkingOnlyMessages(msgs)).toHaveLength(2)
	})

	it('删除仅含 thinking 的孤儿 assistant', () => {
		const msgs = [
			userMsg('q'),
			assistantMsg([thinkingBlock(), thinkingBlock()]),
		]
		const out = filterOrphanedThinkingOnlyMessages(msgs)
		expect(out).toHaveLength(1)
		expect(out[0]?.type).toBe('user')
	})

	it('空 content 数组的 assistant 留给 whitespace filter（这里保留）', () => {
		const msgs = [assistantMsg([])]
		expect(filterOrphanedThinkingOnlyMessages(msgs)).toHaveLength(1)
	})
})

describe('filterWhitespaceOnlyAssistantMessages', () => {
	it('删除空 content 的 assistant', () => {
		const msgs = [userMsg('q'), assistantMsg([])]
		const out = filterWhitespaceOnlyAssistantMessages(msgs)
		expect(out).toHaveLength(1)
		expect(out[0]?.type).toBe('user')
	})

	it('删除全 whitespace text 的 assistant', () => {
		const msgs = [
			userMsg('q'),
			assistantMsg([textBlock('   '), textBlock('\n\t')]),
		]
		const out = filterWhitespaceOnlyAssistantMessages(msgs)
		expect(out).toHaveLength(1)
	})

	it('保留含非空 text 的 assistant', () => {
		const msgs = [
			userMsg('q'),
			assistantMsg([textBlock('   '), textBlock('answer here')]),
		]
		expect(filterWhitespaceOnlyAssistantMessages(msgs)).toHaveLength(2)
	})

	it('保留含 tool_use 的 assistant（即使无 text）', () => {
		const msgs = [assistantMsg([toolUse('tu1')])]
		expect(filterWhitespaceOnlyAssistantMessages(msgs)).toHaveLength(1)
	})

	it('user 消息不受影响（即使空）', () => {
		const msgs = [userMsg(''), userMsg('   ')]
		expect(filterWhitespaceOnlyAssistantMessages(msgs)).toHaveLength(2)
	})
})

describe('cleanupForResume — 三 filter 组合', () => {
	it('完整流水线：删半截 tool_use + 孤儿 thinking + whitespace assistant', () => {
		const msgs = [
			userMsg('start'),
			// keeper: 完整对话
			assistantMsg([textBlock('using bash'), toolUse('tu_ok')]),
			userMsg([toolResult('tu_ok', 'output')]),
			// drop: 半截 tool_use
			assistantMsg([toolUse('tu_orphan')]),
			// drop: 孤儿 thinking
			assistantMsg([thinkingBlock()]),
			// drop: whitespace
			assistantMsg([textBlock('   '), textBlock('\n')]),
			// keeper: 正常结尾
			assistantMsg([textBlock('done')]),
		]
		const out = cleanupForResume(msgs)
		// 留：user(start) + assistant(bash + tu_ok) + user(tool_result) + assistant(done) = 4
		expect(out).toHaveLength(4)
		expect(out[0]?.type).toBe('user')
		expect(out[1]?.type).toBe('assistant')
		expect(out[2]?.type).toBe('user')
		expect(out[3]?.type).toBe('assistant')
	})

	it('原 messages 不被 mutate（纯函数）', () => {
		const msgs = [
			userMsg('q'),
			assistantMsg([toolUse('tu_orphan')]),
		]
		const before = msgs.length
		cleanupForResume(msgs)
		expect(msgs).toHaveLength(before)
	})

	it('空数组返回空数组', () => {
		expect(cleanupForResume([])).toEqual([])
	})

	it('全干净的 messages 不变', () => {
		const msgs = [
			userMsg('q'),
			assistantMsg([textBlock('answer')]),
		]
		expect(cleanupForResume(msgs)).toHaveLength(2)
	})
})
