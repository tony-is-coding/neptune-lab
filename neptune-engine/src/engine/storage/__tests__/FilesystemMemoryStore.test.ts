/**
 * FilesystemMemoryStore.test.ts — 用户记忆存储文件系统实现单测
 */

import {describe, it, expect, beforeEach, afterEach} from 'bun:test'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {FilesystemMemoryStore} from '../FilesystemMemoryStore.js'

describe('FilesystemMemoryStore', () => {
	let dir: string
	let store: FilesystemMemoryStore

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'nep-fs-memory-'))
		store = new FilesystemMemoryStore(dir)
	})

	afterEach(async () => {
		await store.dispose()
		await rm(dir, {recursive: true, force: true})
	})

	it('save + load 基本', async () => {
		await store.save('u1', 'k1', {data: 'value'})
		expect(await store.load('u1', 'k1')).toEqual({data: 'value'})
	})

	it('load 不存在 key → undefined', async () => {
		expect(await store.load('u1', 'nope')).toBeUndefined()
	})

	it('save 同 key 多次 → last-wins', async () => {
		await store.save('u1', 'k1', 'v1')
		await store.save('u1', 'k1', 'v2')
		expect(await store.load('u1', 'k1')).toBe('v2')
	})

	it('delete 后 load 返 undefined', async () => {
		await store.save('u1', 'k1', 'v')
		await store.delete('u1', 'k1')
		expect(await store.load('u1', 'k1')).toBeUndefined()
	})

	it('list 返回所有 key', async () => {
		await store.save('u1', 'a', 1)
		await store.save('u1', 'b', 2)
		const all = await store.list('u1')
		const keys = all.map(e => e.key).sort()
		expect(keys).toEqual(['a', 'b'])
	})

	it('list with prefix 过滤', async () => {
		await store.save('u1', 'task.1', 'a')
		await store.save('u1', 'task.2', 'b')
		await store.save('u1', 'memo.1', 'c')
		const tasks = await store.list('u1', 'task.')
		expect(tasks.map(e => e.key).sort()).toEqual(['task.1', 'task.2'])
	})

	it('删除后 list 不返回该 key', async () => {
		await store.save('u1', 'k', 'v')
		await store.delete('u1', 'k')
		expect(await store.list('u1')).toEqual([])
	})

	it('不同 userId 隔离', async () => {
		await store.save('u1', 'k', 'a')
		await store.save('u2', 'k', 'b')
		expect(await store.load('u1', 'k')).toBe('a')
		expect(await store.load('u2', 'k')).toBe('b')
	})

	it('clear 清空 user 全部 memory', async () => {
		await store.save('u1', 'a', 1)
		await store.save('u1', 'b', 2)
		await store.clear('u1')
		expect(await store.list('u1')).toEqual([])
	})

	it('userId 含特殊字符（email）', async () => {
		await store.save('user@example.com', 'k', 'v')
		expect(await store.load('user@example.com', 'k')).toBe('v')
	})

	it('跨实例可见', async () => {
		await store.save('u1', 'persistent', 'data')
		const store2 = new FilesystemMemoryStore(dir)
		expect(await store2.load('u1', 'persistent')).toBe('data')
	})
})
