import {z} from 'zod/v4'

import type {ToolDef} from '../../tool.js'
import {buildTool} from '../../tool.js'
import type {KernelToolContext} from '../../kernel-context.js'
import {requireProtocol} from '../../kernel-context.js'
import type {Task, TaskStatus} from '@neptune/engine'
import {lazySchema} from '../../utils/lazySchema.js'

export const TASK_LIST_TOOL_NAME = 'TaskList'

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
		status: z.enum(STATUSES).optional(),
		owner: z.string().optional(),
		hasOwner: z.boolean().optional(),
		createdBy: z.string().optional(),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

export const TaskListTool = buildTool({
	name: TASK_LIST_TOOL_NAME,
	searchHint: 'list tasks from the multi-agent task queue',
	maxResultSizeChars: 32_000,
	get inputSchema(): InputSchema {
		return inputSchema()
	},
	async description() {
		return 'List tasks in the shared task queue, optionally filtered by status / owner.'
	},
	async prompt() {
		return [
			'Use TaskList to discover work. Filter by status / owner / hasOwner / createdBy.',
			'Returns task summaries ordered by creation time (oldest first).',
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
	async call(input, context): Promise<{data: readonly Task[]}> {
		const queue = requireProtocol(context as KernelToolContext, 'taskQueue')
		const tasks = await queue.list({
			...(input.status !== undefined && {
				status: input.status as TaskStatus,
			}),
			...(input.owner !== undefined && {owner: input.owner}),
			...(input.hasOwner !== undefined && {hasOwner: input.hasOwner}),
			...(input.createdBy !== undefined && {createdBy: input.createdBy}),
		})
		return {data: tasks}
	},
	mapToolResultToToolResultBlockParam(result, toolUseID) {
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: JSON.stringify(result),
		}
	},
} satisfies ToolDef<InputSchema, readonly Task[]>)
