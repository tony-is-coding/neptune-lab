/**
 * Memory Protocol — Agent 跨 session 的事实持有
 *
 * 设计原则（docs/strategy/neptune-engine-runtime-kernel-design.md §7）：
 * - Memory 不是消息历史，是 Agent 主动选择保留的事实
 * - per-session 注入，零全局 state；同一 product 可以有多个 session 共享
 *   一个底层 MemoryStore（product 适配器自行决定共享语义），但 engine
 *   不假设全局
 * - 写操作返回 ref（不透明 ID），用于后续 get/delete
 * - search 是命名约定：可基于关键词、可基于 embedding、可基于时间窗口
 *   —— 默认实现做关键词匹配，product 可替换
 */

export type MemoryRef = string

export interface MemorySource {
	readonly sessionId?: string
	readonly toolUseId?: string
	readonly reason?: string
}

export interface MemoryEntryInput {
	readonly namespace: string
	readonly content: string
	readonly tags?: readonly string[]
	readonly importance?: number
	readonly expiresAt?: string
	readonly source?: MemorySource
}

export interface MemoryEntry extends MemoryEntryInput {
	readonly ref: MemoryRef
	readonly createdAt: string
}

export interface MemoryQuery {
	readonly namespace?: string
	readonly text?: string
	readonly tags?: readonly string[]
	readonly since?: string
	readonly limit?: number
}

export interface MemoryStore {
	put(entry: MemoryEntryInput): Promise<MemoryRef>

	get(ref: MemoryRef): Promise<MemoryEntry | undefined>

	delete(ref: MemoryRef): Promise<void>

	search(query: MemoryQuery): Promise<readonly MemoryEntry[]>

	list(namespace?: string): AsyncIterable<MemoryEntry>
}
