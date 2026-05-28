import {z} from 'zod/v4'

import type {ToolDef} from '../../tool.js'
import {buildTool} from '../../tool.js'
import type {KernelToolContext} from '../../kernel-context.js'
import {requireProtocol} from '../../kernel-context.js'
import {lazySchema} from '../../utils/lazySchema.js'

export const TASK_STOP_TOOL_NAME = 'TaskStop'

const inputSchema = lazySchema(() =>
	z.strictObject({
		id: z.string().min(1),
		reason: z.string().optional(),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.strictObject({stopped: z.boolean()}),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type Output = z.infer<OutputSchema>

export const TaskStopTool = buildTool({
	name: TASK_STOP_TOOL_NAME,
	searchHint: 'cancel a task in the multi-agent task queue',
	maxResultSizeChars: 1_000,
	get inputSchema(): InputSchema {
		return inputSchema()
	},
	get outputSchema(): OutputSchema {
		return outputSchema()
	},
	async description() {
		return 'Cancel a task in the shared task queue.'
	},
	async prompt() {
		return [
			'Use TaskStop to abort a task that is no longer needed or cannot be completed.',
			'Provide a short reason for audit trail.',
		].join('\n')
	},
	isReadOnly() {
		return false
	},
	isDestructive() {
		return true
	},
	async checkPermissions(input) {
		return {behavior: 'allow' as const, updatedInput: input}
	},
	async call(input, context) {
		const queue = requireProtocol(context as KernelToolContext, 'taskQueue')
		await queue.stop(input.id, input.reason)
		return {data: {stopped: true}}
	},
	mapToolResultToToolResultBlockParam(result, toolUseID) {
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: result.stopped ? 'Task stopped.' : 'Task not found.',
		}
	},
} satisfies ToolDef<InputSchema, Output>)
