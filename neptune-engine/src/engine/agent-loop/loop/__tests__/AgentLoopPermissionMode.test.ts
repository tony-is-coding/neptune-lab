/**
 * Stage 2.3 — AgentLoop + PermissionMode 集成测试
 *
 * 验证：
 * - mode='plan' + BashTool（category=shell）→ tool_result is_error: 'plan_mode_blocked'
 * - mode='readonly' + FileWriteTool（category=write）→ tool_result is_error: 'readonly_mode_blocked'
 * - mode='dangerous' → 任意工具 allow
 * - mode='default' → 走原 canUseTool 链
 * - 默认 category 'mutation' 在 plan 下被阻
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import {AgentLoop} from '../AgentLoop.js'
import {createToolUseContext} from '../../dispatcher/ToolUseContext.js'
import {ScriptedProvider, toolUseTurn, textTurn} from './scriptedProvider.js'
import type {Message} from '../../../types/message.js'
import type {Tool, ToolResult} from '../../../types/tool.js'

function userMsg(text: string): Message {
	return {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'user', content: text},
	}
}

function makeTool(
	name: string,
	category: 'readOnly' | 'write' | 'network' | 'shell' | 'mutation' | undefined,
	response: unknown = 'ok',
): Tool {
	return {
		name,
		description: `${name} tool`,
		inputJSONSchema: {type: 'object', properties: {}},
		category,
		async call(): Promise<ToolResult<unknown>> {
			return {data: response}
		},
	} as unknown as Tool
}

async function runWithMode(
	mode: 'default' | 'plan' | 'readonly' | 'dangerous' | 'bypass',
	tool: Tool,
): Promise<{
	turnCount: number
	reason: string
	finalMessages: Message[]
}> {
	const provider = new ScriptedProvider([
		toolUseTurn('tu_1', tool.name, {}),
		textTurn('done'),
	])
	const ctx = createToolUseContext({
		tools: [tool],
		optionsExtra: {permissionMode: mode},
	})
	const gen = AgentLoop.run({
		provider,
		messages: [userMsg('please use tool')],
		model: 'm',
		tools: [tool],
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
	return result as never
}

function getToolResultContent(messages: Message[]): {is_error?: boolean; content: string} {
	const trMsg = messages[2] // user message containing tool_result
	const blocks = trMsg!.message?.content as unknown as Array<{
		is_error?: boolean
		content: string
	}>
	return blocks[0]!
}

describe('AgentLoop + PermissionMode 集成', () => {
	it('mode=plan + shell tool（BashTool category=shell）→ tool_result is_error: plan_mode_blocked', async () => {
		const result = await runWithMode('plan', makeTool('Bash', 'shell'))
		const tr = getToolResultContent(result.finalMessages)
		expect(tr.is_error).toBe(true)
		expect(tr.content).toContain('plan_mode_blocked')
	})

	it('mode=readonly + write tool（FileWrite category=write）→ tool_result is_error: readonly_mode_blocked', async () => {
		const result = await runWithMode('readonly', makeTool('FileWrite', 'write'))
		const tr = getToolResultContent(result.finalMessages)
		expect(tr.is_error).toBe(true)
		expect(tr.content).toContain('readonly_mode_blocked')
	})

	it('mode=plan + readOnly tool（FileRead）→ allow', async () => {
		const result = await runWithMode('plan', makeTool('FileRead', 'readOnly'))
		const tr = getToolResultContent(result.finalMessages)
		expect(tr.is_error).toBeUndefined()
		expect(tr.content).toBe('ok')
	})

	it('mode=readonly + shell tool（BashTool）→ allow（readonly 比 plan 松）', async () => {
		const result = await runWithMode('readonly', makeTool('Bash', 'shell'))
		const tr = getToolResultContent(result.finalMessages)
		expect(tr.is_error).toBeUndefined()
	})

	it('mode=dangerous + 任意 mutation tool → allow', async () => {
		const result = await runWithMode('dangerous', makeTool('AnyMutator', 'mutation'))
		const tr = getToolResultContent(result.finalMessages)
		expect(tr.is_error).toBeUndefined()
		expect(tr.content).toBe('ok')
	})

	it('mode=bypass → 跳过 mode 检查（与 dangerous 等价）', async () => {
		const result = await runWithMode('bypass', makeTool('X', 'mutation'))
		const tr = getToolResultContent(result.finalMessages)
		expect(tr.is_error).toBeUndefined()
	})

	it('mode=default → 走原 canUseTool 链（默认 allow-all）', async () => {
		const result = await runWithMode('default', makeTool('X', 'mutation'))
		const tr = getToolResultContent(result.finalMessages)
		expect(tr.is_error).toBeUndefined()
	})

	it('未声明 category 的工具在 plan 模式下默认按 mutation 处理（保守阻）', async () => {
		const result = await runWithMode('plan', makeTool('Unknown', undefined))
		const tr = getToolResultContent(result.finalMessages)
		expect(tr.is_error).toBe(true)
		expect(tr.content).toContain('plan_mode_blocked')
	})

	it('mode=readonly + write 工具 → 阻；同模式 + read 工具 → allow（同 batch 不互相影响）', async () => {
		// 这是个 regression case：确保 mode 状态在不同 tool 间正确
		const denied = await runWithMode('readonly', makeTool('FileWrite', 'write'))
		const allowed = await runWithMode('readonly', makeTool('FileRead', 'readOnly'))
		expect(getToolResultContent(denied.finalMessages).is_error).toBe(true)
		expect(getToolResultContent(allowed.finalMessages).is_error).toBeUndefined()
	})
})
