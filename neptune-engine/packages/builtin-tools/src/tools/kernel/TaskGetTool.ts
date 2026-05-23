import {z} from 'zod/v4'

import type {ToolDef} from '../../tool.js'
import {buildTool} from '../../tool.js'
import type {KernelToolContext} from '../../kernel-context.js'
import {requireProtocol} from '../../kernel-context.js'
import type {Task} from '@neptune/engine'
import {lazySchema} from '../../utils/lazySchema.js'

export const TASK_GET_TOOL_NAME = 'TaskGet'

const inputSchema = lazySchema(() =>
	z.strictObject({id: z.string().min(1)}),
)
type InputSchema = ReturnType<typeof inputSchema>

export const TaskGetTool = buildTool({
	name: TASK_GET_TOOL_NAME,
	searchHint: 'fetch a single task from the multi-agent task queue',
	maxResultSizeChars: 8_000,
	get inputSchema(): InputSchema {
		return inputSchema()
	},
	async description() {
		return 'Fetch a task by id from the shared task queue.'
	},
	async prompt() {
		return 'Use TaskGet to read the current state of a task. Returns null when the id is unknown.'
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
	async call(input, context): Promise<{data: Task | null}> {
		const queue = requireProtocol(context as KernelToolContext, 'taskQueue')
		const task = await queue.get(input.id)
		return {data: task ?? null}
	},
	mapToolResultToToolResultBlockParam(result, toolUseID) {
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: result === null ? 'null' : JSON.stringify(result),
		}
	},
} satisfies ToolDef<InputSchema, Task | null>)
