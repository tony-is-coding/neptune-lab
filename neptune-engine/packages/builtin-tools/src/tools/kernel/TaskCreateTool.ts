import {z} from 'zod/v4'

import type {ToolDef} from '../../tool.js'
import {buildTool} from '../../tool.js'
import type {KernelToolContext} from '../../kernel-context.js'
import {requireProtocol} from '../../kernel-context.js'
import {lazySchema} from '../../utils/lazySchema.js'

export const TASK_CREATE_TOOL_NAME = 'TaskCreate'

const inputSchema = lazySchema(() =>
	z.strictObject({
		title: z.string().min(1),
		description: z.string().optional(),
		owner: z.string().optional(),
		dependsOn: z.array(z.string()).optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.strictObject({
		id: z.string(),
		status: z.string(),
	}),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type Output = z.infer<OutputSchema>

export const TaskCreateTool = buildTool({
	name: TASK_CREATE_TOOL_NAME,
	searchHint: 'create new task in shared multi-agent task queue',
	maxResultSizeChars: 4_000,
	get inputSchema(): InputSchema {
		return inputSchema()
	},
	get outputSchema(): OutputSchema {
		return outputSchema()
	},
	async description() {
		return 'Create a new task in the shared multi-agent task queue.'
	},
	async prompt() {
		return [
			'Use TaskCreate to register a unit of work that may be picked up by you',
			'or another teammate. The runtime returns a task id you can later update',
			'with TaskUpdate, query with TaskGet, or end with TaskStop.',
		].join('\n')
	},
	isReadOnly() {
		return false
	},
	async checkPermissions(input) {
		return {behavior: 'allow' as const, updatedInput: input}
	},
	async call(input, context) {
		const queue = requireProtocol(context as KernelToolContext, 'taskQueue')
		const createdBy =
			((context as KernelToolContext).agentId as string | undefined) ?? 'self'
		const task = await queue.create({
			title: input.title,
			description: input.description,
			owner: input.owner,
			dependsOn: input.dependsOn,
			metadata: input.metadata,
			createdBy,
		})
		return {data: {id: task.id, status: task.status}}
	},
	mapToolResultToToolResultBlockParam(result, toolUseID) {
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: `Created task ${result.id} (status: ${result.status})`,
		}
	},
} satisfies ToolDef<InputSchema, Output>)
