/**
 * FilesystemAgentScopedMemoryStore.test.ts — Stage B1.1 单测
 *
 * 验证 cc agentMemory + agentMemorySnapshot 等价行为：
 * 1. 三 scope 隔离（user / project / local）
 * 2. write / load / list / delete CRUD
 * 3. snapshot 三态：none / initialize / prompt-update
 * 4. initializeFromSnapshot / replaceFromSnapshot / markSnapshotSynced 幂等
 * 5. agent type 含 `:` 时 sanitize（plugin namespace）
 * 6. atomic write（不留 .tmp 文件）
 */

import {describe, expect, it, beforeEach, afterEach} from 'bun:test'
import {mkdtemp, readdir, readFile, rm, writeFile, mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {FilesystemAgentScopedMemoryStore} from '../FilesystemAgentScopedMemoryStore.js'

async function makeStore(): Promise<{
	store: FilesystemAgentScopedMemoryStore
	root: string
}> {
	const root = await mkdtemp(join(tmpdir(), 'nep-mem-'))
	const store = new FilesystemAgentScopedMemoryStore({
		userBaseDir: join(root, 'user'),
		projectBaseDir: join(root, 'project'),
		localBaseDir: join(root, 'local'),
		snapshotBaseDir: join(root, 'snapshots'),
	})
	return {store, root}
}

describe('FilesystemAgentScopedMemoryStore — 三 scope 隔离', () => {
	let store: FilesystemAgentScopedMemoryStore
	let root: string

	beforeEach(async () => {
		const made = await makeStore()
		store = made.store
		root = made.root
	})

	afterEach(async () => {
		await rm(root, {recursive: true, force: true})
	})

	it('三 scope 写入 + load 不串扰', async () => {
		await store.write('reviewer', 'user', 'MEMORY.md', 'user content')
		await store.write('reviewer', 'project', 'MEMORY.md', 'project content')
		await store.write('reviewer', 'local', 'MEMORY.md', 'local content')

		expect(await store.load('reviewer', 'user')).toContain('user content')
		expect(await store.load('reviewer', 'project')).toContain('project content')
		expect(await store.load('reviewer', 'local')).toContain('local content')
	})

	it('load 不存在的 scope 返空字符串（不抛错）', async () => {
		expect(await store.load('nonexistent', 'user')).toBe('')
	})

	it('list 列出 *.md 文件，按字母序', async () => {
		await store.write('reviewer', 'user', 'b.md', 'b')
		await store.write('reviewer', 'user', 'a.md', 'a')
		await store.write('reviewer', 'user', 'c.md', 'c')
		const files = await store.list('reviewer', 'user')
		expect(files).toEqual(['a.md', 'b.md', 'c.md'])
	})

	it('delete 已存在文件 + idempotent', async () => {
		await store.write('reviewer', 'user', 'MEMORY.md', 'x')
		await store.delete('reviewer', 'user', 'MEMORY.md')
		expect(await store.list('reviewer', 'user')).toEqual([])
		// 重复 delete 不抛错
		await store.delete('reviewer', 'user', 'MEMORY.md')
		await store.delete('reviewer', 'user', 'never-existed.md')
	})

	it('agent type 含 : → sanitize 为 -（Windows 兼容）', async () => {
		await store.write('my-plugin:my-agent', 'user', 'MEMORY.md', 'plugin content')
		expect(await store.load('my-plugin:my-agent', 'user')).toContain('plugin content')
		// 实际目录名应是 my-plugin-my-agent
		const userDir = join(root, 'user')
		const dirents = await readdir(userDir)
		expect(dirents).toContain('my-plugin-my-agent')
	})

	it('load 多文件按文件名排序拼接 + 注入文件名注释', async () => {
		await store.write('reviewer', 'user', 'a.md', 'AAA')
		await store.write('reviewer', 'user', 'b.md', 'BBB')
		const content = await store.load('reviewer', 'user')
		expect(content).toContain('<!-- a.md -->')
		expect(content).toContain('<!-- b.md -->')
		expect(content.indexOf('a.md')).toBeLessThan(content.indexOf('b.md'))
	})
})

describe('FilesystemAgentScopedMemoryStore — Snapshot 同步', () => {
	let store: FilesystemAgentScopedMemoryStore
	let root: string

	beforeEach(async () => {
		const made = await makeStore()
		store = made.store
		root = made.root
	})

	afterEach(async () => {
		await rm(root, {recursive: true, force: true})
	})

	it('checkSnapshot: 无 snapshot → none', async () => {
		const r = await store.checkSnapshot('reviewer', 'user')
		expect(r).toEqual({action: 'none'})
	})

	it('checkSnapshot: 有 snapshot 但无本地 → initialize', async () => {
		const ts = '2026-05-25T10:00:00Z'
		await store.writeSnapshot('reviewer', 'MEMORY.md', 'team learned', ts)
		const r = await store.checkSnapshot('reviewer', 'user')
		expect(r).toEqual({action: 'initialize', snapshotTimestamp: ts})
	})

	it('checkSnapshot: snapshot 比本地 syncedFrom 新 → prompt-update', async () => {
		await store.write('reviewer', 'user', 'MEMORY.md', 'old local')
		const oldTs = '2026-05-20T10:00:00Z'
		const newTs = '2026-05-25T10:00:00Z'
		await store.markSnapshotSynced('reviewer', 'user', oldTs)
		await store.writeSnapshot('reviewer', 'MEMORY.md', 'newer team', newTs)
		const r = await store.checkSnapshot('reviewer', 'user')
		expect(r).toEqual({action: 'prompt-update', snapshotTimestamp: newTs})
	})

	it('checkSnapshot: 已同步 → none', async () => {
		const ts = '2026-05-25T10:00:00Z'
		await store.write('reviewer', 'user', 'MEMORY.md', 'local')
		await store.writeSnapshot('reviewer', 'MEMORY.md', 'team', ts)
		await store.markSnapshotSynced('reviewer', 'user', ts)
		const r = await store.checkSnapshot('reviewer', 'user')
		expect(r).toEqual({action: 'none'})
	})

	it('initializeFromSnapshot: 拷贝 snapshot 到本地 + 写 syncedFrom', async () => {
		const ts = '2026-05-25T10:00:00Z'
		await store.writeSnapshot('reviewer', 'MEMORY.md', 'team learned', ts)
		await store.writeSnapshot('reviewer', 'patterns.md', 'patterns body', ts)

		await store.initializeFromSnapshot('reviewer', 'user', ts)

		const localFiles = await store.list('reviewer', 'user')
		expect(localFiles).toContain('MEMORY.md')
		expect(localFiles).toContain('patterns.md')
		expect(await store.load('reviewer', 'user')).toContain('team learned')
		expect(await store.load('reviewer', 'user')).toContain('patterns body')

		// 后续 check 应返 none
		const check = await store.checkSnapshot('reviewer', 'user')
		expect(check.action).toBe('none')
	})

	it('replaceFromSnapshot: 删本地 .md 后再拷贝', async () => {
		await store.write('reviewer', 'user', 'old.md', 'old content')
		await store.write('reviewer', 'user', 'MEMORY.md', 'old MEMORY')

		const ts = '2026-05-25T10:00:00Z'
		await store.writeSnapshot('reviewer', 'MEMORY.md', 'new MEMORY from team', ts)

		await store.replaceFromSnapshot('reviewer', 'user', ts)

		const files = await store.list('reviewer', 'user')
		// old.md 应被删除（snapshot 没有它），MEMORY.md 应被新内容覆盖
		expect(files).toEqual(['MEMORY.md'])
		expect(await store.load('reviewer', 'user')).toContain('new MEMORY from team')
		expect(await store.load('reviewer', 'user')).not.toContain('old content')
	})

	it('markSnapshotSynced: 不动 .md 文件，仅更新 syncedFrom', async () => {
		await store.write('reviewer', 'user', 'MEMORY.md', 'untouched')
		const ts = '2026-05-25T10:00:00Z'
		await store.writeSnapshot('reviewer', 'MEMORY.md', 'snap', ts)
		await store.markSnapshotSynced('reviewer', 'user', ts)

		// 本地 MEMORY.md 应保持原样
		expect(await store.load('reviewer', 'user')).toContain('untouched')
		// 但 check 应返 none
		const check = await store.checkSnapshot('reviewer', 'user')
		expect(check.action).toBe('none')
	})

	it('atomic write: 不留 .tmp 文件', async () => {
		await store.write('reviewer', 'user', 'MEMORY.md', 'content')
		const userDir = join(root, 'user', 'reviewer')
		const dirents = await readdir(userDir)
		expect(dirents.every(d => !d.includes('.tmp.'))).toBe(true)
	})
})

describe('FilesystemAgentScopedMemoryStore — 边界与容错', () => {
	let store: FilesystemAgentScopedMemoryStore
	let root: string

	beforeEach(async () => {
		const made = await makeStore()
		store = made.store
		root = made.root
	})

	afterEach(async () => {
		await rm(root, {recursive: true, force: true})
	})

	it('snapshot.json 损坏 → checkSnapshot 返 none（fault-tolerant）', async () => {
		const snapDir = join(root, 'snapshots', 'reviewer')
		await mkdir(snapDir, {recursive: true})
		await writeFile(join(snapDir, 'snapshot.json'), '{this is not valid json')
		const r = await store.checkSnapshot('reviewer', 'user')
		expect(r).toEqual({action: 'none'})
	})

	it('write 覆盖同名文件', async () => {
		await store.write('reviewer', 'user', 'MEMORY.md', 'v1')
		await store.write('reviewer', 'user', 'MEMORY.md', 'v2')
		const content = await store.load('reviewer', 'user')
		expect(content).toContain('v2')
		expect(content).not.toContain('v1')
	})

	it('writeSnapshot 含中文内容', async () => {
		const ts = '2026-05-25T10:00:00Z'
		await store.writeSnapshot('reviewer', 'MEMORY.md', '中文记忆 + emoji 🎯', ts)
		await store.initializeFromSnapshot('reviewer', 'user', ts)
		expect(await store.load('reviewer', 'user')).toContain('中文记忆 + emoji 🎯')
	})
})
