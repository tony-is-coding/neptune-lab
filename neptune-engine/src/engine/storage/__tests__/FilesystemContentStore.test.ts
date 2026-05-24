/**
 * FilesystemContentStore.test.ts — Session 内容存储文件系统实现单测
 */

import {describe, it, expect, beforeEach, afterEach} from 'bun:test'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {FilesystemContentStore} from '../FilesystemContentStore.js'

describe('FilesystemContentStore', () => {
	let dir: string
	let store: FilesystemContentStore

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'nep-fs-content-'))
		store = new FilesystemContentStore(dir)
	})

	afterEach(async () => {
		await store.dispose()
		await rm(dir, {recursive: true, force: true})
	})

	it('append 单条 + read 全部', async () => {
		await store.append('s1', 'hello')
		const all = await store.read('s1')
		expect(all).toHaveLength(1)
		expect(all[0]?.content).toBe('hello')
		expect(all[0]?.timestamp).toBeGreaterThan(0)
	})

	it('append 多条 + read 顺序保留', async () => {
		for (let i = 0; i < 5; i++) await store.append('s1', `msg-${i}`)
		const all = await store.read('s1')
		expect(all.map(i => i.content)).toEqual(['msg-0', 'msg-1', 'msg-2', 'msg-3', 'msg-4'])
	})

	it('append with metadata', async () => {
		await store.append('s1', 'hi', {role: 'user', token: 5})
		const all = await store.read('s1')
		expect(all[0]?.metadata).toEqual({role: 'user', token: 5})
	})

	it('read with from / to', async () => {
		for (let i = 0; i < 5; i++) await store.append('s1', `m${i}`)
		expect((await store.read('s1', {from: 1, to: 4})).map(i => i.content)).toEqual([
			'm1',
			'm2',
			'm3',
		])
	})

	it('read with limit', async () => {
		for (let i = 0; i < 5; i++) await store.append('s1', `m${i}`)
		expect((await store.read('s1', {limit: 2})).map(i => i.content)).toEqual(['m0', 'm1'])
	})

	it('read with from + limit', async () => {
		for (let i = 0; i < 5; i++) await store.append('s1', `m${i}`)
		expect((await store.read('s1', {from: 2, limit: 2})).map(i => i.content)).toEqual([
			'm2',
			'm3',
		])
	})

	it('count 返回行数', async () => {
		for (let i = 0; i < 3; i++) await store.append('s1', 'x')
		expect(await store.count('s1')).toBe(3)
	})

	it('truncate 保留最后 N 条', async () => {
		for (let i = 0; i < 5; i++) await store.append('s1', `m${i}`)
		await store.truncate('s1', 2)
		const remaining = await store.read('s1')
		expect(remaining.map(i => i.content)).toEqual(['m3', 'm4'])
	})

	it('truncate(0) 清空', async () => {
		for (let i = 0; i < 3; i++) await store.append('s1', 'x')
		await store.truncate('s1', 0)
		expect(await store.count('s1')).toBe(0)
	})

	it('clear → count 返 0', async () => {
		await store.append('s1', 'x')
		await store.clear('s1')
		expect(await store.count('s1')).toBe(0)
	})

	it('clear 不存在 sessionId 不报错', async () => {
		await expect(store.clear('nope')).resolves.toBeUndefined()
	})

	it('不同 sessionId 隔离', async () => {
		await store.append('s1', 'a')
		await store.append('s2', 'b')
		expect((await store.read('s1')).map(i => i.content)).toEqual(['a'])
		expect((await store.read('s2')).map(i => i.content)).toEqual(['b'])
	})

	it('跨实例可见', async () => {
		await store.append('s1', 'persisted')
		const store2 = new FilesystemContentStore(dir)
		const all = await store2.read('s1')
		expect(all[0]?.content).toBe('persisted')
	})
})
