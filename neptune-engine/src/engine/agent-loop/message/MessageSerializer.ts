/**
 * MessageSerializer — engine Message ↔ Anthropic API 请求体
 *
 * 算法纲要（参考 cc claude.ts:578-672 user/assistantMessageToMessageParam + 周边）：
 *
 *   toRequestParams({ messages, system, tools, model, maxTokens, cacheBreakpoints? }):
 *     1. messages.map → MessageParam（user / assistant）
 *        - user: 内容是 string → {role:'user', content:string}
 *                 内容是 array → {role:'user', content:[ContentBlockParam[]]}（含 tool_result 等）
 *        - assistant: 同上，但需要保留 thinking signature
 *     2. tools.map → BetaToolUnion[]（用 inputJSONSchema 优先）
 *     3. system → string | BetaTextBlock[]（cache_control 字段在 Batch 14 接入）
 *     4. 返回 BetaMessageStreamParams（不 set stream=true，由 Provider 调 SDK 时设定）
 *
 * 与 cc 行为差异（详见 __tests__/oracle/README.md）：
 * - 不抄 querySource 分支（cache_control 决策）
 * - 不抄 enablePromptCaching 内嵌（让 caller 显式传 cacheBreakpoints）
 * - 不抄 connector_text 检测
 * - 不抄 stripGeminiProviderMetadata（用通用 normalizeContentBlock 替代）
 */

import type {
	BetaMessageParam,
	BetaToolUnion,
	BetaTextBlockParam,
	BetaContentBlockParam,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type {Message, ContentItem} from '../../types/message.js'
import type {Tool} from '../../types/tool.js'
import {EngineError, EngineErrorCode} from '../../errors.js'
import {
	normalizeContentBlock,
	findThinkingBlocksMissingSignature,
} from './ContentBlockNormalizer.js'

// ============================================================
// 公开类型
// ============================================================

/**
 * Anthropic API 请求体（engine 自定义类型，不直接暴露 SDK 类型给上层）。
 *
 * 字段对应 SDK 的 BetaMessageCreateParams，但只保留 substrate 必要字段。
 */
export interface SerializedRequestParams {
	model: string
	system?: string | BetaTextBlockParam[]
	messages: BetaMessageParam[]
	tools?: BetaToolUnion[]
	max_tokens: number
	/** 直接透传给 SDK 的扩展字段（让 Batch 14 caching policy 注入 cache_control） */
	extra?: Record<string, unknown>
}

/**
 * 序列化输入参数。
 */
export interface SerializeInput {
	model: string
	messages: Message[]
	systemPrompt?: string | BetaTextBlockParam[]
	/**
	 * 已 resolve description 后的 BetaToolUnion 数组。
	 * 由 caller 用 MessageSerializer.resolveToolParams(tools) 提前生成。
	 */
	tools?: BetaToolUnion[]
	/** 默认 4096，可由 caller 覆盖。 */
	maxTokens?: number
	/** Batch 14 cache_control 注入用。当前可空。 */
	extra?: Record<string, unknown>
}

const DEFAULT_MAX_TOKENS = 4096

// ============================================================
// 核心序列化
// ============================================================

export class MessageSerializer {
	/**
	 * 把 engine Message[] 序列化成 Anthropic API 请求体。
	 *
	 * 不验证 message 顺序合理性（user/assistant 交替）— 让 API 自己 reject。
	 * 但会校验 thinking block 必须有 signature（缺失会立即抛错）。
	 */
	static toRequestParams(input: SerializeInput): SerializedRequestParams {
		const messageParams: BetaMessageParam[] = []
		for (const msg of input.messages) {
			const param = MessageSerializer.toMessageParam(msg)
			if (param !== null) messageParams.push(param)
		}

		const result: SerializedRequestParams = {
			model: input.model,
			messages: messageParams,
			max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
		}

		if (input.systemPrompt !== undefined) {
			result.system = input.systemPrompt
		}
		if (input.tools && input.tools.length > 0) {
			result.tools = input.tools
		}
		if (input.extra) {
			result.extra = input.extra
		}
		return result
	}

	/**
	 * 单条 engine Message → MessageParam。
	 *
	 * 跳过条件（返回 null）：
	 * - type 不是 user / assistant（system / attachment / progress 等不进 API）
	 * - role 字段缺失（产品层未填充）
	 * - content 字段缺失
	 *
	 * 不允许空 content message（API 会 reject）— 上层调 stripExcessMediaItems / compaction 后保证非空。
	 */
	static toMessageParam(message: Message): BetaMessageParam | null {
		if (message.type !== 'user' && message.type !== 'assistant') {
			return null
		}
		const inner = message.message
		if (!inner) return null
		const role = inner.role as 'user' | 'assistant' | undefined
		if (role !== 'user' && role !== 'assistant') return null

		const rawContent = inner.content
		if (rawContent === undefined || rawContent === null) return null

		// 字符串 content 直接透传
		if (typeof rawContent === 'string') {
			return {role, content: rawContent}
		}

		// 数组 content：normalize 每个 block
		if (!Array.isArray(rawContent)) return null
		const cleaned: BetaContentBlockParam[] = []
		for (const block of rawContent) {
			cleaned.push(
				normalizeContentBlock(block as ContentItem) as unknown as BetaContentBlockParam,
			)
		}

		// thinking signature 校验（仅 assistant 必须，user 不会有 thinking block）
		if (role === 'assistant') {
			const violations = findThinkingBlocksMissingSignature(
				cleaned as unknown as ContentItem[],
			)
			if (violations.length > 0) {
				throw new EngineError(
					EngineErrorCode.EXECUTION_ERROR,
					`MessageSerializer: assistant message contains thinking blocks without signature at indices [${violations.join(',')}]. Anthropic API requires signatures for multi-turn requests.`,
				)
			}
		}

		return {role, content: cleaned}
	}

	/**
	 * 单个 engine Tool（已 resolve description）→ API BetaToolUnion。
	 *
	 * 约定：caller 在调 toToolParam 之前已经 await tool.description() 把它解析成 string，
	 * 因为 SDK params 必须同步。这把 async resolution 留给上层（Provider 在 query 入口 resolve）。
	 */
	static toToolParam(tool: Tool, resolvedDescription: string): BetaToolUnion {
		const schema = tool.inputJSONSchema
		if (!schema || typeof schema !== 'object') {
			throw new EngineError(
				EngineErrorCode.EXECUTION_ERROR,
				`MessageSerializer: tool '${tool.name}' missing inputJSONSchema (engine kernel does not run zod->JSON conversion at request time)`,
			)
		}
		return {
			name: tool.name,
			description: resolvedDescription,
			input_schema: schema,
		} as unknown as BetaToolUnion
	}

	/**
	 * 异步 resolve 一组工具的 description，再序列化成 BetaToolUnion[]。
	 *
	 * 在 Provider.query 入口调一次（每轮）：模型每次都重新看到 description 是合理的，
	 * 缓存优化由 Batch 14 prompt caching 处理。
	 */
	static async resolveToolParams(tools: readonly Tool[]): Promise<BetaToolUnion[]> {
		const out: BetaToolUnion[] = []
		for (const t of tools) {
			let desc = ''
			const d = t.description
			if (typeof d === 'string') desc = d
			else if (typeof d === 'function') {
				const r = (d as () => string | Promise<string>)()
				desc = typeof r === 'string' ? r : await r
			}
			out.push(MessageSerializer.toToolParam(t, desc))
		}
		return out
	}
}
