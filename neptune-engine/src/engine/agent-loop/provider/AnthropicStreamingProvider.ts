/**
 * AnthropicStreamingProvider — 用 @anthropic-ai/sdk 跑流式请求 + SSEParser 解析
 *
 * 算法纲要（参考 cc claude.ts:1820-2310 queryModel SDK 调用 + SSE 主循环，去除 product 干扰后）：
 *
 *   queryStream(params):
 *     1. 创建 Anthropic SDK client（用 config 注入 apiKey / baseURL，不污染 process.env）
 *     2. 用 MessageSerializer.toRequestParams 序列化为 SDK params
 *     3. client.beta.messages.create({...params, stream: true}) → Stream<RawEvent>
 *     4. 把 stream 喂给 SSEParser.consume → emit ParsedSSEEvent
 *     5. 错误：SDK throw → emit ParsedSSEEvent.error (api_error)
 *     6. abort：params.signal 直接传给 SDK 的 fetch
 *
 * 与 cc 行为差异（详见 ../sse/__tests__/oracle/README.md）：
 * - 不抄 client request id header
 * - 不抄 fast mode / effort value 透传
 * - 不抄 advisor / langfuse 集成
 * - 不抄 stream watchdog（Batch 13）
 * - 不抄 retry / fallback（Batch 12）
 */

import Anthropic from '@anthropic-ai/sdk'
import type {ClientOptions} from '@anthropic-ai/sdk'
import type {AnthropicProviderConfig} from '../../provider/types/ProviderConfigs.js'
import {MessageSerializer} from '../message/MessageSerializer.js'
import {SSEParser} from '../sse/SSEParser.js'
import type {RawSSEEvent} from '../sse/sseEvents.js'
import type {ParsedSSEEvent} from '../types.js'
import type {
	StreamingProviderAdapter,
	StreamingQueryParams,
} from './StreamingProviderAdapter.js'

/**
 * AnthropicStreamingProvider
 *
 * 不继承 BaseProvider —— BaseProvider 有 product-era 的 ProviderMessage 转换逻辑，
 * 不适合 streaming-first agent loop。两条路径独立，bridge 层通过 unsupported 表达。
 */
export class AnthropicStreamingProvider implements StreamingProviderAdapter {
	readonly type = 'anthropic' as const
	private readonly config: AnthropicProviderConfig
	/**
	 * 客户端工厂（默认创建真实 SDK client）。
	 * 测试可注入 mock 工厂返回 fake client。
	 */
	private readonly clientFactory: (opts: ClientOptions) => Anthropic

	constructor(
		config: AnthropicProviderConfig = {} as AnthropicProviderConfig,
		clientFactory: (opts: ClientOptions) => Anthropic = opts => new Anthropic(opts),
	) {
		this.config = config
		this.clientFactory = clientFactory
	}

	getConfig(): Readonly<AnthropicProviderConfig> {
		return this.config
	}

	async *queryStream(
		params: StreamingQueryParams,
	): AsyncGenerator<ParsedSSEEvent, void, unknown> {
		// 1. 解析 apiKey / baseURL（config 优先于 env，但不污染 env）
		const apiKey = this.config.apiKey ?? process.env.ANTHROPIC_API_KEY
		if (!apiKey || typeof apiKey !== 'string' || apiKey.length === 0) {
			yield {
				type: 'error',
				source: 'api_error',
				error: new Error(
					'AnthropicStreamingProvider: ANTHROPIC_API_KEY is required (set config.apiKey or env)',
				),
			}
			return
		}
		const baseURL = this.config.baseURL ?? process.env.ANTHROPIC_BASE_URL ?? undefined

		const clientOptions: ClientOptions = {apiKey}
		if (baseURL) clientOptions.baseURL = baseURL

		const client = this.clientFactory(clientOptions)

		// 2. 序列化请求体（如果 caller 已用 cachePolicy 准备好了 __cachePlanned，直接用，避免重复序列化）
		// substrate 不再硬编码默认 model：caller 必须显式传 params.model 或 config.defaultModel
		const model = params.model || this.config.defaultModel
		if (!model) {
			yield {
				type: 'error',
				source: 'api_error',
				error: new Error(
					'AnthropicStreamingProvider: model is required (set params.model or config.defaultModel)',
				),
			}
			return
		}
		const cachePlanned = (params.extra?.__cachePlanned ?? undefined) as
			| {messages?: unknown; system?: unknown; tools?: unknown}
			| undefined
		let serialized
		try {
			if (cachePlanned) {
				serialized = {
					model,
					max_tokens: params.maxTokens ?? 4096,
					messages: cachePlanned.messages as never,
					system: cachePlanned.system as never,
					tools: cachePlanned.tools as never,
					extra: undefined,
				}
			} else {
				serialized = MessageSerializer.toRequestParams({
					model,
					messages: params.messages,
					systemPrompt: params.systemPrompt,
					tools: params.resolvedTools,
					maxTokens: params.maxTokens,
					extra: params.extra,
				})
			}
		} catch (err) {
			yield {
				type: 'error',
				source: 'api_error',
				error: err instanceof Error ? err : new Error(String(err)),
			}
			return
		}

		// 3. 构造 SDK params（合并 extra 透传字段，但剔除 engine 内部约定的 __cachePlanned）
		const extraForSdk: Record<string, unknown> = {...(serialized.extra ?? {})}
		// 防御：caller 直接传 extra 时也可能带这字段
		const callerExtra = {...(params.extra ?? {})}
		delete callerExtra.__cachePlanned
		Object.assign(extraForSdk, callerExtra)
		const sdkParams = {
			model: serialized.model,
			max_tokens: serialized.max_tokens,
			messages: serialized.messages,
			...(serialized.system !== undefined && {system: serialized.system}),
			...(serialized.tools && {tools: serialized.tools}),
			...extraForSdk,
			stream: true as const,
		}

		// 4. 调用 SDK，拿到 stream，喂给 SSEParser
		try {
			const stream = (await client.beta.messages.create(sdkParams, {
				signal: params.signal,
			})) as unknown as AsyncIterable<RawSSEEvent>
			for await (const event of SSEParser.consume(stream)) {
				yield event
			}
		} catch (err) {
			yield {
				type: 'error',
				source: 'api_error',
				error: err instanceof Error ? err : new Error(String(err)),
			}
		}
	}
}
