import {z} from 'zod/v4'

import type {ToolDef} from '../../tool.js'
import {buildTool} from '../../tool.js'
import type {KernelToolContext} from '../../kernel-context.js'
import {requireProtocol} from '../../kernel-context.js'
import type {Task, TaskOutput} from '@neptune/engine'
import {lazySchema} from '../../utils/lazySchema.js'

export const TASK_OUTPUT_TOOL_NAME = 'TaskOutput'

const inputSchema = lazySchema(() =>
	z.strictObject({
		id: z.string().min(1),
		summary: z.string().min(1),
		artifacts: z
			.array(z.strictObject({kind: z.string(), ref: z.string()}))
			.optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
		markCompleted: z
			.boolean()
			.optional()
			.describe('When true, also transitions task to status=completed.'),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

export const TaskOutputTool = buildTool({
	name: TASK_OUTPUT_TOOL_NAME,
	searchHint: 'attach final output / artifacts to a task',
	maxResultSizeChars: 4_000,
	get inputSchema(): InputSchema {
		return inputSchema()
	},
	async description() {
		return 'Attach the final output of a task: summary + optional artifact refs.'
	},
	async prompt() {
		return [
			'Use TaskOutput when you have completed a task and want to record its result.',
			'`summary` is the model-readable description of what was done.',
			'`artifacts` are opaque refs into the host artifact store (kind+ref pair).',
			'Pass markCompleted: true to also flip the task to status=completed in one call.',
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
		const output: TaskOutput = {
			summary: input.summary,
			...(input.artifacts !== undefined && {artifacts: input.artifacts}),
			...(input.metadata !== undefined && {metadata: input.metadata}),
		}
		const updated = await queue.update(input.id, {
			output,
			...(input.markCompleted === true && {status: 'completed'}),
		})
		return {data: updated}
	},
	mapToolResultToToolResultBlockParam(result, toolUseID) {
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: `Task ${result.id} output recorded; status=${result.status}`,
		}
	},
} satisfies ToolDef<InputSchema, Task>)
