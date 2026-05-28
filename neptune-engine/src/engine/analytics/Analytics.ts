/**
 * engine/analytics/Analytics.ts
 *
 * Analytics 接口（轻量别名）+ NoOpAnalytics 默认实现
 *
 * 设计说明：
 * - engine 早期已有 NoOpAnalyticsSink（同义），但命名偏长且暴露异步方法
 *   这里建立短命名 `Analytics` / `NoOpAnalytics`，给 builtin-tools 当统一注入接口
 * - 接口同步 logEvent(name, data?)，不要求实现异步路径
 * - per-session 通过 ctx.analytics 注入；未注入时 caller 用 ctx.analytics?.logEvent 静默跳过
 *
 * 这是 Stage 1.1 Analytics 抽象的"对外契约"。
 * NoOpAnalyticsSink 保留向后兼容，本文件提供更简短的别名。
 */

/**
 * Analytics 接口（轻量同步契约）
 *
 * 与 cc product 的 logEvent 函数签名兼容，可被 product 层 NoOp 之外的实现替换
 * （langfuse / segment / amplitude 等）。
 */
export interface Analytics {
	logEvent(name: string, data?: Record<string, unknown>): void
}

/**
 * 默认 NoOp 实现
 * 所有调用静默吞 + return void。零依赖、零开销。
 */
export class NoOpAnalytics implements Analytics {
	logEvent(_name: string, _data?: Record<string, unknown>): void {
		// no-op
	}
}

/** 单例：便于直接 import 使用 */
export const noOpAnalytics: Analytics = new NoOpAnalytics()
