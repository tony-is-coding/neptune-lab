import type {EventBusMessage} from '../types'
import {LogUtil} from '../log/index.js'
import {EventEmitter} from 'events'

/**
 * 外部事件订阅接口
 *
 * 提供机制让外部系统（如 Web 服务、消息队列、WebSocket 连接）订阅和接收引擎内部事件。
 *
 * 设计原则：
 * - 解耦：外部订阅者不直接依赖 EventBus
 * - 异步：所有操作都是异步的，不阻塞主流程
 * - 可过滤：支持按事件类型和 Session 过滤
 * - 可序列化：所有事件都可序列化为 JSON
 *
 * @example
 * ```typescript
 * const bridge = new ExternalEventBridge(eventBus)
 *
 * // 订阅所有事件
 * const unsubscribe = bridge.subscribe((message) => {
 *   console.log('Received event:', message.type, message.payload)
 * })
 *
 * // 订阅特定类型的事件
 * const unsubscribe2 = bridge.subscribeByType('session:created', (message) => {
 *   console.log('Session created:', message.payload)
 * })
 *
 * // 订阅特定 Session 的事件
 * const unsubscribe3 = bridge.subscribeBySession('session-123', (message) => {
 *   console.log('Session event:', message.type, message.payload)
 * })
 *
 * // 取消订阅
 * unsubscribe()
 * ```
 */

/**
 * 外部事件监听器
 */
export type ExternalEventListener = (message: EventBusMessage) => void

/**
 * 订阅选项
 */
export interface ExternalSubscribeOptions {
	/** 事件类型过滤（可选） */
	eventType?: string
	/** Session ID 过滤（可选） */
	sessionId?: string
	/** 是否包含历史事件（默认 false） */
	includeHistory?: boolean
}

/**
 * 外部事件统计信息
 */
export interface ExternalEventStats {
	/** 总订阅者数量 */
	totalSubscribers: number
	/** 按事件类型分组的订阅者数量 */
	subscribersByType: Record<string, number>
	/** 按 Session 分组的订阅者数量 */
	subscribersBySession: Record<string, number>
	/** 已发送事件总数 */
	totalEventsSent: number
	/** 按事件类型统计的已发送事件数 */
	eventsSentByType: Record<string, number>
}

/**
 * 外部事件桥接器
 *
 * 连接内部 EventBus 和外部订阅者，提供事件分发和过滤功能。
 */
export class ExternalEventBridge {
	private eventBus: EventEmitter
	private listeners: Set<ExternalEventListener> = new Set()
	private listenersByType: Map<string, Set<ExternalEventListener>> = new Map()
	private listenersBySession: Map<string, Set<ExternalEventListener>> = new Map()
	private listenerOptions: Map<ExternalEventListener, ExternalSubscribeOptions> = new Map()
	private stats: ExternalEventStats = {
		totalSubscribers: 0,
		subscribersByType: {},
		subscribersBySession: {},
		totalEventsSent: 0,
		eventsSentByType: {},
	}
	private _closed = false

	constructor(eventBus?: EventEmitter) {
		// 如果提供了 EventBus，则监听其事件
		this.eventBus = eventBus ?? new EventEmitter()
	}

	/**
	 * 订阅所有事件
	 *
	 * @param listener 事件监听器
	 * @param options 订阅选项
	 * @returns 取消订阅函数
	 */
	subscribe(listener: ExternalEventListener, options?: ExternalSubscribeOptions): () => void {
		if (this._closed) {
			throw new Error('ExternalEventBridge 已关闭，无法订阅')
		}

		this.listeners.add(listener)
		this.listenerOptions.set(listener, options ?? {})

		// 按类型分组
		if (options?.eventType) {
			if (!this.listenersByType.has(options.eventType)) {
				this.listenersByType.set(options.eventType, new Set())
			}
			this.listenersByType.get(options.eventType)!.add(listener)
		}

		// 按 Session 分组
		if (options?.sessionId) {
			if (!this.listenersBySession.has(options.sessionId)) {
				this.listenersBySession.set(options.sessionId, new Set())
			}
			this.listenersBySession.get(options.sessionId)!.add(listener)
		}

		this.updateStats()

		// 返回取消函数
		return () => this.unsubscribe(listener)
	}

	/**
	 * 订阅特定类型的事件
	 *
	 * @param eventType 事件类型
	 * @param listener 事件监听器
	 * @returns 取消订阅函数
	 */
	subscribeByType(eventType: string, listener: ExternalEventListener): () => void {
		return this.subscribe(listener, {eventType})
	}

