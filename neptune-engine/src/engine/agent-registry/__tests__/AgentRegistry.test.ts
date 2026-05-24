/**
 * AgentRegistry.test.ts — InMemoryAgentRegistry + FilesystemAgentRegistry 单测
 */

import {describe, it, expect, beforeEach, afterEach} from 'bun:test'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {
	InMemoryAgentRegistry,
	FilesystemAgentRegistry,
	type AgentManifest,
} from '../index.js'

function manifest(type: string, overrides?: Partial<AgentManifest>): AgentManifest {
	return {
		type,
		description: `${type} agent`,
		systemPrompt: `You are ${type}`,
		...overrides,
	}
}

describe('InMemoryAgentRegistry', () => {
	let reg: InMemoryAgentRegistry

	beforeEach(() => {
		reg = new InMemoryAgentRegistry()
	})

	it('register + get round-trip', async () => {
		await reg.register(manifest('reviewer'))
		const m = await reg.get('reviewer')
		expect(m?.type).toBe('reviewer')
		expect(m?.description).toBe('reviewer agent')
	})

	it('get 不存在 type → undefined', async () => {
		expect(await reg.get('nope')).toBeUndefined()
	})

	it('register 同 type → 覆盖（upsert）', async () => {
		await reg.register(manifest('r1', {description: 'v1'}))
		await reg.register(manifest('r1', {description: 'v2'}))
		expect((await reg.get('r1'))?.description).toBe('v2')
	})

	it('list 按注册顺序返回全部', async () => {
		await reg.register(manifest('a'))
		await reg.register(manifest('b'))
		await reg.register(manifest('c'))
		const all = await reg.list()
		expect(all.map(m => m.type)).toEqual(['a', 'b', 'c'])
	})

	it('unregister 后 get 返 undefined + list 不含', async () => {
		await reg.register(manifest('a'))
		await reg.register(manifest('b'))
		await reg.unregister('a')
		expect(await reg.get('a')).toBeUndefined()
		expect((await reg.list()).map(m => m.type)).toEqual(['b'])
	})

	it('unregister 不存在 type 不抛错', async () => {
		await expect(reg.unregister('nope')).resolves.toBeUndefined()
	})

	it('metadata round-trip', async () => {
		await reg.register(manifest('r', {metadata: {color: 'red', priority: 5}}))
		expect((await reg.get('r'))?.metadata).toEqual({color: 'red', priority: 5})
	})

	it('tools 列表 round-trip', async () => {
		await reg.register(manifest('r', {tools: ['Read', 'Write']}))
		expect((await reg.get('r'))?.tools).toEqual(['Read', 'Write'])
	})
})

describe('FilesystemAgentRegistry', () => {
	let dir: string
	let reg: FilesystemAgentRegistry

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'nep-agent-reg-'))
		reg = new FilesystemAgentRegistry(dir)
	})

	afterEach(async () => {
		await rm(dir, {recursive: true, force: true})
	})

	it('register 后 get round-trip', async () => {
		await reg.register(manifest('r1', {modelHint: 'sonnet'}))
		const m = await reg.get('r1')
		expect(m?.type).toBe('r1')
		expect(m?.modelHint).toBe('sonnet')
	})

	it('get 不存在 type → undefined', async () => {
		expect(await reg.get('nope')).toBeUndefined()
	})

	it('list 返回所有已注册', async () => {
		await reg.register(manifest('a'))
		await reg.register(manifest('b'))
		const types = (await reg.list()).map(m => m.type).sort()
		expect(types).toEqual(['a', 'b'])
	})

	it('list 空目录 → []', async () => {
		expect(await reg.list()).toEqual([])
	})

	it('unregister 后 get 返 undefined', async () => {
		await reg.register(manifest('r'))
		await reg.unregister('r')
		expect(await reg.get('r')).toBeUndefined()
	})

	it('跨实例可见（持久化）', async () => {
		await reg.register(manifest('persistent', {metadata: {hello: 'world'}}))
		const reg2 = new FilesystemAgentRegistry(dir)
		const m = await reg2.get('persistent')
		expect(m?.metadata).toEqual({hello: 'world'})
	})

	it('register upsert 覆盖', async () => {
		await reg.register(manifest('r', {description: 'v1'}))
		await reg.register(manifest('r', {description: 'v2'}))
		expect((await reg.get('r'))?.description).toBe('v2')
	})

	it('特殊字符 type 用 sanitize', async () => {
		// type 实际不应该有特殊字符，但保险测试
		await reg.register(manifest('a-b-c'))
		expect((await reg.get('a-b-c'))?.type).toBe('a-b-c')
	})
})
