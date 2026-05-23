import {describe, expect, test} from 'bun:test'

import {InMemoryMemoryStore} from '../InMemoryMemoryStore.js'

const baseEntry = (
	content: string,
	overrides: {namespace?: string; tags?: string[]; importance?: number} = {},
) => ({
	namespace: overrides.namespace ?? 'default',
	content,
	...(overrides.tags && {tags: overrides.tags}),
	...(overrides.importance !== undefined && {importance: overrides.importance}),
})

describe('InMemoryMemoryStore', () => {
	test('put assigns ref and timestamp', async () => {
		const m = new InMemoryMemoryStore()
		const ref = await m.put(baseEntry('hello'))
		expect(typeof ref).toBe('string')
		const e = await m.get(ref)
		expect(e?.content).toBe('hello')
		expect(typeof e?.createdAt).toBe('string')
		expect(e?.ref).toBe(ref)
	})

	test('delete removes entry', async () => {
		const m = new InMemoryMemoryStore()
		const ref = await m.put(baseEntry('hello'))
		await m.delete(ref)
		expect(await m.get(ref)).toBeUndefined()
	})

	test('search by text matches case-insensitively, in namespace', async () => {
		const m = new InMemoryMemoryStore()
		await m.put(baseEntry('user prefers dark mode'))
		await m.put(baseEntry('user lives in Beijing'))
		await m.put(baseEntry('cat is named luna', {namespace: 'pets'}))
		const r = await m.search({namespace: 'default', text: 'USER'})
		expect(r.map(e => e.content).sort()).toEqual([
			'user lives in Beijing',
			'user prefers dark mode',
		])
	})

	test('search by tags requires all tags present (AND)', async () => {
		const m = new InMemoryMemoryStore()
		await m.put(baseEntry('a', {tags: ['x', 'y']}))
		await m.put(baseEntry('b', {tags: ['x']}))
		await m.put(baseEntry('c', {tags: ['y']}))
		const r = await m.search({tags: ['x', 'y']})
		expect(r.map(e => e.content)).toEqual(['a'])
	})

	test('search since filters older entries', async () => {
		const m = new InMemoryMemoryStore()
		const oldRef = await m.put(baseEntry('old'))
		// 强制让 since 比 oldRef 创建时间晚
		await new Promise(r => setTimeout(r, 5))
		const cutoff = new Date().toISOString()
		await new Promise(r => setTimeout(r, 5))
		await m.put(baseEntry('new'))
		const r = await m.search({since: cutoff})
		expect(r.map(e => e.content)).toEqual(['new'])
		// 旧条目仍然存在
		expect(await m.get(oldRef)).toBeDefined()
	})

	test('search respects limit', async () => {
		const m = new InMemoryMemoryStore()
		for (let i = 0; i < 5; i++) await m.put(baseEntry(`x-${i}`))
		const r = await m.search({text: 'x-', limit: 3})
		expect(r).toHaveLength(3)
	})

	test('list iterates a namespace', async () => {
		const m = new InMemoryMemoryStore()
		await m.put(baseEntry('a'))
		await m.put(baseEntry('b'))
		await m.put(baseEntry('p', {namespace: 'pets'}))
		const out: string[] = []
		for await (const e of m.list('default')) {
			out.push(e.content)
		}
		expect(out.sort()).toEqual(['a', 'b'])
	})

	test('two stores are isolated (per-session 去全局化)', async () => {
		const a = new InMemoryMemoryStore()
		const b = new InMemoryMemoryStore()
		await a.put(baseEntry('only-a'))
		expect(await b.search({text: 'only-a'})).toHaveLength(0)
	})

	test('expiresAt prunes from search/get', async () => {
		const m = new InMemoryMemoryStore()
		const ref = await m.put({
			...baseEntry('soon-gone'),
			expiresAt: new Date(Date.now() - 1000).toISOString(),
		})
		expect(await m.get(ref)).toBeUndefined()
		expect(await m.search({text: 'soon'})).toHaveLength(0)
	})
})
