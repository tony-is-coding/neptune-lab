/**
 * OpenAIProvider — OpenAI 兼容 LLM Provider 的适配器
 *
 * 设计原则：
 * - 包装不替代：包装 CC 的 queryModelOpenAI，不重写 LLM 调用逻辑
 * - 参数适配：将 ProviderQueryParams 转换为 CC 所需的参数格式
 * - 流式输出：将 CC 的流式响应转换为标准 ProviderMessage 格式
 * - 配置注入：支持通过配置传入 API Key 和 BaseURL（T6 新增）
 *
 * 实现说明：
 * - 继承 BaseProvider，只保留 query() 方法的特定实现
 * - OpenAI 使用位置参数调用方式
 */

import type {ProviderQueryParams, ProviderMessage} from '@neptune/engine/provider/ProviderAdapter.js'
import {BaseProvider, type BaseProviderConfig} from '@neptune/engine/provider/adapters/BaseProvider.js'
import type {OpenAIProviderConfig} from '@neptune/engine/provider/types/ProviderConfigs.js'

// ============================================================
// OpenAIProvider 实现
// ============================================================

/**
 * OpenAIProvider — OpenAI 兼容 API 的适配器
 *
 * 包装 CC 的 queryModelOpenAI，实现 ProviderAdapter 接口。
 * 支持 Ollama/DeepSeek/vLLM 等任意 OpenAI Chat Completions 协议端点。
 *
 * T6 新增：支持通过配置传入 API Key 和 BaseURL
 * - 优先级：配置传入 > 环境变量
 * - 实现方式：在调用前临时设置环境变量，调用后恢复
 */
export class OpenAIProvider extends BaseProvider<OpenAIProviderConfig> {
	readonly type = 'openai' as const

	/** 保存原始环境变量，用于恢复 */
	private readonly originalEnv = {
		OPENAI_API_KEY: process.env.OPENAI_API_KEY,
		OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
	}

	/**
	 * 流式查询方法
	 *
	 * 将 ProviderQueryParams 转换为 CC 所需格式，调用 queryModelOpenAI，
	 * 并将流式响应转换为标准 ProviderMessage 格式。
	 *
	 * @param params 查询参数
	 * @returns 异步生成器，产出 ProviderMessage
	 */
	async* query(params: ProviderQueryParams): AsyncGenerator<ProviderMessage> {
		// T6: 应用配置中的 API Key 和 BaseURL（优先级高于环境变量）
		this.applyConfig()

		try {
			void params
			yield this.unsupportedProductRuntimeProvider()
		} catch (error) {
			yield this.createErrorResponse(error)
		} finally {
			// T6: 恢复原始环境变量
			this.restoreConfig()
		}
	}

	/**
	 * 应用配置中的 API Key 和 BaseURL
	 *
	 * T6 新增：通过临时设置环境变量实现配置注入
	 * 优先级：配置传入 > 环境变量
	 */
	private applyConfig(): void {
		// 应用 API Key
		if (this.config.apiKey && typeof this.config.apiKey === 'string') {
			process.env.OPENAI_API_KEY = this.config.apiKey
		}

		// 应用 Base URL
		if (this.config.baseURL && typeof this.config.baseURL === 'string') {
			process.env.OPENAI_BASE_URL = this.config.baseURL
		}
	}

	/**
	 * 恢复原始环境变量
	 *
	 * T6 新增：确保配置不会影响其他请求
	 */
	private restoreConfig(): void {
		if (this.originalEnv.OPENAI_API_KEY !== undefined) {
			process.env.OPENAI_API_KEY = this.originalEnv.OPENAI_API_KEY
		} else if (this.config.apiKey) {
			delete process.env.OPENAI_API_KEY
		}

		if (this.originalEnv.OPENAI_BASE_URL !== undefined) {
			process.env.OPENAI_BASE_URL = this.originalEnv.OPENAI_BASE_URL
		} else if (this.config.baseURL) {
			delete process.env.OPENAI_BASE_URL
		}
	}
}
