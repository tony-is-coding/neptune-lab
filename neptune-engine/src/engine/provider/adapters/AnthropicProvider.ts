/**
 * AnthropicProvider — Anthropic LLM Provider 的适配器
 *
 * 设计原则：
 * - 包装不替代：包装 CC 的 queryModelWithStreaming，不重写 LLM 调用逻辑
 * - 参数适配：将 ProviderQueryParams 转换为 CC 所需的参数格式
 * - 流式输出：将 CC 的流式响应转换为标准 ProviderMessage 格式
 * - 配置注入：支持通过配置传入 API Key 和 BaseURL（T6 新增）
 *
 * 实现说明：
 * - T6 阶段：支持配置注入，通过临时设置环境变量实现
 * - 继承 BaseProvider，只保留 query() 方法的特定实现
 * - 保留 buildSystemPrompt() 和 normalizeMessages() 作为辅助方法
 */

import type {ProviderQueryParams, ProviderMessage} from '../ProviderAdapter.js'
import type {Message} from '../../types/message.js'
import {asSystemPrompt} from '../types/system-prompt.js'
import type {SystemPrompt} from '../types/system-prompt.js'
import {BaseProvider, type BaseProviderConfig} from './BaseProvider.js'
import type {AnthropicProviderConfig} from '../types/ProviderConfigs.js'

// ============================================================
// AnthropicProvider 实现
// ============================================================

/**
 * AnthropicProvider — Anthropic API 的适配器
 *
 * 包装 CC 的 queryModelWithStreaming，实现 ProviderAdapter 接口。
 *
 * T6 新增：支持通过配置传入 API Key 和 BaseURL
 * - 优先级：配置传入 > 环境变量
 * - 实现方式：在调用前临时设置环境变量，调用后恢复
 */
export class AnthropicProvider extends BaseProvider<AnthropicProviderConfig> {
	readonly type = 'anthropic' as const

	/** 保存原始环境变量，用于恢复 */
	private readonly originalEnv = {
		ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
		ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
	}

	/**
	 * 流式查询方法
	 *
	 * 将 ProviderQueryParams 转换为 CC 所需格式，调用 queryModelWithStreaming，
	 * 并将流式响应转换为标准 ProviderMessage 格式。
	 *
	 * @param params 查询参数
	 * @returns 异步生成器，产出 ProviderMessage
	 */
	async* query(params: ProviderQueryParams): AsyncGenerator<ProviderMessage> {
		// T6: 应用配置中的 API Key 和 BaseURL（优先级高于环境变量）
		this.applyConfig()

		try {
			const {queryModelWithStreaming} = await import('../../../services/api/claude.js')

			// 1. 参数转换：ProviderQueryParams → CC 所需格式
			const systemPrompt = this.buildSystemPrompt(params.systemPrompt)
			const messages = this.normalizeMessages(params.messages)
			const model = params.model || this.config.defaultModel || 'claude-sonnet-4-20250514'

			// 2. 构建 queryModelWithStreaming 所需的 Options
			const options = this.buildOptions({...params, model})

			// 3. 调用 CC 的 queryModelWithStreaming
			const stream = queryModelWithStreaming({
				messages,
				systemPrompt,
				thinkingConfig: {type: 'disabled'},
				tools: params.tools ?? [],
				signal: params.signal || new AbortController().signal,
				options,
			})

			// 4. 转换流式响应：CC 格式 → ProviderMessage
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
			process.env.ANTHROPIC_API_KEY = this.config.apiKey
		}

		// 应用 Base URL
		if (this.config.baseURL && typeof this.config.baseURL === 'string') {
			process.env.ANTHROPIC_BASE_URL = this.config.baseURL
		}
	}

	/**
	 * 恢复原始环境变量
	 *
	 * T6 新增：确保配置不会影响其他请求
	 */
	private restoreConfig(): void {
		if (this.originalEnv.ANTHROPIC_API_KEY !== undefined) {
			process.env.ANTHROPIC_API_KEY = this.originalEnv.ANTHROPIC_API_KEY
		} else if (this.config.apiKey) {
			delete process.env.ANTHROPIC_API_KEY
		}

		if (this.originalEnv.ANTHROPIC_BASE_URL !== undefined) {
			process.env.ANTHROPIC_BASE_URL = this.originalEnv.ANTHROPIC_BASE_URL
		} else if (this.config.baseURL) {
			delete process.env.ANTHROPIC_BASE_URL
		}
	}

	/**
	 * 构建 SystemPrompt
	 */
	private buildSystemPrompt(customPrompt?: string): SystemPrompt {
		const prompts: string[] = []
		if (customPrompt) {
			prompts.push(customPrompt)
		}
		return asSystemPrompt(prompts)
	}

	/**
	 * 规范化消息格式
	 */
	private normalizeMessages(messages: Message[]): Message[] {
		// 简化版本：直接返回原始消息
		// 完整版本需要验证消息格式、添加必要的字段等
		return messages
	}
}
