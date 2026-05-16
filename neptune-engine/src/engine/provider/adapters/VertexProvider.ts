/**
 * VertexProvider — Google Cloud Vertex AI LLM Provider 的适配器
 *
 * 设计原则：
 * - 包装不替代：Vertex 使用 Anthropic Vertex SDK，底层走 CC 的 queryModelWithStreaming
 * - 参数适配：将 ProviderQueryParams 转换为 CC 所需的参数格式
 * - 流式输出：将 CC 的流式响应转换为标准 ProviderMessage 格式
 *
 * 实现说明：
 * - Vertex 没有独立的 query 函数，它通过 CC 的 client.ts 创建 AnthropicVertex 客户端，
 *   然后走标准的 queryModelWithStreaming 流程
 * - 继承 BaseProvider，只保留 query() 方法的特定实现
 */

import type {ProviderQueryParams, ProviderMessage} from '../ProviderAdapter.js'
import {BaseProvider, type BaseProviderConfig} from './BaseProvider.js'
import type {VertexProviderConfig} from '../types/ProviderConfigs.js'

// ============================================================
// VertexProvider 实现
// ============================================================

/**
 * VertexProvider — Google Cloud Vertex AI API 的适配器
 *
 * Vertex 使用 Anthropic Vertex SDK，底层走 CC 的 queryModelWithStreaming。
 * 通过环境变量 CLAUDE_CODE_USE_VERTEX=1 启用 Vertex 模式。
 */
export class VertexProvider extends BaseProvider<VertexProviderConfig> {
	readonly type = 'vertex' as const

	/**
	 * 流式查询方法
	 *
	 * Vertex 底层使用 Anthropic Vertex SDK，委托给 CC 的 queryModelWithStreaming。
	 * 需要确保 CLAUDE_CODE_USE_VERTEX 环境变量已设置。
	 *
	 * @param params 查询参数
	 * @returns 异步生成器，产出 ProviderMessage
	 */
	async* query(params: ProviderQueryParams): AsyncGenerator<ProviderMessage> {
		const {queryModelWithStreaming} = await import('../../../services/api/claude.js')
		const {asSystemPrompt} = await import('../../../utils/systemPromptType.js')

		try {
			const systemPrompt = asSystemPrompt(params.systemPrompt ? [params.systemPrompt] : [])
			const options = this.buildOptions(params)

			const stream = queryModelWithStreaming({
				messages: params.messages,
				systemPrompt,
				thinkingConfig: {type: 'disabled'},
				tools: params.tools ?? [],
				signal: params.signal || new AbortController().signal,
				options,
			})

			try {
				for await (const event of stream) {
					yield this.convertToProviderMessage(event)
				}
			} finally {
				// 确保在提前退出/中断/超时场景下清理 stream
				const iterator = stream[Symbol.asyncIterator]()
				if (typeof iterator.return === 'function') {
					await iterator.return()
				}
			}
		} catch (error) {
			yield this.createErrorResponse(error)
		}
	}
}
