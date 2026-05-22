/**
 * ProviderAdapter — LLM Provider 统一接口
 *
 * 设计原则：
 * - 包装不替代：不自建 LLM 调用层，只是将现有 CC 逻辑包装为统一接口
 * - per-session 配置：支持不同 session 使用不同的 Provider
 * - 可扩展：新增 Provider 只需实现此接口
 *
 * 当前阶段：
 * - AnthropicProvider 是 thin wrapper，底层仍然走 CC 的 QueryEngine
 * - 未来可支持直接调用 Anthropic API / Bedrock / Vertex 等
 */

import type {Message} from '@neptune/engine-product/types/message.js'
import type {Tools} from '@neptune/engine-product/Tool.js'

// ============================================================
// 类型定义
// ============================================================

/**
 * Provider 查询参数
 *
 * 封装发送给 LLM 的标准参数，各 Provider 实现负责将此转换为
 * 具体的 API 调用格式（Anthropic Messages API / Bedrock / Vertex 等）。
 *
 * 使用 CC 原始类型（Message[] 和 Tools）以确保与底层 API 完全兼容。
 */
export interface ProviderQueryParams {
	/** 模型标识（如 'claude-sonnet-4-20250514'） */
	model: string
	/** 消息列表（使用 CC 原始 Message 格式） */
	messages: Message[]
	/** 工具列表（使用 CC 原始 Tools 类型） */
	tools?: Tools
	/** 系统提示词 */
	systemPrompt?: string
	/** 最大输出 token 数 */
	maxTokens?: number
	/** 中断信号 */
	signal?: AbortSignal
	/** Provider 特定的额外配置 */
	extra?: Record<string, unknown>
}

/**
 * Provider 消息类型
 *
 * 标准化的消息输出格式，各 Provider 实现负责将其 API 响应转换为此格式。
 * 当前阶段与 CC 原始消息格式保持兼容（content 为 unknown），
 * 上层代码（AgentEngine.query）直接透传。
 */
export interface ProviderMessage {
	/** 消息类型 */
	type: 'text' | 'tool_use' | 'tool_result' | 'message'
	/** 消息内容（保持兼容 CC 原始格式） */
	content: unknown
}

/**
 * ProviderAdapter — LLM Provider 统一接口
 *
 * 所有 Provider 实现都必须满足此接口。
 * 通过 AsyncGenerator 实现流式输出，与 AgentEngine.query() 的模式一致。
 */
export interface ProviderAdapter {
	/** Provider 类型标识（如 'anthropic', 'bedrock', 'vertex'） */
	readonly type: string

	/**
	 * 获取 Provider 配置
	 *
	 * @returns 只读的配置对象
	 */
	getConfig(): Readonly<Record<string, unknown>>

	/**
	 * 流式查询方法
	 *
	 * @param params 查询参数
	 * @returns 异步生成器，逐步产出消息
	 */
	query(params: ProviderQueryParams): AsyncGenerator<ProviderMessage>
}
