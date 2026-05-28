/**
 * CacheControlPolicy — Anthropic prompt caching breakpoint 策略
 *
 * 算法纲要（参考 cc claude.ts:3134-3284 addCacheBreakpoints 简化版）：
 *
 *   plan(input):
 *     - 在 system prompt 末尾打 1 个 ephemeral cache（如果有 system）
 *     - 在 tools 末尾打 1 个 ephemeral cache（如果有 tools）
 *     - 在最末 user message 打 1 个 ephemeral cache（rolling）
 *     - 总共最多 4 个 breakpoint（Anthropic API 上限）
 *
 * 设计原则：
 * - 接口 + 默认实现 + 可注入
 * - 默认 policy 在 95% 场景够用（覆盖 system + tools + 最末 user）
 * - product 可换更精细的策略（按 querySource 区分 / 1h cache / 等）
 *
 * 与 cc 行为差异：
 * - 不抄 querySource 分支（cc 按 querySource 决定 1h vs 5m）
 * - 不抄 cache_edits 业务（cc 内部状态）
 * - 不抄 connector_text cache 跳过逻辑
 * - 不抄 should1hCacheTTL（默认只用 5m ephemeral）
 */

import type {
	BetaContentBlockParam,
	BetaMessageParam,
	BetaTextBlockParam,
	BetaToolUnion,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'

// ============================================================
// 公开类型
// ============================================================

/** Anthropic 支持的 cache_control 形态。 */
export interface CacheControl {
	type: 'ephemeral'
	/** TTL 标记，默认 '5m'。'1h' 需要 beta flag。 */
	ttl?: '5m' | '1h'
}

export interface CachePlanInput {
	/** 已序列化的 message params（caller 已经 normalize 完成）。 */
	messages: BetaMessageParam[]
	system?: string | BetaTextBlockParam[]
	tools?: BetaToolUnion[]
}

export interface CachePlanOutput {
	/** 修改后的 system（含 cache_control）。 */
	system?: string | BetaTextBlockParam[]
	/** 修改后的 messages（部分 block 含 cache_control）。 */
	messages: BetaMessageParam[]
	/** 修改后的 tools（最末 tool 含 cache_control）。 */
	tools?: BetaToolUnion[]
}

export interface CacheControlPolicy {
	/**
	 * 给 messages / system / tools 打 cache_control breakpoint。
	 *
	 * 实现要 immutable —— 不能 mutate 输入。
	 */
	plan(input: CachePlanInput): CachePlanOutput
}

// ============================================================
// 默认 policy
// ============================================================

const DEFAULT_CACHE: CacheControl = {type: 'ephemeral'}

export class DefaultCachePolicy implements CacheControlPolicy {
	constructor(private readonly cache: CacheControl = DEFAULT_CACHE) {}

	plan(input: CachePlanInput): CachePlanOutput {
		const out: CachePlanOutput = {
			messages: this.markLastUserMessage(input.messages),
		}
		if (input.system !== undefined) {
			out.system = this.markSystem(input.system)
		}
		if (input.tools && input.tools.length > 0) {
			out.tools = this.markLastTool(input.tools)
		}
		return out
	}

	/**
	 * system: 字符串 → 转 [{type:'text', text, cache_control}]；
	 *         数组 → 在最后一个 text block 上打 cache_control。
	 */
	private markSystem(
		system: string | BetaTextBlockParam[],
	): string | BetaTextBlockParam[] {
		if (typeof system === 'string') {
			return [
				{
					type: 'text',
					text: system,
					cache_control: this.cache,
				} as BetaTextBlockParam,
			]
		}
		if (system.length === 0) return system
		const copy = system.map(b => ({...b}))
		;(copy[copy.length - 1] as BetaTextBlockParam & {
			cache_control?: CacheControl
		}).cache_control = this.cache
		return copy
	}

	/**
	 * tools: 在最后一个 tool 上打 cache_control。
	 */
	private markLastTool(tools: BetaToolUnion[]): BetaToolUnion[] {
		const copy = tools.map(t => ({...t}))
		;(copy[copy.length - 1] as BetaToolUnion & {
			cache_control?: CacheControl
		}).cache_control = this.cache
		return copy
	}

	/**
	 * messages: 找最末 user message，在它最后一个 content block 上打 cache_control。
	 *           rolling cache 的核心：每轮都打在最新 user message，让 prefix 命中。
	 */
	private markLastUserMessage(messages: BetaMessageParam[]): BetaMessageParam[] {
		// 找最末 user message
		let lastUserIdx = -1
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i]?.role === 'user') {
				lastUserIdx = i
				break
			}
		}
		if (lastUserIdx < 0) return messages

		const copy: BetaMessageParam[] = messages.map((m, i) => {
			if (i !== lastUserIdx) return m
			return this.applyCacheToMessage(m)
		})
		return copy
	}

	private applyCacheToMessage(message: BetaMessageParam): BetaMessageParam {
		const content = message.content
		if (typeof content === 'string') {
			// 字符串 content → 转数组形态
			return {
				role: message.role,
				content: [
					{
						type: 'text',
						text: content,
						cache_control: this.cache,
					} as BetaContentBlockParam,
				],
			}
		}
		if (!Array.isArray(content) || content.length === 0) return message
		const newContent = content.map(b => ({...b}))
		const last = newContent[newContent.length - 1] as BetaContentBlockParam & {
			cache_control?: CacheControl
		}
		// thinking block 不打 cache（cc 同样规避）
		if ((last as {type: string}).type === 'thinking') return message
		last.cache_control = this.cache
		return {
			role: message.role,
			content: newContent as BetaContentBlockParam[],
		}
	}
}

/**
 * NoOpCachePolicy — 不打 cache。用于禁用 caching。
 */
export class NoOpCachePolicy implements CacheControlPolicy {
	plan(input: CachePlanInput): CachePlanOutput {
		return {
			messages: input.messages,
			system: input.system,
			tools: input.tools,
		}
	}
}
