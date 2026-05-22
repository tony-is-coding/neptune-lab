/**
 * engine/provider/ 公共 API 导出
 *
 * Provider 适配器统一接口，支持 per-session Provider 配置。
 * LLMRuntime 已合并到 ProviderAdapter，不再单独导出。
 */

// 核心接口
export type {ProviderAdapter, ProviderQueryParams, ProviderMessage} from './ProviderAdapter.js'

// Provider 配置类型
export type {
	AnthropicProviderConfig,
	OpenAIProviderConfig,
	GeminiProviderConfig,
	GrokProviderConfig,
	BedrockProviderConfig,
	VertexProviderConfig,
	FoundryProviderConfig,
} from './types/ProviderConfigs.js'

// 注册表
export {ProviderRegistry, getGlobalProviderRegistry, resetGlobalProviderRegistryForTesting} from './ProviderRegistry.js'

// CircuitBreaker 熔断器
export type {CircuitBreakerConfig, CircuitBreakerState, CircuitBreakerStateChangedEvent} from './CircuitBreaker.js'
export {CircuitBreaker} from './CircuitBreaker.js'
