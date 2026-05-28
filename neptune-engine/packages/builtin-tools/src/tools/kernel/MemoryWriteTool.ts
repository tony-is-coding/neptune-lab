import {z} from 'zod/v4'

import type {ToolDef} from '../../tool.js'
import {buildTool} from '../../tool.js'
import type {KernelToolContext} from '../../kernel-context.js'
import {requireProtocol} from '../../kernel-context.js'
import {lazySchema} from '../../utils/lazySchema.js'

export const MEMORY_WRITE_TOOL_NAME = 'MemoryWrite'

const inputSchema = lazySchema(() =>
	z.strictObject({
		namespace: z
			.string()
			.min(1)
			.describe('Logical bucket — typically project / user / agent identity.'),
		content: z
			.string()
			.min(1)
			.describe('Natural language fact you want to remember across sessions.'),
		tags: z.array(z.string()).optional(),
		importance: z.number().min(0).max(1).optional(),
		expiresAt: z.string().datetime().optional(),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.strictObject({ref: z.string()}),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type Output = z.infer<OutputSchema>

export const MemoryWriteTool = buildTool({
	name: MEMORY_WRITE_TOOL_NAME,
	searchHint: 'remember a fact across sessions persistent memory',
	maxResultSizeChars: 1_000,
	get inputSchema(): InputSchema {
		return inputSchema()
	},
	get outputSchema(): OutputSchema {
		return outputSchema()
	},
	async description() {
		return 'Persist a piece of natural-language memory for future sessions.'
	},
	async prompt() {
		return [
			'Use MemoryWrite to remember durable facts: user preferences, decisions,',
			'or context that should survive a single session. Use sparingly — memory',
			'pollution costs context. Tag entries so MemoryRecall can filter later.',
		].join('\n')
	},
	isReadOnly() {
		return false
	},
	async checkPermissions(input) {
		return {behavior: 'allow' as const, updatedInput: input}
	},
	async call(input, context) {
		const memory = requireProtocol(context as KernelToolContext, 'memoryStore')
		const ref = await memory.put({
			namespace: input.namespace,
			content: input.content,
			...(input.tags !== undefined && {tags: input.tags}),
			...(input.importance !== undefined && {importance: input.importance}),
			...(input.expiresAt !== undefined && {expiresAt: input.expiresAt}),
		})
		return {data: {ref}}
	},
	mapToolResultToToolResultBlockParam(result, toolUseID) {
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: `Stored memory ref=${result.ref}`,
		}
	},
} satisfies ToolDef<InputSchema, Output>)
