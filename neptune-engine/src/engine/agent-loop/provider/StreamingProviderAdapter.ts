/**
 * StreamingProviderAdapter — Agent Loop 用的 Provider 流式接口
 *
 * 与原 ProviderAdapter 并行：
 * - 旧 ProviderAdapter.query 返 ProviderMessage（bridge 层兼容用，已退化为 unsupported）
 * - 新 StreamingProviderAdapter.queryStream 返 ParsedSSEEvent（agent-loop 主路径）
 *
 * 设计原则：
 * - Provider 只管发请求 + 收 SSE 流 + 解析成 ParsedSSEEvent，不管 retry / fallback / watchdog
 *   （这些归 AgentLoop 在外层做，详见 Batch 12-13）
 * - cancellation 通过 params.signal 一路传到 fetch
 */

import type {Tool} from '../../types/tool.js'
import type {Message} from '../../types/message.js'
import type {ParsedSSEEvent} from '../types.js'
import type {
	BetaTextBlockParam,
	BetaToolUnion,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'

/**
 * Streaming query 参数 — 已经经过 MessageSerializer 序列化的 API 请求体。
 *
 * caller（AgentLoop）负责：
 * - 调 MessageSerializer.resolveToolParams 把 Tool[] 转成 BetaToolUnion[]
 * - 调 MessageSerializer.toRequestParams 构造完整 params
 * - 通过 extra 注入 cache_control（Batch 14）
 */
export interface StreamingQueryParams {
	model: string
	messages: Message[]
	tools?: Tool[]
	systemPrompt?: string | BetaTextBlockParam[]
	maxTokens?: number
	signal?: AbortSignal
	/** Provider 特定扩展（cache_control / anthropic-beta header / 等）。 */
	extra?: Record<string, unknown>
	/** 已 resolve 的 BetaToolUnion[]，由 caller 提供（避免 Provider 重复 resolve description）。 */
	resolvedTools?: BetaToolUnion[]
}

/**
 * StreamingProviderAdapter — Agent Loop 主调用的 Provider 接口。
 */
export interface StreamingProviderAdapter {
	readonly type: string
	/** 流式查询：消费 params 直接 emit ParsedSSEEvent。 */
	queryStream(params: StreamingQueryParams): AsyncGenerator<ParsedSSEEvent, void, unknown>
}
