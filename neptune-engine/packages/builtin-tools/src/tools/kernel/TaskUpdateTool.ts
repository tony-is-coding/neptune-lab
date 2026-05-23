import {z} from 'zod/v4'

import type {ToolDef} from '../../tool.js'
import {buildTool} from '../../tool.js'
import type {KernelToolContext} from '../../kernel-context.js'
import {requireProtocol} from '../../kernel-context.js'
import type {Task, TaskPatch} from '@neptune/engine'
import {lazySchema} from '../../utils/lazySchema.js'

export const TASK_UPDATE_TOOL_NAME = 'TaskUpdate'

const STATUSES = [
	'pending',
	'in_progress',
	'blocked',
	'completed',
	'cancelled',
	'failed',
] as const

const inputSchema = lazySchema(() =>
	z.strictObject({
		id: z.string().min(1),
		status: z.enum(STATUSES).optional(),
		title: z.string().optional(),
		description: z.string().optional(),
		owner: z
			.string()
			.nullable()
			.optional()
			.describe('Set to null to clear the owner.'),
		blockedBy: z.array(z.string()).optional(),
		dependsOn: z.array(z.string()).optional(),
		output: z
			.object({
				summary: z.string(),
				artifacts: z
					.array(z.object({kind: z.string(), ref: z.string()}))
					.optional(),
				metadata: z.record(z.string(), z.unknown()).optional(),
			})
			.optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

export const TaskUpdateTool = buildTool({
	name: TASK_UPDATE_TOOL_NAME,
	searchHint: 'update a task in the multi-agent task queue',
	maxResultSizeChars: 4_000,
	get inputSchema(): InputSchema {
		return inputSchema()
	},
	async description() {
		return 'Update a task in the shared task queue.'
	},
	async prompt() {
		return [
			'Use TaskUpdate to change task status, owner, dependencies, or report final output.',
			'To clear an owner pass owner: null. Provide only the fields you want to change.',
		].join('\n')
	},
	isReadOnly() {
		return false
	},
	async checkPermissions(input) {
		return {behavior: 'allow' as const, updatedInput: input}
	},
	async call(input, context): Promise<{data: Task}> {
		const queue = requireProtocol(context as KernelToolContext, 'taskQueue')
		const {id, ...rawPatch} = input
		const patch: TaskPatch = rawPatch as TaskPatch
		const updated = await queue.update(id, patch)
		return {data: updated}
	},
	mapToolResultToToolResultBlockParam(result, toolUseID) {
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: `Task ${result.id} now ${result.status} (owner: ${result.owner ?? 'unassigned'})`,
		}
	},
} satisfies ToolDef<InputSchema, Task>)
