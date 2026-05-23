/**
 * AgentLoop e2e — TodoWrite kernel tool 端到端集成
 *
 * 这是 M1 milestone 的关键验证：模拟 Claude Code 用户对话
 *   "请规划这次任务" → 模型 emit tool_use(TodoWrite) → engine 执行 →
 *   tool_result 反馈给模型 → 模型说 "Done!" → end_turn
 *
 * 用 ScriptedProvider 模拟模型行为，用 Phase B 真实的 TodoWriteTool +
 * Phase A InMemoryTodoState 跑 multi-turn loop。
 *
 * 注意：Phase B 工具用 zod schema 不带 inputJSONSchema，
 * e2e helper 临时手写 JSON schema 兜底。后续 batch 应在 ToolRegistry 层
 * 提供 zod→JSON schema 转换。
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import {AgentLoop} from '../../AgentLoop.js'
import {createToolUseContext} from '../../../dispatcher/ToolUseContext.js'
import {ScriptedProvider, toolUseTurn, textTurn} from '../scriptedProvider.js'
import type {LoopEvent} from '../../loopEvents.js'
import type {Message} from '../../../../types/message.js'
import type {Tool} from '../../../../types/tool.js'
import {TodoWriteTool} from '../../../../../../packages/builtin-tools/src/tools/kernel/TodoWriteTool.js'
import {InMemoryTodoState} from '../../../../todo/index.js'

/**
 * 给 TodoWriteTool 补上 inputJSONSchema（Phase B 工具暂不带）。
 */
function todoWriteWithSchema(): Tool {
	return {
		...(TodoWriteTool as unknown as Tool),
		inputJSONSchema: {
			type: 'object',
			properties: {
				items: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							id: {type: 'string'},
							content: {type: 'string'},
							status: {
								type: 'string',
								enum: ['pending', 'in_progress', 'completed', 'cancelled'],
							},
							linkedTaskId: {type: 'string'},
						},
						required: ['id', 'content', 'status'],
					},
				},
			},
			required: ['items'],
		},
	} as unknown as Tool
}

function userMsg(text: string): Message {
	return {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'user', content: text},
	}
}

describe('AgentLoop e2e: TodoWriteTool', () => {
	it('multi-turn: 模型 emit TodoWrite → engine 执行 → tool_result → end_turn', async () => {
		const todoState = new InMemoryTodoState()
		const todoTool = todoWriteWithSchema()

		const provider = new ScriptedProvider([
			toolUseTurn(
				'tu_todo_1',
				'TodoWrite',
				{
					items: [
						{id: '1', content: 'design API', status: 'pending'},
						{id: '2', content: 'write tests', status: 'pending'},
					],
				},
				'Let me create a plan.',
			),
			textTurn('Plan saved.'),
		])

		const ctx = createToolUseContext({
			tools: [todoTool],
			kernel: {todoState},
		})

		const events: LoopEvent[] = []
		const gen = AgentLoop.run({
			provider,
			messages: [userMsg('please plan this task')],
			model: 'claude-sonnet-4-20250514',
			tools: [todoTool],
			context: ctx,
		})
		let result: Awaited<ReturnType<typeof gen.next>>['value']
		while (true) {
			const next = await gen.next()
			if (next.done) {
				result = next.value
				break
			}
			events.push(next.value)
		}

		// 1. Loop 完成
		expect((result as {reason: string}).reason).toBe('end_turn')
		expect((result as {turnCount: number}).turnCount).toBe(2)

		// 2. TodoState 真实被写入（Phase A protocol 工作）
		const items = todoState.current()
		expect(items).toHaveLength(2)
		expect(items[0]).toMatchObject({id: '1', content: 'design API', status: 'pending'})
		expect(items[1]).toMatchObject({id: '2', content: 'write tests', status: 'pending'})

		// 3. tool_result 正确反馈给模型（第二轮 user message）
		const finalMessages = (result as {finalMessages: Message[]}).finalMessages
		expect(finalMessages).toHaveLength(4)
		const toolResultMsg = finalMessages[2]
		const trContent = toolResultMsg.message?.content as unknown as Array<{
			type: string
			tool_use_id?: string
			is_error?: boolean
			content: string
		}>
		expect(trContent[0]?.type).toBe('tool_result')
		expect(trContent[0]?.tool_use_id).toBe('tu_todo_1')
		expect(trContent[0]?.is_error).toBeUndefined()
		expect(trContent[0]?.content).toContain('count') // serializeToolOutput 给的是 JSON.stringify({count:2})

		// 4. tool_update 事件包含 started + result
		const toolUpdates = events.filter(e => e.type === 'tool_update')
		const startedCount = toolUpdates.filter(
			u => u.type === 'tool_update' && u.update.kind === 'started',
		).length
		const resultCount = toolUpdates.filter(
			u => u.type === 'tool_update' && u.update.kind === 'result',
		).length
		expect(startedCount).toBe(1)
		expect(resultCount).toBe(1)
	})

	it('TodoState 缺失（kernel 未注入）→ tool_result is_error', async () => {
		const todoTool = todoWriteWithSchema()
		const provider = new ScriptedProvider([
			toolUseTurn('tu_todo_1', 'TodoWrite', {items: []}),
			textTurn('I cannot write todos right now.'),
		])
		const ctx = createToolUseContext({tools: [todoTool]}) // 没注入 kernel

		const gen = AgentLoop.run({
			provider,
			messages: [userMsg('plan')],
			model: 'm',
			tools: [todoTool],
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
		const finalMessages = (result as {finalMessages: Message[]}).finalMessages
		const trContent = finalMessages[2].message?.content as unknown as Array<{
			is_error?: boolean
			content: string
		}>
		expect(trContent[0]?.is_error).toBe(true)
		expect(trContent[0]?.content).toContain('todoState')
	})
})
