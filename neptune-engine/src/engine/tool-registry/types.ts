/**
 * ToolRegistry Protocol — 工具注册与发现
 *
 * 设计原则（docs/strategy/neptune-engine-runtime-kernel-design.md §8）：
 * - per-session 注入；不同 session 可看不同工具子集
 * - register/unregister 异步（适配持久化或动态加载场景）
 * - search 默认实现基于 name + searchHint + description 做关键词匹配，
 *   product 可替换为向量检索 / 语义匹配
 */

import type {Tool} from '../types/tool.js'

export interface ToolFilter {
	/** 名字前缀过滤（'mcp__' / 'product__'） */
	readonly namePrefix?: string
	/** 排除 names */
	readonly excludeNames?: readonly string[]
}

export interface ToolSearchResult {
	readonly tool: Tool
	readonly score: number
	readonly matchedOn: 'name' | 'searchHint' | 'description'
}

export interface ToolRegistry {
	register(tool: Tool): Promise<void>

	unregister(name: string): Promise<void>

	get(name: string): Tool | undefined

	list(filter?: ToolFilter): readonly Tool[]

	search(query: string, limit?: number): readonly ToolSearchResult[]
}
