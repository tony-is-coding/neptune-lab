/**
 * TaskQueue Protocol — 多 Agent 间的共享任务队列
 *
 * 设计原则（docs/strategy/neptune-engine-runtime-kernel-design.md §5）：
 * - 第一阶段 InMemory 默认实现够用，但接口必须为持久化预留：
 *   * 所有写操作返回 Promise<T>（持久化版必然异步）
 *   * 不暴露内部容器，list() 返回不可变快照
 *   * events() 用 AsyncIterable，便于持久化版用 polling/LISTEN/NOTIFY 实现
 *   * update 返回更新后的完整 Task，便于持久化版做 optimistic concurrency
 * - per-session 注入，零全局 state
 * - 与 TodoState 区分：TodoState 单 Agent 自管，TaskQueue 跨 Agent
 */

export type AgentRef = string

export type TaskStatus =
	| 'pending'
	| 'in_progress'
	| 'blocked'
	| 'completed'
	| 'cancelled'
	| 'failed'

export interface TaskOutput {
	readonly summary: string
	/** Artifact 引用（kind 自定义，ref 是不透明 ID，由 product artifact store 解释） */
	readonly artifacts?: readonly {readonly kind: string; readonly ref: string}[]
	readonly metadata?: Readonly<Record<string, unknown>>
}

export interface Task {
	readonly id: string
	readonly title: string
	readonly description?: string
	readonly status: TaskStatus
	readonly owner?: AgentRef
	readonly createdBy: AgentRef
	readonly blockedBy: readonly string[]
	readonly dependsOn: readonly string[]
	readonly output?: TaskOutput
	readonly metadata?: Readonly<Record<string, unknown>>
	readonly createdAt: string
	readonly updatedAt: string
}

export interface TaskInput {
	readonly title: string
	readonly description?: string
	readonly createdBy: AgentRef
	readonly owner?: AgentRef
	readonly dependsOn?: readonly string[]
	readonly metadata?: Readonly<Record<string, unknown>>
}

export interface TaskPatch {
	readonly status?: TaskStatus
	readonly title?: string
	readonly description?: string
	readonly owner?: AgentRef | null
	readonly blockedBy?: readonly string[]
	readonly dependsOn?: readonly string[]
	readonly output?: TaskOutput
	readonly metadata?: Readonly<Record<string, unknown>>
}

export interface TaskFilter {
	readonly status?: TaskStatus | readonly TaskStatus[]
	readonly owner?: AgentRef
	readonly createdBy?: AgentRef
	readonly hasOwner?: boolean
}

export type TaskEvent =
	| {readonly type: 'task_created'; readonly task: Task}
	| {readonly type: 'task_updated'; readonly task: Task; readonly patch: TaskPatch}
	| {readonly type: 'task_stopped'; readonly id: string; readonly reason?: string}

export interface TaskQueue {
	create(input: TaskInput): Promise<Task>

	get(id: string): Promise<Task | undefined>

	list(filter?: TaskFilter): Promise<readonly Task[]>

	update(id: string, patch: TaskPatch): Promise<Task>

	stop(id: string, reason?: string): Promise<void>

	events(filter?: TaskFilter, signal?: AbortSignal): AsyncIterable<TaskEvent>
}
