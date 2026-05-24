/**
 * cc-shim/analytics.ts — substrate-local 替代 src/services/analytics/* + utils/fileOperationAnalytics
 *
 * substrate 不感知 cc 的具体 analytics 后端（langfuse / segment / etc.）。
 * 这里 stub logEvent / 类型，让 builtin-tools 工具可编译运行。
 * Product 想接 analytics 应通过 ctx.analytics?.logEvent 注入（engine S1.1 已落地 Analytics 接口）。
 */

// type alias 与 cc 兼容
export type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS = string

/** No-op logEvent — substrate 默认不发埋点。 */
export function logEvent(
	_eventName: string,
	_metadata?: Record<string, unknown>,
): void {
	// no-op
}

/** No-op growthbook 取值 — substrate 不依赖 cc feature flags。 */
export function getFeatureValue_CACHED_MAY_BE_STALE<T>(_name: string, fallback: T): T {
	return fallback
}

/** No-op fileOperationAnalytics.logFileOperation。 */
export function logFileOperation(
	_operation: string,
	_metadata?: Record<string, unknown>,
): void {
	// no-op
}
