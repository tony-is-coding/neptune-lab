/**
 * engine/analytics/ — Analytics 接口契约
 *
 * 设计目的：
 * - 让 substrate 提供一个**可注入的埋点契约**，让 user / product / packages 可以接 langfuse / segment / amplitude 等真实 sink
 * - substrate 自身不实现具体 sink，只提供 NoOpAnalytics 作为安全默认值
 *
 * 使用：
 * ```ts
 * // user 自己的实现：
 * class MyAnalytics implements Analytics {
 *   logEvent(name, data) { /* 上报到 langfuse / segment / etc *\/ }
 * }
 *
 * // 注入到 ToolUseContext.analytics（builtin-tools 可消费）：
 * ctx.analytics = new MyAnalytics()
 * ctx.analytics.logEvent('tool.bash.executed', {duration: 234})
 * ```
 *
 * v6.0 P0.4.D：删除冗余的 NoOpAnalyticsSink / AnalyticsSink / attachNoOpAnalytics 等仪式代码，
 * 只保留 Analytics 类型契约 + NoOpAnalytics 默认实现。
 */
export {NoOpAnalytics, noOpAnalytics, type Analytics} from './Analytics.js'
