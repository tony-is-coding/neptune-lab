/**
 * InMemoryTodoState — engine 默认 TodoState 实现，零外部依赖。
 *
 * replace() 后做一次 diff，按"前后对照"派发增/删/状态变化事件，让订阅方
 * 不需要自己 diff。每个 events() 调用得到一个独立的 async iterator，
 * 多订阅者互不干扰；session 销毁/abort signal 触发后 iterator 自然结束。
 */

import type {TodoEvent, TodoItem, TodoState, TodoStatus} from './types.js'

interface PendingDelivery {
	resolve: (event: IteratorResult<TodoEvent>) => void
}

export class InMemoryTodoState implements TodoState {
	private items: readonly TodoItem[] = []
	private readonly subscribers = new Set<{
		queue: TodoEvent[]
		pending: PendingDelivery | undefined
		closed: boolean
	}>()

	async replace(items: readonly TodoItem[]): Promise<void> {
		const prev = this.items
		const next = items.map(freezeItem)
		const events = diff(prev, next)
		this.items = next
		for (const ev of events) {
			this.publish(ev)
		}
	}

	current(): readonly TodoItem[] {
		return this.items
	}

	async *events(signal?: AbortSignal): AsyncIterable<TodoEvent> {
		const sub = {queue: [] as TodoEvent[], pending: undefined as PendingDelivery | undefined, closed: false}
		this.subscribers.add(sub)
		const onAbort = () => {
			sub.closed = true
			if (sub.pending) {
				sub.pending.resolve({value: undefined, done: true})
				sub.pending = undefined
			}
			this.subscribers.delete(sub)
		}
		signal?.addEventListener('abort', onAbort, {once: true})
		try {
			while (true) {
				if (signal?.aborted || sub.closed) return
				const next = sub.queue.shift()
				if (next !== undefined) {
					yield next
					continue
				}
				yield* await new Promise<TodoEvent[]>(resolve => {
					sub.pending = {
						resolve(result) {
							if (result.done) {
								resolve([])
							} else {
								resolve([result.value])
							}
						},
					}
				})
			}
		} finally {
			signal?.removeEventListener('abort', onAbort)
			this.subscribers.delete(sub)
		}
	}

	private publish(event: TodoEvent): void {
		for (const sub of this.subscribers) {
			if (sub.closed) continue
			if (sub.pending) {
				const p = sub.pending
				sub.pending = undefined
				p.resolve({value: event, done: false})
			} else {
				sub.queue.push(event)
			}
		}
	}
}

function freezeItem(item: TodoItem): TodoItem {
	return Object.freeze({...item})
}

function diff(prev: readonly TodoItem[], next: readonly TodoItem[]): TodoEvent[] {
	const events: TodoEvent[] = []
	const prevById = new Map(prev.map(i => [i.id, i] as const))
	const nextById = new Map(next.map(i => [i.id, i] as const))
	for (const id of prevById.keys()) {
		if (!nextById.has(id)) {
			events.push({type: 'item_removed', id})
		}
	}
	for (const item of next) {
		const before = prevById.get(item.id)
		if (!before) {
			events.push({type: 'item_added', item})
			continue
		}
		if (before.status !== item.status) {
			events.push({
				type: 'item_status_changed',
				id: item.id,
				from: before.status as TodoStatus,
				to: item.status as TodoStatus,
			})
		}
	}
	events.push({type: 'replaced', items: next})
	return events
}
