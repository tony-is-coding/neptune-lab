/**
 * InMemoryTaskQueue — engine 默认 TaskQueue 实现
 *
 * 内存 Map + AsyncIterable 派发。重启清空。够 SDK demo / 单进程多 Agent
 * 协作。持久化版本（SqliteTaskQueue / PostgresTaskQueue）实现相同接口即可
 * 替换。create/update 立即异步 resolve，但内部状态变更同步完成，所以并发
 * race 等价于 JS 单线程语义。
 */

import {randomUUID} from 'crypto'

import type {
	Task,
	TaskEvent,
	TaskFilter,
	TaskInput,
	TaskPatch,
	TaskQueue,
	TaskStatus,
} from './types.js'

interface PendingDelivery {
	resolve: (event: IteratorResult<TaskEvent>) => void
}

interface Subscriber {
	queue: TaskEvent[]
	pending: PendingDelivery | undefined
	filter: TaskFilter | undefined
	closed: boolean
}

export class InMemoryTaskQueue implements TaskQueue {
	private readonly tasks = new Map<string, Task>()
	private readonly subscribers = new Set<Subscriber>()

	async create(input: TaskInput): Promise<Task> {
		const now = new Date().toISOString()
		const task: Task = {
			id: randomUUID(),
			title: input.title,
			description: input.description,
			status: 'pending',
			owner: input.owner,
			createdBy: input.createdBy,
			blockedBy: [],
			dependsOn: input.dependsOn ? [...input.dependsOn] : [],
			metadata: input.metadata,
			createdAt: now,
			updatedAt: now,
		}
		this.tasks.set(task.id, task)
		this.publish({type: 'task_created', task})
		return task
	}

	async get(id: string): Promise<Task | undefined> {
		return this.tasks.get(id)
	}

	async list(filter?: TaskFilter): Promise<readonly Task[]> {
		const all = [...this.tasks.values()]
		const filtered = filter ? all.filter(t => matchesFilter(t, filter)) : all
		return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
	}

	async update(id: string, patch: TaskPatch): Promise<Task> {
		const prev = this.tasks.get(id)
		if (!prev) {
			throw new Error(`task not found: ${id}`)
		}
		const next: Task = {
			...prev,
			...(patch.status !== undefined && {status: patch.status}),
			...(patch.title !== undefined && {title: patch.title}),
			...(patch.description !== undefined && {description: patch.description}),
			...(patch.owner === null
				? {owner: undefined}
				: patch.owner !== undefined
					? {owner: patch.owner}
					: {}),
			...(patch.blockedBy !== undefined && {blockedBy: [...patch.blockedBy]}),
			...(patch.dependsOn !== undefined && {dependsOn: [...patch.dependsOn]}),
			...(patch.output !== undefined && {output: patch.output}),
			...(patch.metadata !== undefined && {metadata: patch.metadata}),
			updatedAt: new Date().toISOString(),
		}
		this.tasks.set(id, next)
		this.publish({type: 'task_updated', task: next, patch})
		return next
	}

	async stop(id: string, reason?: string): Promise<void> {
		const prev = this.tasks.get(id)
		if (!prev) return
		const next: Task = {
			...prev,
			status: 'cancelled',
			updatedAt: new Date().toISOString(),
		}
		this.tasks.set(id, next)
		this.publish({type: 'task_stopped', id, reason})
	}

	async *events(
		filter?: TaskFilter,
		signal?: AbortSignal,
	): AsyncIterable<TaskEvent> {
		const sub: Subscriber = {queue: [], pending: undefined, filter, closed: false}
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
				const event = await new Promise<TaskEvent | undefined>(resolve => {
					sub.pending = {
						resolve(result) {
							resolve(result.done ? undefined : result.value)
						},
					}
				})
				if (event === undefined) return
				yield event
			}
		} finally {
			signal?.removeEventListener('abort', onAbort)
			this.subscribers.delete(sub)
		}
	}

	private publish(event: TaskEvent): void {
		for (const sub of this.subscribers) {
			if (sub.closed) continue
			if (!matchesEvent(event, sub.filter, this.tasks)) continue
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

function matchesFilter(task: Task, filter: TaskFilter): boolean {
	if (filter.status !== undefined) {
		const allowed = Array.isArray(filter.status)
			? new Set<TaskStatus>(filter.status as TaskStatus[])
			: new Set<TaskStatus>([filter.status as TaskStatus])
		if (!allowed.has(task.status)) return false
	}
	if (filter.owner !== undefined && task.owner !== filter.owner) return false
	if (filter.createdBy !== undefined && task.createdBy !== filter.createdBy) return false
	if (filter.hasOwner === true && !task.owner) return false
	if (filter.hasOwner === false && task.owner) return false
	return true
}

function matchesEvent(
	event: TaskEvent,
	filter: TaskFilter | undefined,
	tasks: Map<string, Task>,
): boolean {
	if (!filter) return true
	if (event.type === 'task_stopped') {
		const t = tasks.get(event.id)
		return !t || matchesFilter(t, filter)
	}
	return matchesFilter(event.task, filter)
}
