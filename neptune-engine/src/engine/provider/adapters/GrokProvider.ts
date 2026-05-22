/**
 * GrokProvider — xAI Grok LLM Provider 的适配器
 *
 * 设计原则：
 * - 包装不替代：包装 CC 的 queryModelGrok，不重写 LLM 调用逻辑
 * - 参数适配：将 ProviderQueryParams 转换为 CC 所需的参数格式
 * - 流式输出：将 CC 的流式响应转换为标准 ProviderMessage 格式
 *
 * 实现说明：
 * - 继承 BaseProvider，只保留 query() 方法的特定实现
 * - Grok 使用位置参数调用方式
 */

import type {ProviderQueryParams, ProviderMessage} from '../ProviderAdapter.js'
import {asSystemPrompt} from '@neptune/engine-product/utils/systemPromptType.js'
import {BaseProvider, type BaseProviderConfig} from './BaseProvider.js'
import type {GrokProviderConfig} from '../types/ProviderConfigs.js'

// ============================================================
// GrokProvider 实现
// ============================================================

/**
 * GrokProvider — xAI Grok API 的适配器
 *
 * 包装 CC 的 queryModelGrok，实现 ProviderAdapter 接口。
 */
export class GrokProvider extends BaseProvider<GrokProviderConfig> {
	readonly type = 'grok' as const

	/**
	 * 流式查询方法
	 *
	 * 将 ProviderQueryParams 转换为 CC 所需格式，调用 queryModelGrok，
	 * 并将流式响应转换为标准 ProviderMessage 格式。
	 *
	 * @param params 查询参数
	 * @returns 异步生成器，产出 ProviderMessage
	 */
	async* query(params: ProviderQueryParams): AsyncGenerator<ProviderMessage> {
		const {queryModelGrok} = await import('../../../services/api/grok/index.js')

		try {
			const systemPrompt = asSystemPrompt(params.systemPrompt ? [params.systemPrompt] : [])
			const options = this.buildOptions(params)

			const stream = queryModelGrok(
				params.messages,
				systemPrompt,
				params.tools ?? [],
				params.signal || new AbortController().signal,
				options,
			)

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
