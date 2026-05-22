/**
 * Engine 错误码定义
 *
 * 错误码分层：
 * - EXECUTION_ERROR: 通用执行错误（向后兼容，保持现有）
 * - AUTH_ERROR: 认证相关错误（401, 403, 无效 API Key, Token 失效等）
 * - RATE_LIMIT: 速率限制错误（429, 529 过载, 配额不足等）
 * - NETWORK_ERROR: 网络相关错误（连接失败, 超时, DNS 解析失败等）
 * - PROVIDER_NOT_FOUND: Provider 未找到错误（404, 模型不存在等）
 */
export const EngineErrorCode = {
	SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
	SESSION_PAUSED: 'SESSION_PAUSED',
	SESSION_WORKSPACE_CONFLICT: 'SESSION_WORKSPACE_CONFLICT',
	SESSION_LIMIT_EXCEEDED: 'SESSION_LIMIT_EXCEEDED',
	SESSION_ALREADY_DESTROYED: 'SESSION_ALREADY_DESTROYED',
	SESSION_CREATE_FAILED: 'SESSION_CREATE_FAILED',
	SESSION_OPERATION_FAILED: 'SESSION_OPERATION_FAILED',
	SESSION_INVALID_OPERATION: 'SESSION_INVALID_OPERATION',
	CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
	EXECUTION_ERROR: 'EXECUTION_ERROR',
	// Provider 相关错误（V11 新增）
	AUTH_ERROR: 'AUTH_ERROR',
	RATE_LIMIT: 'RATE_LIMIT',
	NETWORK_ERROR: 'NETWORK_ERROR',
	PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
	// 超时和工具错误（V13 新增）
	TIMEOUT_ERROR: 'TIMEOUT_ERROR',
	TOOL_ERROR: 'TOOL_ERROR',
	// V15 新增错误码
	CIRCUIT_OPEN: 'CIRCUIT_OPEN',
	SESSION_BUSY: 'SESSION_BUSY',
	WORKSPACE_IN_USE: 'WORKSPACE_IN_USE',
	MAX_SESSIONS_REACHED: 'MAX_SESSIONS_REACHED',
} as const

export type EngineErrorCodeType = typeof EngineErrorCode[keyof typeof EngineErrorCode]

/**
 * EngineError — Engine 层的统一错误类型
 * 所有 SessionManager 和 AgentEngine 抛出的错误都应使用此类型
 */
export class EngineError extends Error {
	readonly code: EngineErrorCodeType

	constructor(code: EngineErrorCodeType, message: string, options?: { cause?: Error }) {
		super(message, options)
		this.name = 'EngineError'
		this.code = code
		// 修复 TS 编译后 instanceof 检查失败的问题
		Object.setPrototypeOf(this, EngineError.prototype)
	}
}
