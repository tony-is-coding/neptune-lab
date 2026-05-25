/**
 * builtins.test.ts — Stage B1.3 + B3 单测
 *
 * 验证 substrate baseline 4 agents 的注入与契约：
 * 1. BUILT_IN_AGENT_MANIFESTS 含 4 个固定 type 的 manifest
 * 2. InMemoryAgentRegistry.getBuiltIns() 返这 4 个
 * 3. registerBuiltIns() idempotent
 * 4. FilesystemAgentRegistry 同行为
 * 5. 每个 manifest 必填字段都有
 */

import {describe, expect, it, afterEach, beforeEach} from 'bun:test'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {
	BUILT_IN_AGENT_MANIFESTS,
	GENERAL_PURPOSE_AGENT_MANIFEST,
	EXPLORE_AGENT_MANIFEST,
	PLAN_AGENT_MANIFEST,
	VERIFICATION_AGENT_MANIFEST,
	InMemoryAgentRegistry,
	FilesystemAgentRegistry,
} from '../index.js'

describe('BUILT_IN_AGENT_MANIFESTS — 协议契约', () => {
	it('含 4 个 baseline manifests', () => {
		expect(BUILT_IN_AGENT_MANIFESTS).toHaveLength(4)
		const types = BUILT_IN_AGENT_MANIFESTS.map(m => m.type)
		expect(types).toEqual(['general-purpose', 'Explore', 'Plan', 'verification'])
	})

	it('每个 manifest 必填字段齐全', () => {
		for (const manifest of BUILT_IN_AGENT_MANIFESTS) {
			expect(manifest.type).toBeTruthy()
			expect(manifest.name).toBeTruthy()
			expect(manifest.description).toBeTruthy()
			expect(manifest.systemPrompt).toBeTruthy()
			expect((manifest.systemPrompt as string).length).toBeGreaterThan(100)
			// metadata.source 应为 'built-in'
			expect((manifest.metadata as Record<string, unknown>)?.source).toBe('built-in')
			expect((manifest.metadata as Record<string, unknown>)?.isBaseline).toBe(true)
		}
	})

	it('individual manifest exports 与列表一致', () => {
		expect(BUILT_IN_AGENT_MANIFESTS[0]).toBe(GENERAL_PURPOSE_AGENT_MANIFEST)
		expect(BUILT_IN_AGENT_MANIFESTS[1]).toBe(EXPLORE_AGENT_MANIFEST)
		expect(BUILT_IN_AGENT_MANIFESTS[2]).toBe(PLAN_AGENT_MANIFEST)
		expect(BUILT_IN_AGENT_MANIFESTS[3]).toBe(VERIFICATION_AGENT_MANIFEST)
	})

	it('frozen array — 不可 push', () => {
		expect(Object.isFrozen(BUILT_IN_AGENT_MANIFESTS)).toBe(true)
	})

	it('Explore 是 read-only + one-shot', () => {
		const meta = EXPLORE_AGENT_MANIFEST.metadata as Record<string, unknown>
		expect(meta.readOnly).toBe(true)
		expect(meta.isOneShot).toBe(true)
	})

	it('Plan 是 read-only + one-shot', () => {
		const meta = PLAN_AGENT_MANIFEST.metadata as Record<string, unknown>
		expect(meta.readOnly).toBe(true)
		expect(meta.isOneShot).toBe(true)
	})

	it('verification 默认后台跑（runInBackground=true）', () => {
		const meta = VERIFICATION_AGENT_MANIFEST.metadata as Record<string, unknown>
		expect(meta.runInBackground).toBe(true)
	})

	it('general-purpose 不限制 tools（继承 parent 工具池）', () => {
		expect(GENERAL_PURPOSE_AGENT_MANIFEST.tools).toBeUndefined()
	})

	it('Explore / Plan / verification 都设置工具白名单（不含 FileWrite/FileEdit）', () => {
		for (const m of [EXPLORE_AGENT_MANIFEST, PLAN_AGENT_MANIFEST, VERIFICATION_AGENT_MANIFEST]) {
			expect(m.tools).toBeDefined()
			expect(m.tools).not.toContain('FileWrite')
			expect(m.tools).not.toContain('FileEdit')
			expect(m.tools).not.toContain('NotebookEdit')
		}
	})
})

describe('InMemoryAgentRegistry — getBuiltIns / registerBuiltIns', () => {
	it('getBuiltIns() 返 4 个 baseline manifests', () => {
		const reg = new InMemoryAgentRegistry()
		const builtins = reg.getBuiltIns()
		expect(builtins).toHaveLength(4)
		expect(builtins).toBe(BUILT_IN_AGENT_MANIFESTS) // 引用相同
	})

	it('registerBuiltIns() 后 list() 返 4 个', async () => {
		const reg = new InMemoryAgentRegistry()
		await reg.registerBuiltIns()
		const list = await reg.list()
		expect(list).toHaveLength(4)
	})

	it('registerBuiltIns() idempotent — 重复调不增加', async () => {
		const reg = new InMemoryAgentRegistry()
		await reg.registerBuiltIns()
		await reg.registerBuiltIns()
		const list = await reg.list()
		expect(list).toHaveLength(4)
	})

	it('注册后 get(type) 返对应 manifest', async () => {
		const reg = new InMemoryAgentRegistry()
		await reg.registerBuiltIns()
		const got = await reg.get('Explore')
		expect(got?.type).toBe('Explore')
		expect(got?.systemPrompt).toContain('READ-ONLY')
	})

	it('用户自定义 manifest 可覆盖 baseline（同 type）', async () => {
		const reg = new InMemoryAgentRegistry()
		await reg.registerBuiltIns()
		await reg.register({
			type: 'Explore',
			description: 'my custom explore',
			systemPrompt: 'custom prompt',
		})
		const got = await reg.get('Explore')
		expect(got?.description).toBe('my custom explore')
		expect(got?.systemPrompt).toBe('custom prompt')
	})

	it('未注册 baseline 时 list() 空', async () => {
		const reg = new InMemoryAgentRegistry()
		const list = await reg.list()
		expect(list).toEqual([])
	})
})

describe('FilesystemAgentRegistry — getBuiltIns / registerBuiltIns', () => {
	let dir: string
	let reg: FilesystemAgentRegistry

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'nep-agent-reg-'))
		reg = new FilesystemAgentRegistry(dir)
	})

	afterEach(async () => {
		await rm(dir, {recursive: true, force: true})
	})

	it('getBuiltIns() 返 4 个 baseline', () => {
		expect(reg.getBuiltIns()).toHaveLength(4)
	})

	it('registerBuiltIns() 持久化到 fs + 跨实例可读', async () => {
		await reg.registerBuiltIns()
		const list = await reg.list()
		expect(list).toHaveLength(4)

		// 跨实例
		const reg2 = new FilesystemAgentRegistry(dir)
		const list2 = await reg2.list()
		expect(list2).toHaveLength(4)
		const types = list2.map(m => m.type).sort()
		expect(types).toEqual(['Explore', 'Plan', 'general-purpose', 'verification'])
	})

	it('registerBuiltIns() idempotent', async () => {
		await reg.registerBuiltIns()
		await reg.registerBuiltIns()
		const list = await reg.list()
		expect(list).toHaveLength(4)
	})
})
