/**
 * 通知管理器 - 纯 JS 实现（零 React 依赖）
 *
 * 提供通知的发送、订阅功能，用于框架核心。
 */

import type {CoreNotification, NotificationEmitter} from '../types/notification.js'

export type NotificationHandler = (notification: CoreNotification) => void

/**
 * 创建通知发送器
 *
 * 返回一个 NotificationEmitter 实例，支持订阅通知事件。
 */
export function createNotificationEmitter(): NotificationEmitter & {
	subscribe: (handler: NotificationHandler) => () => void
	clear: () => void
} {
	const handlers = new Set<NotificationHandler>()

	return {
		emit(notification: CoreNotification) {
			for (const handler of handlers) {
				try {
					handler(notification)
				} catch (error) {
					console.error('Error in notification handler:', error)
				}
			}
		},

		subscribe(handler: NotificationHandler) {
			handlers.add(handler)
			return () => {
				handlers.delete(handler)
			}
		},

		clear() {
			handlers.clear()
		},
	}
}

/**
 * 全局默认通知发送器
 *
 * 用于向后兼容，确保现有代码在没有显式注入通知发送器时也能工作。
 */
export const defaultNotificationEmitter = createNotificationEmitter()

/**
 * 获取全局通知发送器
 *
 * @returns 全局默认通知发送器
 */
export function getGlobalNotificationEmitter(): NotificationEmitter {
	return defaultNotificationEmitter
}
