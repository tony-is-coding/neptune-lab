import {describe, expect, test} from 'bun:test'

import type {Tool} from '../../types/tool.js'
import {InMemoryToolRegistry} from '../InMemoryToolRegistry.js'

const tool = (
	name: string,
	extra: {searchHint?: string; description?: string} = {},
): Tool => ({
	name,
	description: extra.description ?? `default ${name} description`,
	...(extra.searchHint && {searchHint: extra.searchHint}),
})

describe('InMemoryToolRegistry', () => {
	test('register/get/list basic flow', async () => {
		const r = new InMemoryToolRegistry()
		await r.register(tool('Bash'))
		await r.register(tool('Read'))
		expect(r.get('Bash')?.name).toBe('Bash')
		expect(r.list().map(t => t.name).sort()).toEqual(['Bash', 'Read'])
	})

	test('overwrites by name on re-register', async () => {
		const r = new InMemoryToolRegistry()
		await r.register(tool('Bash', {description: 'v1'}))
		await r.register(tool('Bash', {description: 'v2'}))
		expect(r.get('Bash')?.description).toBe('v2')
		expect(r.list()).toHaveLength(1)
	})

	test('unregister removes tool', async () => {
		const r = new InMemoryToolRegistry()
		await r.register(tool('Bash'))
		await r.unregister('Bash')
		expect(r.get('Bash')).toBeUndefined()
	})

	test('search ranks by name match > searchHint > description', () => {
		const r = new InMemoryToolRegistry()
		r.register(tool('FileReader', {description: 'read disk files'}))
		r.register(tool('Grep', {searchHint: 'fast file search'}))
		r.register(tool('Bash', {description: 'execute shell commands'}))

		const results = r.search('file', 5)
		expect(results.length).toBeGreaterThan(0)
		// FileReader 名字带 file 应当最高分
		expect(results[0]?.tool.name).toBe('FileReader')
		expect(results[0]?.matchedOn).toBe('name')
	})

	test('search respects limit', async () => {
		const r = new InMemoryToolRegistry()
		await Promise.all(
			['a', 'b', 'c', 'd'].map(n => r.register(tool(`File${n}`))),
		)
		expect(r.search('file', 2)).toHaveLength(2)
	})

	test('list filter excludeNames', async () => {
		const r = new InMemoryToolRegistry()
		await r.register(tool('Bash'))
		await r.register(tool('Read'))
		await r.register(tool('Write'))
		expect(
			r.list({excludeNames: ['Bash']}).map(t => t.name).sort(),
		).toEqual(['Read', 'Write'])
	})

	test('list filter namePrefix', async () => {
		const r = new InMemoryToolRegistry()
		await r.register(tool('mcp__server__tool1'))
		await r.register(tool('mcp__server__tool2'))
		await r.register(tool('Bash'))
		expect(r.list({namePrefix: 'mcp__'}).map(t => t.name).sort()).toEqual([
			'mcp__server__tool1',
			'mcp__server__tool2',
		])
	})

	test('two registries isolated (per-session 去全局化)', async () => {
		const a = new InMemoryToolRegistry()
		const b = new InMemoryToolRegistry()
		await a.register(tool('only-a'))
		expect(b.list()).toHaveLength(0)
	})
})
