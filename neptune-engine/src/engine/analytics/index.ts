/**
 * engine/analytics/ 公共 API 导出
 *
 * Analytics 兼容层，用于 SDK 模式下的零开销 analytics。
 */

// No-Op Analytics 实现
export { NoOpAnalyticsSink, noOpAnalyticsSink, attachNoOpAnalytics } from './NoOpAnalytics.js'
