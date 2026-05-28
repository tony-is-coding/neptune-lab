import {describe, expect, test} from 'bun:test'

import {InMemorySkillRegistry} from '../InMemorySkillRegistry.js'
import type {SkillManifest, SkillSource} from '../types.js'

const SOURCE: SkillSource = {
	kind: 'test',
	origin: 'inline',
	loadedAt: '2026-05-23T00:00:00.000Z',
}

function manifest(name: string, description = `desc-${name}`): SkillManifest {
	return {name, description, prompt: `prompt of ${name}`}
}

describe('InMemorySkillRegistry', () => {
	test('register/find/list/source basic flow', async () => {
		const r = new InMemorySkillRegistry()
		await r.register(manifest('alpha'), SOURCE)
		await r.register(manifest('beta'), SOURCE)

		expect(r.find('alpha')?.name).toBe('alpha')
		expect(r.find('missing')).toBeUndefined()
		expect(r.list().map(m => m.name)).toEqual(['alpha', 'beta'])
		expect(r.source('alpha')).toEqual(SOURCE)
	})

	test('list() returns stable sort by name', async () => {
		const r = new InMemorySkillRegistry()
		await r.register(manifest('zebra'), SOURCE)
		await r.register(manifest('apple'), SOURCE)
		await r.register(manifest('mango'), SOURCE)

		expect(r.list().map(m => m.name)).toEqual(['apple', 'mango', 'zebra'])
	})

	test('register overwrites existing manifest with same name', async () => {
		const r = new InMemorySkillRegistry()
		await r.register(manifest('foo', 'v1'), SOURCE)
		await r.register(manifest('foo', 'v2'), SOURCE)
		expect(r.find('foo')?.description).toBe('v2')
		expect(r.list()).toHaveLength(1)
	})

	test('unregister removes manifest and source', async () => {
		const r = new InMemorySkillRegistry()
		await r.register(manifest('foo'), SOURCE)
		await r.unregister('foo')
		expect(r.find('foo')).toBeUndefined()
		expect(r.source('foo')).toBeUndefined()
		expect(r.list()).toHaveLength(0)
	})

	test('rejects invalid manifest', async () => {
		const r = new InMemorySkillRegistry()
		await expect(
			r.register({name: '', description: 'x', prompt: ''}, SOURCE),
		).rejects.toThrow(/invalid skill manifest/)
	})

	test('two registries are isolated (per-session去全局化)', async () => {
		const a = new InMemorySkillRegistry()
		const b = new InMemorySkillRegistry()
		await a.register(manifest('only-in-a'), SOURCE)
		expect(b.find('only-in-a')).toBeUndefined()
		expect(b.list()).toHaveLength(0)
	})
})
