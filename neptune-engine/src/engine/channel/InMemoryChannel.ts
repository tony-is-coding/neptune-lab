/**
 * InMemoryChannel — 进程内单实例 Channel（测试 + 单机 multi-agent 用）
 *
 * 实现：
 * - send：把消息推入 target 的 FIFO 队列；同时 broadcast 给当前 subscribers
 * - receive：从 FIFO 队列取一条（无则 null）
 * - subscribe：deferred queue（等下次 send 时 fulfill）
 *
 * 语义：
 * - send + receive 是 FIFO 单播队列（每条消息只被消费一次）
 * - send + subscribe 是 broadcast（每条消息每个订阅者各看一次）
 * - 两套独立：受 receive 消费的消息不影响 subscribe 的事件流；反之亦然
 */

import type {Channel} from './Channel.js'

export class InMemoryChannel<T = unknown> implements Channel<T> {
	private readonly queues = new Map<string, T[]>()
	private readonly subscribers = new Map<string, Array<(msg: T) => void>>()

	async send(target: string, message: T): Promise<void> {
		// FIFO 队列
		let q = this.queues.get(target)
		if (!q) {
			q = []
			this.queues.set(target, q)
		}
		q.push(message)
		// broadcast 给订阅者
		const subs = this.subscribers.get(target)
		if (subs) {
			for (const sub of subs) sub(message)
		}
	}

	async receive(target: string): Promise<T | null> {
		const q = this.queues.get(target)
		if (!q || q.length === 0) return null
		return q.shift()!
	}

	subscribe(target: string): AsyncIterable<T> {
		// deferred queue：caller 拉时返回 promise
		const channel = this
		return {
			[Symbol.asyncIterator](): AsyncIterator<T> {
				const pendingMessages: T[] = []
				const pendingResolvers: Array<(value: IteratorResult<T>) => void> = []
				let closed = false

				const handler = (msg: T): void => {
					if (closed) return
					const resolver = pendingResolvers.shift()
					if (resolver) {
						resolver({value: msg, done: false})
					} else {
						pendingMessages.push(msg)
					}
				}
				const subs = channel.subscribers.get(target) ?? []
				subs.push(handler)
				channel.subscribers.set(target, subs)

				const cleanup = (): void => {
					closed = true
					const list = channel.subscribers.get(target)
					if (list) {
						const idx = list.indexOf(handler)
						if (idx >= 0) list.splice(idx, 1)
					}
					// 释放挂起的 resolver
					for (const r of pendingResolvers) {
						r({value: undefined as T, done: true})
					}
					pendingResolvers.length = 0
				}

				return {
					async next(): Promise<IteratorResult<T>> {
						if (closed) return {value: undefined as T, done: true}
						if (pendingMessages.length > 0) {
							return {value: pendingMessages.shift()!, done: false}
						}
						return new Promise(resolve => {
							pendingResolvers.push(resolve)
						})
					},
					async return(): Promise<IteratorResult<T>> {
						cleanup()
						return {value: undefined as T, done: true}
					},
					async throw(err: unknown): Promise<IteratorResult<T>> {
						cleanup()
						throw err
					},
				}
			},
		}
	}

	async dispose(): Promise<void> {
		this.queues.clear()
		this.subscribers.clear()
	}
}
