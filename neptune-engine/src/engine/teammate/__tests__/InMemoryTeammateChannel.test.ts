/**
 * InMemoryTeammateChannel.test.ts — Stage B1.4 单测
 *
 * 验证 cc teammateMailbox.ts 等价的 mailbox 行为：
 * 1. send: 单播 + read 默认 false + timestamp 自动填
 * 2. broadcast: 不发给 sender + roster 控制
 * 3. readMailbox: 全部消息含已读
 * 4. readUnreadMessages: read=false 子集
 * 5. markAsRead: 全部 / 按 timestamp 截止
 * 6. registerTeammate / unregisterTeammate / listTeammates
 * 7. StructuredMessage 4 类编解码
 * 8. dispose 清空
 */

import {describe, expect, it, beforeEach} from 'bun:test'
import {InMemoryTeammateChannel} from '../InMemoryTeammateChannel.js'
import {
	encodeStructuredMessage,
	decodeStructuredMessage,
	type StructuredMessage,
} from '../TeammateChannel.js'

describe('InMemoryTeammateChannel — send / readMailbox', () => {
	let ch: InMemoryTeammateChannel
	beforeEach(() => {
		ch = new InMemoryTeammateChannel()
	})

	it('send 写入 inbox + read 默认 false + timestamp 自动填', async () => {
		await ch.send('team-A', 'alice', {from: 'bob', text: 'hi alice'})
		const msgs = await ch.readMailbox('team-A', 'alice')
		expect(msgs).toHaveLength(1)
		expect(msgs[0]?.from).toBe('bob')
		expect(msgs[0]?.text).toBe('hi alice')
		expect(msgs[0]?.read).toBe(false)
		expect(msgs[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
	})

	it('send 多次按时间序保留', async () => {
		await ch.send('team-A', 'alice', {from: 'bob', text: 'msg1'})
		await ch.send('team-A', 'alice', {from: 'carol', text: 'msg2'})
		const msgs = await ch.readMailbox('team-A', 'alice')
		expect(msgs.map(m => m.text)).toEqual(['msg1', 'msg2'])
	})

	it('readMailbox 不存在 → []', async () => {
		const msgs = await ch.readMailbox('team-X', 'no-such')
		expect(msgs).toEqual([])
	})

	it('color / summary 字段保留', async () => {
		await ch.send('team-A', 'alice', {
			from: 'bob',
			text: 'hi',
			color: 'red',
			summary: 'short greeting',
		})
		const msgs = await ch.readMailbox('team-A', 'alice')
		expect(msgs[0]?.color).toBe('red')
		expect(msgs[0]?.summary).toBe('short greeting')
	})

	it('显式 timestamp 不被覆盖', async () => {
		const ts = '2026-05-25T10:00:00.000Z'
		await ch.send('team-A', 'alice', {from: 'bob', text: 'hi', timestamp: ts})
		const msgs = await ch.readMailbox('team-A', 'alice')
		expect(msgs[0]?.timestamp).toBe(ts)
	})

	it('返回快照不可改原 inbox', async () => {
		await ch.send('team-A', 'alice', {from: 'bob', text: 'hi'})
		const snapshot = await ch.readMailbox('team-A', 'alice')
		// 尝试通过 cast 改：原 inbox 应不变
		;(snapshot as unknown as {0: {text: string}})[0].text = 'mutated'
		const fresh = await ch.readMailbox('team-A', 'alice')
		expect(fresh[0]?.text).toBe('hi')
	})
})

describe('InMemoryTeammateChannel — broadcast / roster', () => {
	let ch: InMemoryTeammateChannel
	beforeEach(() => {
		ch = new InMemoryTeammateChannel()
	})

	it('broadcast 给 team 内除 sender 外所有 teammate', async () => {
		await ch.registerTeammate('team-A', 'alice')
		await ch.registerTeammate('team-A', 'bob')
		await ch.registerTeammate('team-A', 'carol')

		const recipients = await ch.broadcast('team-A', 'alice', {
			from: 'alice',
			text: 'hello team',
		})
		expect(new Set(recipients)).toEqual(new Set(['bob', 'carol']))

		// alice 自己 inbox 不应收到
		const aliceInbox = await ch.readMailbox('team-A', 'alice')
		expect(aliceInbox).toHaveLength(0)
		// bob/carol inbox 都收到
		expect(await ch.readMailbox('team-A', 'bob')).toHaveLength(1)
		expect(await ch.readMailbox('team-A', 'carol')).toHaveLength(1)
	})

	it('broadcast 空 roster → 空 recipients', async () => {
		const recipients = await ch.broadcast('team-Z', 'alice', {
			from: 'alice',
			text: 'no one',
		})
		expect(recipients).toEqual([])
	})

	it('listTeammates 返回 sorted', async () => {
		await ch.registerTeammate('team-A', 'carol')
		await ch.registerTeammate('team-A', 'alice')
		await ch.registerTeammate('team-A', 'bob')
		expect(await ch.listTeammates('team-A')).toEqual(['alice', 'bob', 'carol'])
	})

	it('registerTeammate idempotent', async () => {
		await ch.registerTeammate('team-A', 'alice')
		await ch.registerTeammate('team-A', 'alice')
		expect(await ch.listTeammates('team-A')).toEqual(['alice'])
	})

	it('unregisterTeammate 移除 + idempotent', async () => {
		await ch.registerTeammate('team-A', 'alice')
		await ch.unregisterTeammate('team-A', 'alice')
		expect(await ch.listTeammates('team-A')).toEqual([])
		// 重复 unregister 不抛错
		await ch.unregisterTeammate('team-A', 'alice')
		await ch.unregisterTeammate('team-Z', 'unknown')
	})

	it('team 隔离：team-A broadcast 不到 team-B', async () => {
		await ch.registerTeammate('team-A', 'alice')
		await ch.registerTeammate('team-B', 'bob')
		await ch.broadcast('team-A', 'alice', {from: 'alice', text: 'A'})
		expect(await ch.readMailbox('team-B', 'bob')).toEqual([])
	})
})

describe('InMemoryTeammateChannel — read flag / markAsRead', () => {
	let ch: InMemoryTeammateChannel
	beforeEach(() => {
		ch = new InMemoryTeammateChannel()
	})

	it('readUnreadMessages 仅返 read=false', async () => {
		await ch.send('team-A', 'alice', {from: 'bob', text: 'm1'})
		await ch.send('team-A', 'alice', {from: 'bob', text: 'm2'})
		const unread = await ch.readUnreadMessages('team-A', 'alice')
		expect(unread).toHaveLength(2)
		await ch.markAsRead('team-A', 'alice')
		const unreadAfter = await ch.readUnreadMessages('team-A', 'alice')
		expect(unreadAfter).toHaveLength(0)
	})

	it('markAsRead 默认全部', async () => {
		await ch.send('team-A', 'alice', {from: 'bob', text: 'm1'})
		await ch.send('team-A', 'alice', {from: 'bob', text: 'm2'})
		await ch.markAsRead('team-A', 'alice')
		const all = await ch.readMailbox('team-A', 'alice')
		expect(all.every(m => m.read)).toBe(true)
	})

	it('markAsRead with beforeTimestamp 仅截止前的', async () => {
		await ch.send('team-A', 'alice', {
			from: 'bob',
			text: 'old',
			timestamp: '2026-05-25T10:00:00.000Z',
		})
		await ch.send('team-A', 'alice', {
			from: 'bob',
			text: 'new',
			timestamp: '2026-05-25T11:00:00.000Z',
		})
		await ch.markAsRead('team-A', 'alice', {
			beforeTimestamp: '2026-05-25T10:30:00.000Z',
		})
		const all = await ch.readMailbox('team-A', 'alice')
		expect(all[0]?.read).toBe(true)  // old
		expect(all[1]?.read).toBe(false) // new
	})

	it('readMailbox 后 markAsRead 不影响原 read 默认值', async () => {
		await ch.send('team-A', 'alice', {from: 'bob', text: 'm1'})
		const before = await ch.readMailbox('team-A', 'alice')
		expect(before[0]?.read).toBe(false)
		await ch.markAsRead('team-A', 'alice')
		const after = await ch.readMailbox('team-A', 'alice')
		expect(after[0]?.read).toBe(true)
		// 但 before 快照不被改
		expect(before[0]?.read).toBe(false)
	})

	it('markAsRead 不存在 inbox → no-op', async () => {
		await ch.markAsRead('team-Z', 'no-such')
		// 不抛错
	})
})

describe('StructuredMessage 编解码', () => {
	it('encode + decode shutdown_request', () => {
		const msg: StructuredMessage = {
			type: 'shutdown_request',
			request_id: 'req-1',
			reason: 'no longer needed',
		}
		const text = encodeStructuredMessage(msg)
		const decoded = decodeStructuredMessage(text)
		expect(decoded).toEqual(msg)
	})

	it('encode + decode shutdown_response', () => {
		const msg: StructuredMessage = {
			type: 'shutdown_response',
			request_id: 'req-1',
			approve: true,
		}
		const decoded = decodeStructuredMessage(encodeStructuredMessage(msg))
		expect(decoded).toEqual(msg)
	})

	it('encode + decode plan_approval_response', () => {
		const msg: StructuredMessage = {
			type: 'plan_approval_response',
			request_id: 'req-1',
			approve: false,
			feedback: 'plan needs more detail',
		}
		const decoded = decodeStructuredMessage(encodeStructuredMessage(msg))
		expect(decoded).toEqual(msg)
	})

	it('decode plain text → null', () => {
		expect(decodeStructuredMessage('hello world')).toBeNull()
	})

	it('decode 无效 JSON → null', () => {
		expect(decodeStructuredMessage('{invalid')).toBeNull()
	})

	it('decode 未知 type → null', () => {
		expect(decodeStructuredMessage('{"type":"unknown"}')).toBeNull()
	})
})

describe('InMemoryTeammateChannel — dispose', () => {
	it('dispose 清空所有 mailbox + roster', async () => {
		const ch = new InMemoryTeammateChannel()
		await ch.registerTeammate('team-A', 'alice')
		await ch.send('team-A', 'alice', {from: 'bob', text: 'hi'})
		await ch.dispose!()
		expect(await ch.readMailbox('team-A', 'alice')).toEqual([])
		expect(await ch.listTeammates('team-A')).toEqual([])
	})
})