	/**
	 * 订阅特定 Session 的事件
	 *
	 * @param sessionId Session ID
	 * @param listener 事件监听器
	 * @returns 取消订阅函数
	 */
	subscribeBySession(sessionId: string, listener: ExternalEventListener): () => void {
		return this.subscribe(listener, {sessionId})
	}

	/**
	 * 取消订阅
	 *
	 * @param listener 要取消的监听器
	 */
	unsubscribe(listener: ExternalEventListener): void {
		this.listeners.delete(listener)

		const options = this.listenerOptions.get(listener)
		if (options) {
			// 从类型分组中移除
			if (options.eventType) {
				const typeListeners = this.listenersByType.get(options.eventType)
				if (typeListeners) {
					typeListeners.delete(listener)
					if (typeListeners.size === 0) {
						this.listenersByType.delete(options.eventType)
					}
				}
			}

			// 从 Session 分组中移除
			if (options.sessionId) {
				const sessionListeners = this.listenersBySession.get(options.sessionId)
				if (sessionListeners) {
					sessionListeners.delete(listener)
					if (sessionListeners.size === 0) {
						this.listenersBySession.delete(options.sessionId)
					}
				}
			}

			this.listenerOptions.delete(listener)
		}

		this.updateStats()
	}

	/**
	 * 分发事件给所有匹配的订阅者
	 *
	 * @param message 事件消息
	 */
	dispatch(message: EventBusMessage): void {
		if (this._closed) {
			return
		}

		let dispatched = false

		// 遍历所有监听器
		for (const listener of this.listeners) {
			const options = this.listenerOptions.get(listener)

			// 检查过滤条件
			if (options?.eventType && options.eventType !== message.type) {
				continue
			}

			if (options?.sessionId && options.sessionId !== message.sessionId) {
				continue
			}

			// 分发事件
			try {
				listener(message)
				dispatched = true
			} catch (error) {
				LogUtil.error('ExternalEventBridge: 监听器抛出错误', {
					error: String(error),
					eventType: message.type,
					sessionId: message.sessionId,
				})
			}
		}

		// 更新统计
		if (dispatched) {
			this.stats.totalEventsSent++
			this.stats.eventsSentByType[message.type] =
				(this.stats.eventsSentByType[message.type] ?? 0) + 1
		}
	}

	/**
	 * 获取统计信息
	 *
	 * @returns 统计信息
	 */
	getStats(): ExternalEventStats {
		return {...this.stats}
	}

	/**
	 * 重置统计信息
	 */
	resetStats(): void {
		this.stats = {
			totalSubscribers: this.listeners.size,
			subscribersByType: {},
			subscribersBySession: {},
			totalEventsSent: 0,
			eventsSentByType: {},
		}
		this.updateStats()
	}

	/**
	 * 更新统计信息
	 */
	private updateStats(): void {
		this.stats.totalSubscribers = this.listeners.size

		// 更新按类型分组的统计
		this.stats.subscribersByType = {}
		for (const [eventType, listeners] of this.listenersByType.entries()) {
			this.stats.subscribersByType[eventType] = listeners.size
		}

		// 更新按 Session 分组的统计
		this.stats.subscribersBySession = {}
		for (const [sessionId, listeners] of this.listenersBySession.entries()) {
			this.stats.subscribersBySession[sessionId] = listeners.size
		}
	}

	/**
	 * 关闭桥接器
	 */
	close(): void {
		if (this._closed) return
		this._closed = true

		// 清理所有监听器
		this.listeners.clear()
		this.listenersByType.clear()
		this.listenersBySession.clear()
		this.listenerOptions.clear()
	}

	/**
	 * 检查是否已关闭
	 */
	isClosed(): boolean {
		return this._closed
	}
}

/**
 * 创建全局事件桥接器实例
 *
 * 用于需要全局共享事件桥接器的场景。
 */
let globalBridge: ExternalEventBridge | null = null

/**
 * 获取全局事件桥接器
 *
 * @param eventBus 可选的 EventBus 实例
 * @returns 全局事件桥接器
 */
export function getGlobalEventBridge(eventBus?: EventEmitter): ExternalEventBridge {
	if (!globalBridge) {
		globalBridge = new ExternalEventBridge(eventBus)
	}
	return globalBridge
}

/**
 * 重置全局事件桥接器
 *
 * 用于测试场景。
 */
export function resetGlobalEventBridge(): void {
	if (globalBridge) {
		globalBridge.close()
		globalBridge = null
	}
}
