/**
 * MessageSerializer 单测
 *
 * 覆盖：
 * - toMessageParam: user 字符串 / user 数组（含 tool_result） / assistant 字符串 / assistant 数组（含 tool_use + thinking）
 * - assistant thinking 缺 signature 抛错
 * - 跳过 system / attachment / progress 类型
 * - toRequestParams: 完整请求体组装
 * - resolveToolParams: async description resolve
 * - toToolParam: 缺 inputJSONSchema 抛错
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import {MessageSerializer} from '../MessageSerializer.js'
import type {Message} from '../../../types/message.js'
import type {Tool} from '../../../types/tool.js'

function uuid() {
	return randomUUID() as unknown as Message['uuid']
}

function userMessage(content: Message['message'] extends infer M ? NonNullable<M>['content'] : never): Message {
	return {
		type: 'user',
		uuid: uuid(),
		message: {role: 'user', content},
	}
}

function assistantMessage(content: Message['message'] extends infer M ? NonNullable<M>['content'] : never): Message {
	return {
		type: 'assistant',
		uuid: uuid(),
		message: {role: 'assistant', content},
	}
}

describe('MessageSerializer.toMessageParam', () => {
	it('user 字符串 content 透传', () => {
		const out = MessageSerializer.toMessageParam(userMessage('hello'))
		expect(out).toEqual({role: 'user', content: 'hello'})
	})

	it('user 数组 content（含 tool_result）规范化', () => {
		const msg = userMessage([
			{
				type: 'tool_result',
				tool_use_id: 'tu_1',
				content: 'output',
			},
		] as unknown as Message['message'] extends infer M ? NonNullable<M>['content'] : never)
		const out = MessageSerializer.toMessageParam(msg)
		expect(out).toMatchObject({
			role: 'user',
			content: [{type: 'tool_result', tool_use_id: 'tu_1', content: 'output'}],
		})
	})

	it('assistant 字符串 content 透传', () => {
		const out = MessageSerializer.toMessageParam(assistantMessage('answer'))
		expect(out).toEqual({role: 'assistant', content: 'answer'})
	})

	it('assistant 数组 content（含 tool_use + thinking） 保留 signature', () => {
		const msg = assistantMessage([
			{type: 'thinking', thinking: 'plan', signature: 'sig_xyz'},
			{type: 'tool_use', id: 'tu_1', name: 'Read', input: {file_path: 'a.md'}},
		] as unknown as Message['message'] extends infer M ? NonNullable<M>['content'] : never)
		const out = MessageSerializer.toMessageParam(msg)
		expect(out).toMatchObject({
			role: 'assistant',
			content: [
				{type: 'thinking', thinking: 'plan', signature: 'sig_xyz'},
				{type: 'tool_use', id: 'tu_1', name: 'Read', input: {file_path: 'a.md'}},
			],
		})
	})

	it('assistant thinking 缺 signature 抛 EngineError', () => {
		const msg = assistantMessage([
			{type: 'thinking', thinking: 'incomplete', signature: ''},
		] as unknown as Message['message'] extends infer M ? NonNullable<M>['content'] : never)
		expect(() => MessageSerializer.toMessageParam(msg)).toThrow(/thinking blocks without signature/)
	})

	it('剥离 _internal 字段', () => {
		const msg = assistantMessage([
			{type: 'text', text: 'hi', _gemini: 'leak'},
		] as unknown as Message['message'] extends infer M ? NonNullable<M>['content'] : never)
		const out = MessageSerializer.toMessageParam(msg)
		expect(out).toMatchObject({
			role: 'assistant',
			content: [{type: 'text', text: 'hi'}],
		})
	})

	it('system 类型返回 null', () => {
		const m: Message = {type: 'system', uuid: uuid(), message: {content: 'sys'}}
		expect(MessageSerializer.toMessageParam(m)).toBeNull()
	})

	it('attachment 类型返回 null', () => {
		const m: Message = {
			type: 'attachment',
			uuid: uuid(),
			attachment: {type: 'file', addedNames: [], addedLines: [], removedNames: []},
		}
		expect(MessageSerializer.toMessageParam(m)).toBeNull()
	})

	it('content 字段缺失返回 null', () => {
		const m: Message = {type: 'user', uuid: uuid(), message: {role: 'user'}}
		expect(MessageSerializer.toMessageParam(m)).toBeNull()
	})
})

describe('MessageSerializer.toRequestParams', () => {
	it('基本组装：model + messages + max_tokens 默认 4096', () => {
		const out = MessageSerializer.toRequestParams({
			model: 'claude-sonnet-4-20250514',
			messages: [userMessage('hi')],
		})
		expect(out).toEqual({
			model: 'claude-sonnet-4-20250514',
			messages: [{role: 'user', content: 'hi'}],
			max_tokens: 4096,
		})
	})

	it('systemPrompt 字符串透传', () => {
		const out = MessageSerializer.toRequestParams({
			model: 'm',
			messages: [userMessage('hi')],
			systemPrompt: 'you are X',
		})
		expect(out.system).toBe('you are X')
	})

	it('extra 字段透传', () => {
		const out = MessageSerializer.toRequestParams({
			model: 'm',
			messages: [userMessage('hi')],
			extra: {some_beta_flag: true},
		})
		expect(out.extra).toEqual({some_beta_flag: true})
	})

	it('maxTokens 覆盖默认值', () => {
		const out = MessageSerializer.toRequestParams({
			model: 'm',
			messages: [userMessage('hi')],
			maxTokens: 8192,
		})
		expect(out.max_tokens).toBe(8192)
	})

	it('过滤 null message（不进 API）', () => {
		const out = MessageSerializer.toRequestParams({
			model: 'm',
			messages: [
				{type: 'system', uuid: uuid(), message: {content: 'sys'}},
				userMessage('hi'),
			],
		})
		expect(out.messages).toHaveLength(1)
	})
})

describe('MessageSerializer.toToolParam / resolveToolParams', () => {
	function makeTool(overrides: Partial<Tool>): Tool {
		return {
			name: 'TestTool',
			description: 'A test tool',
			inputJSONSchema: {type: 'object', properties: {x: {type: 'string'}}},
			isEnabled: () => true,
			isReadOnly: () => true,
			isConcurrencySafe: () => true,
			async checkPermissions() {
				return {behavior: 'allow' as const}
			},
			async *call() {
				yield {type: 'result', data: undefined}
			},
			...overrides,
		} as unknown as Tool
	}

	it('toToolParam 用 inputJSONSchema 序列化', () => {
		const tool = makeTool({})
		const out = MessageSerializer.toToolParam(tool, 'desc')
		expect(out).toEqual({
			name: 'TestTool',
			description: 'desc',
			input_schema: {type: 'object', properties: {x: {type: 'string'}}},
		} as unknown as ReturnType<typeof MessageSerializer.toToolParam>)
	})

	it('toToolParam 缺 inputJSONSchema 抛 EngineError', () => {
		const tool = makeTool({inputJSONSchema: undefined})
		expect(() => MessageSerializer.toToolParam(tool, 'd')).toThrow(/missing inputJSONSchema/)
	})

	it('resolveToolParams 处理 string description', async () => {
		const tool = makeTool({description: 'sync desc'})
		const out = await MessageSerializer.resolveToolParams([tool])
		expect(out).toHaveLength(1)
		expect((out[0] as unknown as {description: string}).description).toBe('sync desc')
	})

	it('resolveToolParams 处理 async description', async () => {
		const tool = makeTool({description: async () => 'async desc'})
		const out = await MessageSerializer.resolveToolParams([tool])
		expect((out[0] as unknown as {description: string}).description).toBe('async desc')
	})

	it('resolveToolParams 处理 sync 函数 description', async () => {
		const tool = makeTool({description: () => 'fn desc'})
		const out = await MessageSerializer.resolveToolParams([tool])
		expect((out[0] as unknown as {description: string}).description).toBe('fn desc')
	})

	it('resolveToolParams 多个工具串行 resolve', async () => {
		const tools = [
			makeTool({name: 'T1', description: 'd1'}),
			makeTool({name: 'T2', description: async () => 'd2'}),
		]
		const out = await MessageSerializer.resolveToolParams(tools)
		expect(out).toHaveLength(2)
		expect((out[0] as unknown as {name: string}).name).toBe('T1')
		expect((out[1] as unknown as {name: string}).name).toBe('T2')
	})
})
