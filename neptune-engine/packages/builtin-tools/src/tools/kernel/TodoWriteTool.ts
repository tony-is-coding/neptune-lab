/**
 * TodoWriteTool — 单 Agent 内自管 todo 列表的核心工具。
 *
 * model 总是发完整版，runtime 替换 ctx.todoState 当前快照。
 * 必须由 host 注入 ctx.kernel.todoState；未注入时直接抛错。
 */

import {z} from 'zod/v4'

import type {ToolDef} from '../../tool.js'
import {buildTool} from '../../tool.js'
import type {KernelToolContext} from '../../kernel-context.js'
import {requireProtocol} from '../../kernel-context.js'
import {lazySchema} from '../../utils/lazySchema.js'

export const TODO_WRITE_TOOL_NAME = 'TodoWrite'

const inputSchema = lazySchema(() =>
	z.strictObject({
		items: z
			.array(
				z.strictObject({
					id: z.string().min(1),
					content: z.string().min(1),
					status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
					linkedTaskId: z.string().optional(),
				}),
			)
			.describe('Replacement list of todo items for the current session.'),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.strictObject({
		count: z.number().int().min(0),
	}),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type Output = z.infer<OutputSchema>

export const TodoWriteTool = buildTool({
	name: TODO_WRITE_TOOL_NAME,
	searchHint: 'multi-step plan todo list checklist progress tracking',
	maxResultSizeChars: 8_000,
	get inputSchema(): InputSchema {
		return inputSchema()
	},
	get outputSchema(): OutputSchema {
		return outputSchema()
	},
	async description() {
		return 'Replace the current session todo list with a fresh plan.'
	},
	async prompt() {
		return [
			'Use TodoWrite to maintain a structured plan for the current session.',
			'Always send the complete list — items not in your call are removed.',
			'Statuses: pending | in_progress | completed | cancelled.',
			'Use this tool when a request needs more than one or two concrete steps.',
		].join('\n')
	},
	isReadOnly() {
		return false
	},
	isConcurrencySafe() {
		return false
	},
	async checkPermissions(input) {
		return {behavior: 'allow' as const, updatedInput: input}
	},
	async call(input, context) {
		const todo = requireProtocol(context as KernelToolContext, 'todoState')
		await todo.replace(input.items)
		return {data: {count: input.items.length}}
	},
	mapToolResultToToolResultBlockParam(result, toolUseID) {
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: `Recorded ${result.count} todo items.`,
		}
	},
} satisfies ToolDef<InputSchema, Output>)
