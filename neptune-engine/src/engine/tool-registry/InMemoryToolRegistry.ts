/**
 * InMemoryToolRegistry — 默认 ToolRegistry 实现
 *
 * 关键词匹配打分：
 *   name 完全相等        => 1.0
 *   name 包含 query      => 0.85
 *   searchHint 包含 query => 0.65
 *   description 包含 query => 0.45
 *   均不匹配             => 不返回
 *
 * 这是"够用"的默认；product 想要 BM25 / embedding 检索可以替换 search()。
 */

import type {Tool} from '../types/tool.js'
import type {ToolFilter, ToolRegistry, ToolSearchResult} from './types.js'

export class InMemoryToolRegistry implements ToolRegistry {
	private readonly tools = new Map<string, Tool>()

	async register(tool: Tool): Promise<void> {
		this.tools.set(tool.name, tool)
	}

	async unregister(name: string): Promise<void> {
		this.tools.delete(name)
	}

	get(name: string): Tool | undefined {
		return this.tools.get(name)
	}

	list(filter?: ToolFilter): readonly Tool[] {
		let arr = [...this.tools.values()]
		if (filter?.namePrefix) {
			arr = arr.filter(t => t.name.startsWith(filter.namePrefix!))
		}
		if (filter?.excludeNames && filter.excludeNames.length > 0) {
			const exclude = new Set(filter.excludeNames)
			arr = arr.filter(t => !exclude.has(t.name))
		}
		return arr.sort((a, b) => a.name.localeCompare(b.name))
	}

	search(query: string, limit = 10): readonly ToolSearchResult[] {
		const q = query.trim().toLowerCase()
		if (!q) return []
		const out: ToolSearchResult[] = []
		for (const tool of this.tools.values()) {
			const result = scoreTool(tool, q)
			if (result) out.push({tool, ...result})
		}
		out.sort((a, b) => b.score - a.score)
		return out.slice(0, limit)
	}
}

function scoreTool(
	tool: Tool,
	q: string,
): {score: number; matchedOn: ToolSearchResult['matchedOn']} | undefined {
	const name = tool.name.toLowerCase()
	if (name === q) return {score: 1, matchedOn: 'name'}
	if (name.includes(q)) return {score: 0.85, matchedOn: 'name'}
	const hint = (tool.searchHint as string | undefined)?.toLowerCase()
	if (hint?.includes(q)) return {score: 0.65, matchedOn: 'searchHint'}
	const description =
		typeof tool.description === 'string' ? tool.description.toLowerCase() : undefined
	if (description?.includes(q)) return {score: 0.45, matchedOn: 'description'}
	return undefined
}
