/**
 * CompactionPolicy — 历史消息压缩策略
 *
 * 算法纲要（参考 cc microcompact 思想，简化版）：
 *
 *   shouldCompact(messages, usage) → 是否要压
 *   compact(messages) → 压完的消息（保留最近 N 个 message + 早期 tool_result 替成占位符）
 *
 * 默认 MicroCompaction 策略：
 *   - 触发条件：累计 input_tokens 超过 threshold（默认 150_000）
 *   - 压法：
 *     - 保留最近 N 条 message 不动（默认 N=20）
 *     - 早期 message 中的 tool_result block 内容替换为 "[compacted: <summary>]"
 *     - 不动 user / assistant text（保留语义）
 *     - 不动 thinking block（保留 signature）
 *
 * 设计原则：
 * - 接口 + 默认实现 + 可注入
 * - product 可换更激进的压缩（语义摘要 / token 排序裁剪 / 等）
 * - 不动 user → 保护用户原始 query 不被压
 *
 * 与 cc 行为差异：
 * - 不抄 cc 的 cached_microcompact 优化（按 tool_use_id 缓存）— 简化为直接替换
 * - 不抄 cc 的 snipCompactIfNeeded（裁剪整段 turn，更激进）
 * - 不抄 cc 的 autocompact 业务调度（用户层决策）
 * - 不抄 cc 的 contentReplacementState 持久化（per-session 内存即可）
 */

import type {Message, ContentItem} from '../../types/message.js'
import type {UsageSnapshot} from '../types.js'

export interface CompactionContext {
	/** 当前累计 usage（可选；用于触发判定）。 */
	usage?: UsageSnapshot
}

export interface CompactionResult {
	messages: Message[]
	/** 估计释放的 token 数（粗略）。 */
	tokensFreed: number
	/** 这一次压了多少条 message。 */
	messagesCompacted: number
}

export interface CompactionPolicy {
	shouldCompact(messages: Message[], context: CompactionContext): boolean
	compact(messages: Message[]): CompactionResult
}

// ============================================================
// 默认 MicroCompaction
// ============================================================

export interface MicroCompactionOptions {
	/** 累计 input_tokens 超过阈值时触发压缩。默认 150_000。 */
	tokenThreshold?: number
	/** 保留最近多少条 message 不压。默认 20。 */
	preserveRecent?: number
	/** 替换 tool_result 内容时的占位符模板。 */
	placeholder?: (originalLength: number, toolUseId: string) => string
}

export class MicroCompaction implements CompactionPolicy {
	private readonly tokenThreshold: number
	private readonly preserveRecent: number
	private readonly placeholder: (originalLength: number, toolUseId: string) => string

	constructor(options: MicroCompactionOptions = {}) {
		this.tokenThreshold = options.tokenThreshold ?? 150_000
		this.preserveRecent = options.preserveRecent ?? 20
		this.placeholder =
			options.placeholder ??
			((len, id) => `[compacted: tool_result for ${id} (${len} chars omitted)]`)
	}

	shouldCompact(messages: Message[], context: CompactionContext): boolean {
		// 没有 usage 信息时不压
		if (!context.usage) return false
		// 消息数 < 保留数 × 1.5 时也不压（不值得）
		if (messages.length < Math.ceil(this.preserveRecent * 1.5)) return false
		return context.usage.input_tokens >= this.tokenThreshold
	}

	compact(messages: Message[]): CompactionResult {
		const cutoff = Math.max(0, messages.length - this.preserveRecent)
		if (cutoff === 0) {
			return {messages, tokensFreed: 0, messagesCompacted: 0}
		}

		let tokensFreed = 0
		let messagesCompacted = 0
		const out: Message[] = []
		for (let i = 0; i < messages.length; i++) {
			if (i >= cutoff) {
				out.push(messages[i]!)
				continue
			}
			const compacted = this.compactSingleMessage(messages[i]!)
			out.push(compacted.message)
			if (compacted.charsRemoved > 0) {
				// 粗估：1 token ≈ 4 chars（OpenAI rule of thumb）
				tokensFreed += Math.floor(compacted.charsRemoved / 4)
				messagesCompacted++
			}
		}

		return {messages: out, tokensFreed, messagesCompacted}
	}

	private compactSingleMessage(msg: Message): {
		message: Message
		charsRemoved: number
	} {
		const inner = msg.message
		if (!inner) return {message: msg, charsRemoved: 0}
		const content = inner.content
		if (!Array.isArray(content)) return {message: msg, charsRemoved: 0}

		let charsRemoved = 0
		const newContent: ContentItem[] = content.map(b => {
			if (typeof b !== 'object' || b === null) return b
			const block = b as ContentItem & {
				type?: string
				tool_use_id?: string
				content?: unknown
			}
			if (block.type !== 'tool_result') return b
			const original = block.content
			if (typeof original !== 'string' || original.length === 0) return b

			// 已经是占位符 → 跳过
			if (original.startsWith('[compacted:')) return b

			const newText = this.placeholder(original.length, block.tool_use_id ?? '<unknown>')
			charsRemoved += original.length - newText.length
			return {
				...block,
				content: newText,
			} as unknown as ContentItem
		})

		if (charsRemoved === 0) return {message: msg, charsRemoved: 0}
		return {
			message: {
				...msg,
				message: {
					...inner,
					content: newContent,
				},
			},
			charsRemoved,
		}
	}
}

/** NoOp policy：永不压缩。 */
export class NoOpCompactionPolicy implements CompactionPolicy {
	shouldCompact(): boolean {
		return false
	}
	compact(messages: Message[]): CompactionResult {
		return {messages, tokensFreed: 0, messagesCompacted: 0}
	}
}
