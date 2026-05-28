import {z} from 'zod/v4'

import type {ToolDef} from '../../tool.js'
import {buildTool} from '../../tool.js'
import type {KernelToolContext} from '../../kernel-context.js'
import {requireProtocol} from '../../kernel-context.js'
import type {MemoryEntry} from '@neptune/engine'
import {lazySchema} from '../../utils/lazySchema.js'

export const MEMORY_RECALL_TOOL_NAME = 'MemoryRecall'

const inputSchema = lazySchema(() =>
	z.strictObject({
		namespace: z.string().optional(),
		text: z
			.string()
			.optional()
			.describe('Optional keyword/phrase to filter recalled memories.'),
		tags: z.array(z.string()).optional(),
		since: z
			.string()
			.datetime()
			.optional()
			.describe('Only return memories created at/after this ISO timestamp.'),
		limit: z.number().int().min(1).max(50).optional(),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

export const MemoryRecallTool = buildTool({
	name: MEMORY_RECALL_TOOL_NAME,
	searchHint: 'recall stored memory facts across sessions',
	maxResultSizeChars: 32_000,
	get inputSchema(): InputSchema {
		return inputSchema()
	},
	async description() {
		return 'Recall stored memory entries filtered by text / tags / namespace / time.'
	},
	async prompt() {
		return [
			'Use MemoryRecall to look up facts you stored with MemoryWrite.',
			'All filters are AND-ed; omit them to dump the full namespace.',
			'Results are ordered by importance desc, then createdAt desc.',
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
	async call(input, context): Promise<{data: readonly MemoryEntry[]}> {
		const memory = requireProtocol(context as KernelToolContext, 'memoryStore')
		const results = await memory.search({
			...(input.namespace !== undefined && {namespace: input.namespace}),
			...(input.text !== undefined && {text: input.text}),
			...(input.tags !== undefined && {tags: input.tags}),
			...(input.since !== undefined && {since: input.since}),
			...(input.limit !== undefined && {limit: input.limit}),
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
} satisfies ToolDef<InputSchema, readonly MemoryEntry[]>)
