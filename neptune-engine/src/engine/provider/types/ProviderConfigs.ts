/**
 * AnthropicProviderConfig — Anthropic API 调用配置
 *
 * 由 AnthropicStreamingProvider 消费（agent-loop 路径）。
 *
 * v6.0 P0.2.C：旧 provider 双轨已一刀切删除（substrate provider/ProviderAdapter
 * + provider/ProviderRegistry + provider/adapters/* + provider/CircuitBreaker），
 * 这里只保留 AnthropicProviderConfig 这一个值类型供 agent-loop 新轨消费。
 */
export interface AnthropicProviderConfig {
	/** API Key（可选，缺失时从 ANTHROPIC_API_KEY env 读取） */
	apiKey?: string
	/** Base URL（可选，默认 Anthropic 官方；指向 deepseek 走 anthropic-compatible endpoint） */
	baseURL?: string
	/** 默认 model（可选，query params.model 优先） */
	defaultModel?: string
	/** Beta flags（可选） */
	betaFlags?: string[]
}
