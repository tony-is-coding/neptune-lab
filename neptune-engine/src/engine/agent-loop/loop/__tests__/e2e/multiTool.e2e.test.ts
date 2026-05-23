/**
 * AgentLoop e2e — 跨多个 kernel tool + 多轮的工作流
 *
 * 模拟：用户说"plan + create"
 *   turn 1: 模型 emit tool_use(TodoWrite) + tool_use(TaskCreate)
 *   turn 2: engine 执行两个工具 → tool_result × 2
 *   turn 3: 模型说 "done"
 *
 * 这验证：
 * - 一轮内多个 tool_use 块
 * - kernel 多 protocol 同时工作（todoState + taskQueue）
 * - tool_result 数组正确反馈
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import {AgentLoop} from '../../AgentLoop.js'
import {createToolUseContext} from '../../../dispatcher/ToolUseContext.js'
import {ScriptedProvider, textTurn} from '../scriptedProvider.js'
import type {Message} from '../../../../types/message.js'
import type {Tool} from '../../../../types/tool.js'
import type {ParsedSSEEvent} from '../../../types.js'
import {TodoWriteTool} from '../../../../../../packages/builtin-tools/src/tools/kernel/TodoWriteTool.js'
import {TaskCreateTool} from '../../../../../../packages/builtin-tools/src/tools/kernel/TaskCreateTool.js'
import {InMemoryTodoState} from '../../../../todo/index.js'
import {InMemoryTaskQueue} from '../../../../task-queue/index.js'

function withSchema(tool: Tool, schema: Record<string, unknown>): Tool {
	return {...tool, inputJSONSchema: schema} as unknown as Tool
}

function userMsg(text: string): Message {
	return {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'user', content: text},
	}
}

/** 模型在一轮里 emit 两个 tool_use 块。 */
function twoToolUseTurn(): ParsedSSEEvent[] {
	return [
		{
			type: 'message_start',
			message: {
				id: 'msg_two',
				role: 'assistant',
				model: 'm',
				type: 'message',
				stop_reason: null,
				stop_sequence: null,
				usage: {
					input_tokens: 30,
					output_tokens: 1,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
			},
		},
		{
			type: 'content_block_complete',
			index: 0,
			block: {type: 'text', text: 'Setting up plan and task.'},
		},
		{
			type: 'content_block_complete',
			index: 1,
			block: {
				type: 'tool_use',
				id: 'tu_todo',
				name: 'TodoWrite',
				input: {
					items: [{id: '1', content: 'do thing', status: 'pending'}],
				},
			},
		},
		{
			type: 'content_block_complete',
			index: 2,
			block: {
				type: 'tool_use',
				id: 'tu_task',
				name: 'TaskCreate',
				input: {title: 'thing', description: 'do thing properly'},
			},
		},
		{
			type: 'message_delta',
			usage: {
				input_tokens: 0,
				output_tokens: 50,
				cache_creation_input_tokens: 0,
				cache_read_input_tokens: 0,
			},
			stop_reason: 'tool_use',
		},
		{type: 'message_stop'},
	]
}

describe('AgentLoop e2e: multi-tool kernel workflow', () => {
	it('一轮内多个 tool_use → 两个 protocol 都被写入 → 模型 end_turn', async () => {
		const todoState = new InMemoryTodoState()
		const taskQueue = new InMemoryTaskQueue()

		const todoSchema = {
			type: 'object',
			properties: {items: {type: 'array', items: {type: 'object'}}},
			required: ['items'],
		}
		const taskSchema = {
			type: 'object',
			properties: {
				title: {type: 'string'},
				description: {type: 'string'},
			},
			required: ['title'],
		}

		const todoTool = withSchema(TodoWriteTool as unknown as Tool, todoSchema)
		const taskTool = withSchema(TaskCreateTool as unknown as Tool, taskSchema)
		const tools = [todoTool, taskTool]

		const provider = new ScriptedProvider([twoToolUseTurn(), textTurn('All set.')])
		const ctx = createToolUseContext({tools, kernel: {todoState, taskQueue}})

		const gen = AgentLoop.run({
			provider,
			messages: [userMsg('plan + create')],
			model: 'm',
			tools,
			context: ctx,
		})
		let result
		while (true) {
			const next = await gen.next()
			if (next.done) {
				result = next.value
				break
			}
		}

		expect((result as {reason: string}).reason).toBe('end_turn')
		expect((result as {turnCount: number}).turnCount).toBe(2)

		// 两个 protocol 都被写入
		expect(todoState.current()).toHaveLength(1)
		expect(todoState.current()[0]?.id).toBe('1')

		const tasks = await taskQueue.list()
		expect(tasks).toHaveLength(1)
		expect(tasks[0]?.title).toBe('thing')
		expect(tasks[0]?.description).toBe('do thing properly')

		// tool_result 数组（一轮 2 个）
		const finalMessages = (result as {finalMessages: Message[]}).finalMessages
		expect(finalMessages).toHaveLength(4)
		const trContent = finalMessages[2].message?.content as unknown as Array<{
			type: string
			tool_use_id: string
			is_error?: boolean
		}>
		expect(trContent).toHaveLength(2)
		expect(trContent[0]?.tool_use_id).toBe('tu_todo')
		expect(trContent[1]?.tool_use_id).toBe('tu_task')
		expect(trContent[0]?.is_error).toBeUndefined()
		expect(trContent[1]?.is_error).toBeUndefined()
	})

	it('一轮内一个 tool 抛错另一个成功 → 两个都进 tool_result（一个 is_error）', async () => {
		const todoState = new InMemoryTodoState()
		const taskQueue = new InMemoryTaskQueue()

		const todoTool = withSchema(TodoWriteTool as unknown as Tool, {
			type: 'object',
			properties: {items: {type: 'array', items: {type: 'object'}}},
			required: ['items'],
		})
		const taskTool = withSchema(TaskCreateTool as unknown as Tool, {
			type: 'object',
			properties: {title: {type: 'string'}},
			required: ['title'],
		})

		// 模型 emit 一个有效 tool_use + 一个未知 tool（模型 hallucinate）
		const turn: ParsedSSEEvent[] = [
			{
				type: 'message_start',
				message: {
					id: 'msg_x',
					role: 'assistant',
					model: 'm',
					type: 'message',
					stop_reason: null,
					stop_sequence: null,
					usage: {
						input_tokens: 30,
						output_tokens: 1,
						cache_creation_input_tokens: 0,
						cache_read_input_tokens: 0,
					},
				},
			},
			{
				type: 'content_block_complete',
				index: 0,
				block: {
					type: 'tool_use',
					id: 'tu_real',
					name: 'TodoWrite',
					input: {items: [{id: 'a', content: 'do', status: 'pending'}]},
				},
			},
			{
				type: 'content_block_complete',
				index: 1,
				block: {
					type: 'tool_use',
					id: 'tu_fake',
					name: 'NonExistent',
					input: {},
				},
			},
			{
				type: 'message_delta',
				usage: {
					input_tokens: 0,
					output_tokens: 30,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
				stop_reason: 'tool_use',
			},
			{type: 'message_stop'},
		]
		const provider = new ScriptedProvider([turn, textTurn('I noted the error.')])
		const ctx = createToolUseContext({
			tools: [todoTool, taskTool],
			kernel: {todoState, taskQueue},
		})

		const gen = AgentLoop.run({
			provider,
			messages: [userMsg('do stuff')],
			model: 'm',
			tools: [todoTool, taskTool],
			context: ctx,
		})
		let result
		while (true) {
			const next = await gen.next()
			if (next.done) {
				result = next.value
				break
			}
		}

		expect((result as {reason: string}).reason).toBe('end_turn')

		// TodoWrite 成功执行
		expect(todoState.current()).toHaveLength(1)

		// 两个 tool_result 都在
		const finalMessages = (result as {finalMessages: Message[]}).finalMessages
		const trContent = finalMessages[2].message?.content as unknown as Array<{
			tool_use_id: string
			is_error?: boolean
			content: string
		}>
		expect(trContent).toHaveLength(2)
		expect(trContent[0]?.tool_use_id).toBe('tu_real')
		expect(trContent[0]?.is_error).toBeUndefined()
		expect(trContent[1]?.tool_use_id).toBe('tu_fake')
		expect(trContent[1]?.is_error).toBe(true)
		expect(trContent[1]?.content).toContain('Unknown tool')
	})
})
