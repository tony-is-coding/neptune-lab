import {z} from 'zod/v4'

import type {ToolDef} from '../../tool.js'
import {buildTool} from '../../tool.js'
import type {KernelToolContext} from '../../kernel-context.js'
import {requireProtocol} from '../../kernel-context.js'
import {lazySchema} from '../../utils/lazySchema.js'

export const TOOL_SEARCH_TOOL_NAME = 'ToolSearch'

const inputSchema = lazySchema(() =>
	z.strictObject({
		query: z.string().min(1),
		limit: z.number().int().min(1).max(50).optional(),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

interface SearchHit {
	name: string
	score: number
	matchedOn: 'name' | 'searchHint' | 'description'
	description?: string
}

export const ToolSearchTool = buildTool({
	name: TOOL_SEARCH_TOOL_NAME,
	searchHint: 'find a tool by capability keyword in the registry',
	maxResultSizeChars: 16_000,
	get inputSchema(): InputSchema {
		return inputSchema()
	},
	async description() {
		return 'Search the runtime tool registry for tools matching a capability keyword.'
	},
	async prompt() {
		return [
			'Use ToolSearch when you do not know which tool to call.',
			'Provide a short capability keyword (e.g. "shell", "file edit", "git diff").',
			'Returns up to `limit` (default 10) tools ordered by relevance.',
		].join('\n')
	},
	isReadOnly() {
		return true
	},
	isConcurrencySafe() {
		return true
	},
	async checkPermissions(input) {
		return {behavior: 'allow' as const, updatedInput: input}
	},
	async call(input, context): Promise<{data: SearchHit[]}> {
		const registry = requireProtocol(context as KernelToolContext, 'toolRegistry')
		const results = registry.search(input.query, input.limit ?? 10).map(r => {
			const description =
				typeof r.tool.description === 'string' ? r.tool.description : undefined
			const hit: SearchHit = {
				name: r.tool.name,
				score: r.score,
				matchedOn: r.matchedOn,
				...(description !== undefined && {description}),
			}
			return hit
		})
		return {data: results}
	},
	mapToolResultToToolResultBlockParam(result, toolUseID) {
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: JSON.stringify(result),
		}
	},
} satisfies ToolDef<InputSchema, SearchHit[]>)
