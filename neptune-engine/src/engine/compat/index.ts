/**
 * engine/compat/ 公共 API 导出
 *
 * 兼容层模块，用于支持非 Bun 环境下的功能。
 */

// Feature flag 兼容
export {isEnabled, isEnabledSync, createFeatureChecker} from './featureCompat.js'
export type {FeatureOverride} from './featureCompat.js'

// Analytics 兼容（No-op 实现）- 重定向到 analytics 模块
export {
	NoOpAnalyticsSink, noOpAnalyticsSink, attachNoOpAnalytics as initializeNoOpAnalytics
} from '../analytics/index.js'
