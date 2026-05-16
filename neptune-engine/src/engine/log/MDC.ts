/**
 * MDC (Mapped Diagnostic Context) — 映射诊断上下文
 *
 * 基于 AsyncLocalStorage 实现的上下文传播机制。
 * 自动在日志中注入 sessionId、requestId 等上下文信息。
 *
 * 使用示例：
 * ```ts
 * // 设置上下文
 * await MDC.run({ sessionId: 'abc-123', requestId: 'req-456' }, async () => {
 *   // 在这个异步作用域内，所有日志都会自动包含这些上下文
 *   LogUtil.info('Processing request') // 会包含 sessionId 和 requestId
 * })
 * ```
 */

import {AsyncLocalStorage} from 'node:async_hooks'

/** MDC 上下文类型 */
export interface MDCContext {
	/** Session ID */
	sessionId?: string
	/** Request ID（单次请求的唯一标识） */
	requestId?: string
	/** 用户 ID */
	userId?: string

	/** 其他自定义上下文 */
	[key: string]: unknown
}

/** AsyncLocalStorage 实例 */
const storage = new AsyncLocalStorage<MDCContext>()

/**
 * MDC — 映射诊断上下文
 *
 * 提供静态方法用于管理异步上下文。
 */
export class MDC {
	/**
	 * 在指定上下文中运行函数
	 * @param context 上下文对象
	 * @param callback 要执行的函数
	 * @returns 函数的返回值
	 */
	static async run<T>(context: MDCContext, callback: () => Promise<T>): Promise<T> {
		return storage.run(context, callback)
	}

	/**
	 * 获取当前上下文
	 * @returns 当前上下文，如果不在 run 作用域内则返回空对象
	 */
	static getContext(): MDCContext {
		return storage.getStore() || {}
	}

	/**
	 * 设置当前上下文的某个字段
	 * @param key 字段名
	 * @param value 字段值
	 */
	static put(key: string, value: unknown): void {
		const context = storage.getStore()
		if (context) {
			context[key] = value
		}
	}

	/**
	 * 获取当前上下文的某个字段
	 * @param key 字段名
	 * @returns 字段值，如果不存在则返回 undefined
	 */
	static get(key: string): unknown {
		const context = storage.getStore()
		return context?.[key]
	}

	/**
	 * 清除当前上下文
	 */
	static clear(): void {
		const context = storage.getStore()
		if (context) {
			Object.keys(context).forEach(key => {
				delete context[key]
			})
		}
	}

	/**
	 * 生成新的 Request ID
	 * @returns 格式为 "req-{timestamp}-{random}" 的 ID
	 */
	static generateRequestId(): string {
		return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
	}
}
