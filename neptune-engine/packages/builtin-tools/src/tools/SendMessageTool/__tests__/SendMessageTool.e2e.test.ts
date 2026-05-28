/**
 * SendMessageTool e2e — P0.5 端到端测试
 *
 * 验证 substrate agent teams 通信：
 * 1. plain text 单播 → recipient inbox 出现消息
 * 2. plain text 广播 → 所有 teammate 除 sender 外都收到
 * 3. 结构化 shutdown_request → 单 recipient 收到 encoded JSON
 * 4. 结构化 shutdown_response → 同上
 * 5. 结构化 plan_approval_response → 同上
 * 6. 结构化消息 broadcast → validateInput 拒绝
 * 7. plain text 缺 summary → validateInput 拒绝
 * 8. to 含 @ → validateInput 拒绝
 * 9. teammateChannel 缺失 → throw
 */

import {describe, expect, it, beforeEach} from 'bun:test'
import {InMemoryTeammateChannel} from '@neptune/engine'
import {SendMessageTool, SEND_MESSAGE_TOOL_NAME} from '../SendMessageTool.js'
import type {KernelProtocols, KernelToolContext} from '../../../kernel-context.js'

function makeContext(opts: {
	channel?: InMemoryTeammateChannel
	teamName?: string
	agentName?: string
} = {}): KernelToolContext {
	const channel = opts.channel ?? new InMemoryTeammateChannel()
	const ctx = {
		abortController: new AbortController(),
		options: {tools: [], isNonInteractiveSession: false},
		canUseTool: () => ({behavior: 'allow' as const}),
		kernel: {teammateChannel: channel} as unknown as KernelProtocols,
		teamName: opts.teamName ?? 'team-A',
		agentName: opts.agentName ?? 'alice',
	}
	return ctx as unknown as KernelToolContext
}

async function call(input: unknown, ctx: KernelToolContext) {
	return SendMessageTool.call(
		input as Parameters<typeof SendMessageTool.call>[0],
		ctx,
		() => ({behavior: 'allow' as const}) as unknown as Parameters<typeof SendMessageTool.call>[2],
		undefined as unknown as Parameters<typeof SendMessageTool.call>[3],
	)
}

describe('SendMessageTool — plain text', () => {
	let channel: InMemoryTeammateChannel
	beforeEach(() => {
		channel = new InMemoryTeammateChannel()
	})

	it('单播 → recipient inbox 出现消息', async () => {
		const ctx = makeContext({channel, agentName: 'alice'})
		const result = await call(
			{to: 'bob', summary: 'quick hi', message: 'hello bob'},
			ctx,
		)
		const data = result.data as {success: boolean; target: string}
		expect(data.success).toBe(true)
		expect(data.target).toBe('bob')

		const inbox = await channel.readMailbox('team-A', 'bob')
		expect(inbox).toHaveLength(1)
		expect(inbox[0]?.from).toBe('alice')
		expect(inbox[0]?.text).toBe('hello bob')
		expect(inbox[0]?.summary).toBe('quick hi')
	})

	it('广播 → 所有 teammate 除 sender 外都收到', async () => {
		await channel.registerTeammate('team-A', 'alice')
		await channel.registerTeammate('team-A', 'bob')
		await channel.registerTeammate('team-A', 'carol')
		const ctx = makeContext({channel, agentName: 'alice'})
		const result = await call(
			{to: '*', summary: 'kick off', message: 'sprint started'},
			ctx,
		)
		const data = result.data as {recipients: string[]; target: string}
		expect(data.target).toBe('*')
		expect(new Set(data.recipients)).toEqual(new Set(['bob', 'carol']))
		// alice 自己 inbox 空
		expect(await channel.readMailbox('team-A', 'alice')).toHaveLength(0)
	})

	it('plain text 缺 summary → validateInput 拒绝', async () => {
		const ctx = makeContext()
		const validation = await SendMessageTool.validateInput!(
			{to: 'bob', message: 'hi'} as Parameters<typeof SendMessageTool.validateInput>[0],
			ctx,
		)
		expect(validation.result).toBe(false)
		expect(validation.message).toContain('summary')
	})

	it('to 含 @ → validateInput 拒绝', async () => {
		const ctx = makeContext()
		const validation = await SendMessageTool.validateInput!(
			{to: 'bob@team', summary: 's', message: 'hi'} as Parameters<typeof SendMessageTool.validateInput>[0],
			ctx,
		)
		expect(validation.result).toBe(false)
	})
})

