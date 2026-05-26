/**
 * FilesystemSessionStore.test.ts — Session 持久化文件系统实现单测
 */

import {describe, it, expect, beforeEach, afterEach} from 'bun:test'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {FilesystemSessionStore} from '../FilesystemSessionStore.js'
import {Session, type SessionSnapshot} from '../../Session.js'

describe('FilesystemSessionStore', () => {
	let dir: string
	let store: FilesystemSessionStore

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'nep-fs-session-'))
		store = new FilesystemSessionStore(dir)
	})

	afterEach(async () => {
		await store.dispose()
		await rm(dir, {recursive: true, force: true})
	})

	function buildSnapshot(id: string, overrides?: Partial<SessionSnapshot>): SessionSnapshot {
		return {
			sessionId: id,
			workspace: '/workspace',
			createdAt: 1000,
			status: 'active',
			metadata: {},
			...overrides,
		}
	}

	it('save 后 load 返回相同 Session', async () => {
		const snap = buildSnapshot('s1', {metadata: {a: 1}})
		await store.save(Session.restore(snap))
		const loaded = await store.load('s1')
		expect(loaded).not.toBeNull()
		expect(loaded?.sessionId).toBe('s1')
		expect(loaded?.workspace).toBe('/workspace')
		expect(loaded?.getMetadata()).toEqual({a: 1})
	})

	it('load 不存在的 sessionId → null', async () => {
		expect(await store.load('nonexistent')).toBeNull()
	})

	it('save 同 sessionId 多次 → upsert', async () => {
		await store.save(Session.restore(buildSnapshot('s1', {workspace: '/v1'})))
		await store.save(Session.restore(buildSnapshot('s1', {workspace: '/v2', status: 'paused'})))
		const loaded = await store.load('s1')
		expect(loaded?.workspace).toBe('/v2')
		expect(loaded?.status).toBe('paused')
	})

	it('delete 已存在 → load 返 null', async () => {
		await store.save(Session.restore(buildSnapshot('s1')))
		await store.delete('s1')
		expect(await store.load('s1')).toBeNull()
	})

	it('delete 不存在的 sessionId 不报错', async () => {
		await expect(store.delete('nope')).resolves.toBeUndefined()
	})

	it('list 返回所有保存的 Session', async () => {
		await store.save(Session.restore(buildSnapshot('s1')))
		await store.save(Session.restore(buildSnapshot('s2')))
		const all = await store.list()
		const ids = all.map(s => s.sessionId).sort()
		expect(ids).toEqual(['s1', 's2'])
	})

	it('list 空目录 → []', async () => {
		expect(await store.list()).toEqual([])
	})

	it('跨实例可见（持久化）', async () => {
		await store.save(Session.restore(buildSnapshot('s1', {metadata: {note: 'hello'}})))
		// 创建新实例（模拟进程重启）
		const store2 = new FilesystemSessionStore(dir)
		const loaded = await store2.load('s1')
		expect(loaded?.getMetadata()).toEqual({note: 'hello'})
	})

	it('systemPrompt 函数 → 持久化为 placeholder', async () => {
		const snap = buildSnapshot('s1', {systemPrompt: async () => 'hi'})
		await store.save(Session.restore(snap))
		const loaded = await store.load('s1')
		expect(loaded?.getSystemPrompt()).toBeTypeOf('function')
	})
})
