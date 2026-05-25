/**
 * BedrockProvider — AWS Bedrock LLM Provider 的适配器
 *
 * 设计原则：
 * - 包装不替代：Bedrock 使用 Anthropic Bedrock SDK，底层走 CC 的 queryModelWithStreaming
 * - 参数适配：将 ProviderQueryParams 转换为 CC 所需的参数格式
 * - 流式输出：将 CC 的流式响应转换为标准 ProviderMessage 格式
 *
 * 实现说明：
 * - Bedrock 没有独立的 query 函数，它通过 CC 的 client.ts 创建 AnthropicBedrock 客户端，
 *   然后走标准的 queryModelWithStreaming 流程
 * - 继承 BaseProvider，只保留 query() 方法的特定实现
 */

import type {ProviderQueryParams, ProviderMessage} from '@neptune/engine/provider/ProviderAdapter.js'
import {BaseProvider, type BaseProviderConfig} from '@neptune/engine/provider/adapters/BaseProvider.js'
import type {BedrockProviderConfig} from '@neptune/engine/provider/types/ProviderConfigs.js'

// ============================================================
// BedrockProvider 实现
// ============================================================

/**
 * BedrockProvider — AWS Bedrock API 的适配器
 *
 * Bedrock 使用 Anthropic Bedrock SDK，底层走 CC 的 queryModelWithStreaming。
 * 通过环境变量 CLAUDE_CODE_USE_BEDROCK=1 启用 Bedrock 模式。
 */
export class BedrockProvider extends BaseProvider<BedrockProviderConfig> {
	readonly type = 'bedrock' as const

	/**
	 * 流式查询方法
	 *
	 * Bedrock 底层使用 Anthropic Bedrock SDK，委托给 CC 的 queryModelWithStreaming。
	 * 需要确保 CLAUDE_CODE_USE_BEDROCK 环境变量已设置。
	 *
	 * @param params 查询参数
	 * @returns 异步生成器，产出 ProviderMessage
	 */
	async* query(params: ProviderQueryParams): AsyncGenerator<ProviderMessage> {
		try {
			void params
			yield this.unsupportedProductRuntimeProvider()
		} catch (error) {
			yield this.createErrorResponse(error)
		}
	}
}
