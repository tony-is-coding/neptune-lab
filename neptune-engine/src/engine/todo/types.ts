/**
 * TodoState Protocol — 单 Agent 内自管的多步规划清单
 *
 * 设计原则（来自 docs/strategy/neptune-engine-runtime-kernel-design.md §6）：
 * - 与 TaskQueue 区分：TaskQueue 跨 Agent，TodoState 单 Agent 内
 * - per-session 注入，零全局 state；session 销毁后实例丢弃
 * - replace() 是因为 model 总是发完整版（不增量），便于 prompt 显示当前规划
 * - events() 流式输出，便于 host 实时渲染或观察
 */

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export interface TodoItem {
	readonly id: string
	readonly content: string
	readonly status: TodoStatus
	/** 可选：这条 todo 关联到 TaskQueue 中哪个 task（跨协议引用） */
	readonly linkedTaskId?: string
}

/** Todo 状态变化事件。replace 时按"前 -> 后"对比派发若干条 */
export type TodoEvent =
	| {readonly type: 'replaced'; readonly items: readonly TodoItem[]}
	| {readonly type: 'item_added'; readonly item: TodoItem}
	| {readonly type: 'item_status_changed'; readonly id: string; readonly from: TodoStatus; readonly to: TodoStatus}
	| {readonly type: 'item_removed'; readonly id: string}

export interface TodoState {
	/** 替换当前 session 的整个 todo list（model 总发完整版） */
	replace(items: readonly TodoItem[]): Promise<void>

	/** 读取当前快照 */
	current(): readonly TodoItem[]

	/** 订阅变化（async iterable 方便 polling/persistent 适配器） */
	events(signal?: AbortSignal): AsyncIterable<TodoEvent>
}