describe('SendMessageTool — 结构化消息', () => {
	let channel: InMemoryTeammateChannel
	beforeEach(() => {
		channel = new InMemoryTeammateChannel()
	})

	it('shutdown_request 单播 → recipient 收到 encoded JSON', async () => {
		const ctx = makeContext({channel, agentName: 'team-lead'})
		const result = await call(
			{
				to: 'alice',
				message: {type: 'shutdown_request', request_id: 'req-1', reason: 'idle'},
			},
			ctx,
		)
		expect((result.data as {success: boolean}).success).toBe(true)

		const inbox = await channel.readMailbox('team-A', 'alice')
		expect(inbox).toHaveLength(1)
		const decoded = JSON.parse(inbox[0]!.text)
		expect(decoded.type).toBe('shutdown_request')
		expect(decoded.request_id).toBe('req-1')
		expect(decoded.reason).toBe('idle')
	})

	it('shutdown_response 单播', async () => {
		const ctx = makeContext({channel, agentName: 'alice'})
		await call(
			{
				to: 'team-lead',
				message: {type: 'shutdown_response', request_id: 'req-1', approve: true},
			},
			ctx,
		)
		const inbox = await channel.readMailbox('team-A', 'team-lead')
		const decoded = JSON.parse(inbox[0]!.text)
		expect(decoded.approve).toBe(true)
	})

	it('plan_approval_response 单播', async () => {
		const ctx = makeContext({channel, agentName: 'team-lead'})
		await call(
			{
				to: 'alice',
				message: {
					type: 'plan_approval_response',
					request_id: 'req-1',
					approve: false,
					feedback: 'plan needs revision',
				},
			},
			ctx,
		)
		const inbox = await channel.readMailbox('team-A', 'alice')
		const decoded = JSON.parse(inbox[0]!.text)
		expect(decoded.feedback).toBe('plan needs revision')
	})

	it('结构化消息 broadcast → validateInput 拒绝', async () => {
		const ctx = makeContext()
		const validation = await SendMessageTool.validateInput!(
			{
				to: '*',
				message: {type: 'shutdown_request', request_id: 'req-1'},
			} as Parameters<typeof SendMessageTool.validateInput>[0],
			ctx,
		)
		expect(validation.result).toBe(false)
		expect(validation.message).toMatch(/cannot be broadcast/)
	})
})

describe('SendMessageTool — 协议缺失', () => {
	it('teammateChannel 未注入 → throw', async () => {
		const ctx = {
			abortController: new AbortController(),
			options: {tools: [], isNonInteractiveSession: false},
			canUseTool: () => ({behavior: 'allow' as const}),
			kernel: {} as KernelProtocols,
			teamName: 'team-A',
			agentName: 'alice',
		} as unknown as KernelToolContext

		await expect(call({to: 'bob', summary: 'x', message: 'hi'}, ctx)).rejects.toThrow(
			/teammateChannel/,
		)
	})
})

describe('SendMessageTool — ToolDef metadata', () => {
	it('name = SendMessage', () => {
		expect(SendMessageTool.name).toBe(SEND_MESSAGE_TOOL_NAME)
	})

	it('isReadOnly: plain text → true', () => {
		expect(SendMessageTool.isReadOnly!({to: 'bob', message: 'hi'})).toBe(true)
	})

	it('isReadOnly: 结构化消息 → false', () => {
		expect(
			SendMessageTool.isReadOnly!({
				to: 'bob',
				message: {type: 'shutdown_request', request_id: 'r'},
			}),
		).toBe(false)
	})
})
