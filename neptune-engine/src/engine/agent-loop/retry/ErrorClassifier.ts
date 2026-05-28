/**
 * ErrorClassifier — 把错误分类为 retry / fallback / 抛出
 *
 * 算法纲要（参考 cc withRetry.ts 错误分类）：
 *
 *   - 429 / 529 / overloaded → retryable_rate_limited（要看 retry-after header）
 *   - 5xx (502/503/504) / network err → retryable_transient
 *   - 401 / 403                       → non_retryable_auth（用户问题）
 *   - 400 / 422                       → non_retryable_client（请求格式问题）
 *   - 404 + model 相关                → non_retryable_model_not_found
 *   - 其他                             → unknown
 *
 * 设计原则：
 * - 不绑定 SDK 错误类型；通过 duck typing 检测
 * - product 可注入自定义 classifier（替换默认行为）
 *
 * 与 cc 行为差异：
 * - 不抄 cc 的 quota / overdraft 业务分类（specific to product billing）
 * - 不抄 cc 的 SI（safety incident）分类（特殊业务）
 */

export type ErrorClass =
	| 'retryable_rate_limited'
	| 'retryable_transient'
	| 'non_retryable_auth'
	| 'non_retryable_client'
	| 'non_retryable_model_not_found'
	| 'unknown'

export interface ErrorClassification {
	cls: ErrorClass
	/** HTTP 状态码（如果有）。 */
	status?: number
	/** retry-after 提示（秒），429 / 529 时由 server 给出。 */
	retryAfterSeconds?: number
	/** 原始错误。 */
	cause: Error
}

const NETWORK_HINTS = [
	'econnrefused',
	'econnreset',
	'enotfound',
	'etimedout',
	'eai_again',
	'fetch failed',
	'network',
	'timeout',
]

/**
 * 默认分类器。
 *
 * 用 duck typing 而不是 instanceof 判断 SDK 错误，避免锁定 SDK 版本。
 */
export function classifyError(err: unknown): ErrorClassification {
	const error = err instanceof Error ? err : new Error(String(err))
	const hasStatus =
		typeof (err as {status?: unknown})?.status === 'number'
			? (err as {status: number}).status
			: undefined
	const status = hasStatus
	const message = error.message.toLowerCase()

	// 解析 retry-after：cc 的 SDK 错误可能带 headers 或 response.headers
	let retryAfterSeconds: number | undefined
	const headers =
		(err as {headers?: Record<string, string | undefined>})?.headers ??
		(err as {response?: {headers?: Record<string, string | undefined>}})?.response?.headers
	if (headers) {
		const retryAfter = headers['retry-after']
		if (retryAfter) {
			const n = Number(retryAfter)
			if (Number.isFinite(n) && n > 0) retryAfterSeconds = n
		}
	}

	// 状态码分支
	if (status === 429 || status === 529) {
		return {cls: 'retryable_rate_limited', status, retryAfterSeconds, cause: error}
	}
	if (status === 401 || status === 403) {
		return {cls: 'non_retryable_auth', status, cause: error}
	}
	if (status === 400 || status === 422) {
		return {cls: 'non_retryable_client', status, cause: error}
	}
	if (status === 404) {
		// 404 + 错误信息提到 model → model not found；其他 404 当 client 错误
		if (/model|not\s+found/i.test(error.message)) {
			return {cls: 'non_retryable_model_not_found', status, cause: error}
		}
		return {cls: 'non_retryable_client', status, cause: error}
	}
	if (typeof status === 'number' && status >= 500 && status < 600) {
		return {cls: 'retryable_transient', status, cause: error}
	}

	// Anthropic 特殊：overloaded_error message
	if (/overloaded/i.test(error.message) || /overloaded_error/i.test(error.message)) {
		return {cls: 'retryable_rate_limited', cause: error}
	}

	// 网络错误：通过 message 关键词
	if (NETWORK_HINTS.some(hint => message.includes(hint))) {
		return {cls: 'retryable_transient', cause: error}
	}

	// AbortError：通常是用户取消，不视作可重试
	if (error.name === 'AbortError' || /aborted/i.test(error.message)) {
		return {cls: 'non_retryable_client', cause: error}
	}

	return {cls: 'unknown', cause: error}
}

export function isRetryable(cls: ErrorClass): boolean {
	return cls === 'retryable_rate_limited' || cls === 'retryable_transient'
}
