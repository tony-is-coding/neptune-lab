import type {EngineErrorCodeType} from '../../errors.js'

export interface RetryConfig {
	/** 最大重试次数（默认 3） */
	maxRetries: number
	/** 指数退避基数，单位毫秒（默认 1000） */
	backoffMs: number
	/** 可重试的错误码列表（默认包含 RATE_LIMIT 和 NETWORK_ERROR） */
	retryableErrors: EngineErrorCodeType[]
}

export interface BaseProviderConfig {
	/** 默认模型（可选） */
	defaultModel?: string
	/** 重试配置（可选） */
	retryConfig?: RetryConfig

	/** 其他配置 */
	[key: string]: unknown
}
