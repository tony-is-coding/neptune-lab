/**
 * messageFilters — substrate 内 resume 前的 messages 清理工具
 *
 * 设计目的（Stage B1.2，cc resumeAgent.ts:14-19 已证明的清理流水线）：
 * - resume sub-agent / agent 主循环时，需要从持久化 messages 重建对话历史
 * - cc 实测证明：直接送给 LLM 的话，半截 tool_use / 孤儿 thinking / 空白
 *   assistant 都会被 API 拒（`tool_use ids must be matched` /
 *   `thinking blocks need signature` 等）
 * - 这三个 filter 是 cc 经过线上反复迭代得出的最小必需清理集
 *
 * 与 cc 行为对齐（语义同 cc-shim/misc.ts 的同名函数）：
 * - filterUnresolvedToolUses: assistant 含 tool_use 但下一条 user 没有匹配的
 *   tool_result → 删除该 assistant（API 会拒）
 * - filterOrphanedThinkingOnlyMessages: assistant 仅含 thinking block 没有
 *   text/tool_use → 删除该 assistant（thinking 必须 attach 在有 output 的
 *   message 上，孤儿 thinking 会丢 signature）
 * - filterWhitespaceOnlyAssistantMessages: assistant 仅含空白文本 → 删除
 *   （API 会拒空 message）
 *
 * 设计原则：
 * - 纯函数，不修改输入
 * - 三 filter 应组合使用：filterWhitespaceOnly(filterOrphanedThinking(filterUnresolvedToolUses(messages)))
 * - 0 外部依赖
 */

import type {Message, ContentItem} from '../types/message.js'

interface ToolUseBlock {
	type: 'tool_use'
	id: string
	[key: string]: unknown
}

interface ToolResultBlock {
	type: 'tool_result'
	tool_use_id: string
	[key: string]: unknown
}

interface TextBlock {
	type: 'text'
	text: string
	[key: string]: unknown
}

interface ThinkingBlock {
	type: 'thinking'
	[key: string]: unknown
}

function isToolUse(block: ContentItem): block is ToolUseBlock & ContentItem {
	return (block as {type?: string}).type === 'tool_use'
}

function isToolResult(block: ContentItem): block is ToolResultBlock & ContentItem {
	return (block as {type?: string}).type === 'tool_result'
}

function isText(block: ContentItem): block is TextBlock & ContentItem {
	return (block as {type?: string}).type === 'text'
}

function isThinking(block: ContentItem): block is ThinkingBlock & ContentItem {
	return (block as {type?: string}).type === 'thinking'
}

/** 取出 message 内的 content blocks（统一成数组）。 */
function getContentBlocks(message: Message): ContentItem[] {
	const c = message.message?.content
	if (Array.isArray(c)) return c as ContentItem[]
	return []
}

/**
 * filterUnresolvedToolUses
 *
 * 删除所有 assistant 消息中包含的 tool_use 在后续 messages 里没有匹配
 * tool_result 的情况。
 *
 * 算法：
 * 1. 收集所有 user/tool_result 提供的 tool_use_id 集合
 * 2. 对每个 assistant 消息，检查它含的所有 tool_use.id 是否都在集合中
 * 3. 任意一个不在 → 整条 assistant 消息删除
 *
 * cc 行为对齐：assistant 半截退出（pause_turn / 流断）后续的 tool_use
 * 没人 resolve，API 拒。
 */
export function filterUnresolvedToolUses(
	messages: readonly Message[],
): Message[] {
	const resolvedToolUseIds = new Set<string>()
	for (const m of messages) {
		if (m.type !== 'user') continue
		for (const block of getContentBlocks(m)) {
			if (isToolResult(block)) {
				resolvedToolUseIds.add(block.tool_use_id)
			}
		}
	}

	return messages.filter(m => {
		if (m.type !== 'assistant') return true
		const blocks = getContentBlocks(m)
		const toolUses = blocks.filter(isToolUse)
		if (toolUses.length === 0) return true
		// 所有 tool_use 必须都被 resolve
		return toolUses.every(tu => resolvedToolUseIds.has(tu.id))
	})
}

/**
 * filterOrphanedThinkingOnlyMessages
 *
 * 删除所有 assistant 消息：仅包含 thinking blocks，没有 text / tool_use 等
 * 实际产出 block。
 *
 * cc 行为对齐：thinking block 必须 attach 在有实际 output 的 assistant
 * message 上；resume 后 thinking block 的 signature 已失效，单独发会被拒。
 */
export function filterOrphanedThinkingOnlyMessages(
	messages: readonly Message[],
): Message[] {
	return messages.filter(m => {
		if (m.type !== 'assistant') return true
		const blocks = getContentBlocks(m)
		if (blocks.length === 0) return true // 空 content 留给 whitespace filter
		const hasNonThinking = blocks.some(b => !isThinking(b))
		return hasNonThinking
	})
}

/**
 * filterWhitespaceOnlyAssistantMessages
 *
 * 删除所有 assistant 消息：仅包含空白文本（text block 内全是 whitespace），
 * 没有其他类型的 block。
 *
 * cc 行为对齐：API 拒空 assistant message；纯 whitespace 也被视为空。
 */
export function filterWhitespaceOnlyAssistantMessages(
	messages: readonly Message[],
): Message[] {
	return messages.filter(m => {
		if (m.type !== 'assistant') return true
		const blocks = getContentBlocks(m)
		if (blocks.length === 0) return false // 空 content 删除
		// 是否所有 block 都是 text 且都是 whitespace
		const allWhitespaceText = blocks.every(
			b => isText(b) && b.text.trim().length === 0,
		)
		return !allWhitespaceText
	})
}

/**
 * cleanupForResume — 三 filter 标准组合，resume 前必跑。
 */
export function cleanupForResume(messages: readonly Message[]): Message[] {
	return filterWhitespaceOnlyAssistantMessages(
		filterOrphanedThinkingOnlyMessages(
			filterUnresolvedToolUses(messages),
		),
	)
}
