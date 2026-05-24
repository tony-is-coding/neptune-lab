/**
 * AuditEventStore.test.ts — hash chain 完整性 + 篡改检出
 */

import {describe, it, expect, beforeEach, afterEach} from 'bun:test'
import {mkdtemp, rm, readFile, writeFile, mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'crypto'
import {FilesystemAuditStore, NoopAuditStore, GENESIS_HASH, canonicalJson, computeHash} from '../index.js'

describe('canonicalJson — deterministic serialization', () => {
	it('object keys 按字典序排序', () => {
		const a = canonicalJson({b: 2, a: 1, c: 3})
		const b = canonicalJson({c: 3, a: 1, b: 2})
		expect(a).toBe(b)
		expect(a).toBe('{"a":1,"b":2,"c":3}')
	})

	it('nested object 递归排序', () => {
		const a = canonicalJson({outer: {z: 1, a: 2}})
		expect(a).toBe('{"outer":{"a":2,"z":1}}')
	})

	it('array 保持原顺序', () => {
		expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]')
	})

	it('undefined 字段被跳过', () => {
		const r = canonicalJson({a: 1, b: undefined, c: 3})
		expect(r).toBe('{"a":1,"c":3}')
	})

	it('null 保留', () => {
		expect(canonicalJson({a: null})).toBe('{"a":null}')
	})

	it('原始类型直接返回', () => {
		expect(canonicalJson('hello')).toBe('"hello"')
		expect(canonicalJson(42)).toBe('42')
		expect(canonicalJson(true)).toBe('true')
		expect(canonicalJson(null)).toBe('null')
	})
})

describe('FilesystemAuditStore — hash chain 完整性', () => {
	let dir: string
	let store: FilesystemAuditStore
	let runId: string

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'nep-audit-'))
		store = new FilesystemAuditStore(dir)
		runId = randomUUID()
		// 创建 run 目录（FilesystemAuditStore 自己不 mkdir，append 时会自动）
	})

	afterEach(async () => {
		await rm(dir, {recursive: true, force: true})
	})

	it('append 第一条 → index=0, prevHash=GENESIS', async () => {
		const e = await store.append(runId, {kind: 'tool_use', name: 'Echo'})
		expect(e.index).toBe(0)
		expect(e.prevHash).toBe(GENESIS_HASH)
		expect(e.hash).toMatch(/^[0-9a-f]{64}$/)
		expect(e.ts).toBeDefined()
	})

	it('多次 append → index 单调递增 + prevHash 正确链', async () => {
		const e1 = await store.append(runId, {a: 1})
		const e2 = await store.append(runId, {a: 2})
		const e3 = await store.append(runId, {a: 3})
		expect(e1.index).toBe(0)
		expect(e2.index).toBe(1)
		expect(e3.index).toBe(2)
		expect(e2.prevHash).toBe(e1.hash)
		expect(e3.prevHash).toBe(e2.hash)
	})

	it('verify 全 chain 通过', async () => {
		for (let i = 0; i < 5; i++) await store.append(runId, {n: i})
		const r = await store.verify(runId)
		expect(r.valid).toBe(true)
	})

	it('空 chain → verify valid:true', async () => {
		const r = await store.verify(runId)
		expect(r.valid).toBe(true)
	})

	it('篡改中间 event payload → verify 检出', async () => {
		for (let i = 0; i < 5; i++) await store.append(runId, {n: i})
		// 直接改 jsonl 中第 2 行的 payload
		const path = join(dir, runId, 'audit.jsonl')
		const raw = await readFile(path, 'utf8')
		const lines = raw.trim().split('\n')
		const tampered = JSON.parse(lines[2]!) as {payload: {n: number}}
		tampered.payload = {n: 999} // 改 payload
		lines[2] = JSON.stringify(tampered)
		await writeFile(path, lines.join('\n') + '\n')

		const r = await store.verify(runId)
		expect(r.valid).toBe(false)
		expect(r.firstBadIndex).toBe(2)
		expect(r.reason).toContain('hash mismatch')
	})

	it('篡改中间 event hash → verify 检出（链断裂）', async () => {
		for (let i = 0; i < 5; i++) await store.append(runId, {n: i})
		const path = join(dir, runId, 'audit.jsonl')
		const raw = await readFile(path, 'utf8')
		const lines = raw.trim().split('\n')
		const tampered = JSON.parse(lines[2]!) as {hash: string}
		tampered.hash = 'a'.repeat(64) // 改 hash
		lines[2] = JSON.stringify(tampered)
		await writeFile(path, lines.join('\n') + '\n')

		const r = await store.verify(runId)
		expect(r.valid).toBe(false)
		// 改 hash 后：当前 event hash 重算不匹配（错在 index 2）
		// + 下一个 event 的 prevHash 也不匹配（错在 index 3）
		// firstBadIndex 取最先发现的
		expect(r.firstBadIndex).toBeLessThanOrEqual(3)
	})

	it('篡改末尾 event → verify 检出', async () => {
		for (let i = 0; i < 5; i++) await store.append(runId, {n: i})
		const path = join(dir, runId, 'audit.jsonl')
		const raw = await readFile(path, 'utf8')
		const lines = raw.trim().split('\n')
		const tampered = JSON.parse(lines[4]!) as {payload: unknown}
		tampered.payload = {tamper: true}
		lines[4] = JSON.stringify(tampered)
		await writeFile(path, lines.join('\n') + '\n')

		const r = await store.verify(runId)
		expect(r.valid).toBe(false)
		expect(r.firstBadIndex).toBe(4)
	})

	it('删除中间 event → verify 检出（index 不连续）', async () => {
		for (let i = 0; i < 5; i++) await store.append(runId, {n: i})
		const path = join(dir, runId, 'audit.jsonl')
		const raw = await readFile(path, 'utf8')
		const lines = raw.trim().split('\n')
		// 删除 index=2 的行
		lines.splice(2, 1)
		await writeFile(path, lines.join('\n') + '\n')

		const r = await store.verify(runId)
		expect(r.valid).toBe(false)
	})

	it('load 顺序保留', async () => {
		const inputs = [{a: 1}, {a: 2}, {a: 3}, {a: 4}]
		for (const p of inputs) await store.append(runId, p)
		const loaded = await store.load(runId)
		expect(loaded.length).toBe(4)
		expect(loaded.map(e => e.index)).toEqual([0, 1, 2, 3])
		expect(loaded.map(e => (e.payload as {a: number}).a)).toEqual([1, 2, 3, 4])
	})

	it('跨实例 load + verify 通过', async () => {
		await store.append(runId, {first: true})
		await store.append(runId, {second: true})
		// 新实例
		const store2 = new FilesystemAuditStore(dir)
		const events = await store2.load(runId)
		expect(events.length).toBe(2)
		const r = await store2.verify(runId)
		expect(r.valid).toBe(true)
	})

	it('跨实例 append 续链（cache miss 时 reload lastHash）', async () => {
		const e1 = await store.append(runId, {a: 1})
		// 新实例（不共享内存 cache）
		const store2 = new FilesystemAuditStore(dir)
		const e2 = await store2.append(runId, {a: 2})
		expect(e2.index).toBe(1)
		expect(e2.prevHash).toBe(e1.hash)
		// verify 全链
		const r = await store2.verify(runId)
		expect(r.valid).toBe(true)
	})

	it('payload 含 nested object → canonical 排序保证 hash 一致', async () => {
		// 同一个语义的 payload 用不同 key 顺序 → 必须产生相同 hash
		const e1 = await store.append(runId, {b: 2, a: 1, nested: {y: 'y', x: 'x'}})
		const expectedHash = computeHash(GENESIS_HASH, {
			index: 0,
			payload: {a: 1, b: 2, nested: {x: 'x', y: 'y'}},
			ts: e1.ts,
		})
		expect(e1.hash).toBe(expectedHash)
	})
})

describe('NoopAuditStore', () => {
	it('append 返回填好的 event 但不持久化', async () => {
		const store = new NoopAuditStore()
		const runId = 'r1'
		const e1 = await store.append(runId, {a: 1})
		const e2 = await store.append(runId, {a: 2})
		expect(e1.index).toBe(0)
		expect(e2.index).toBe(1)
		expect(e2.prevHash).toBe(e1.hash)

		// load 返 [] —— Noop 不持久化
		expect(await store.load(runId)).toEqual([])
		// verify 总返 valid
		expect(await store.verify(runId)).toEqual({valid: true})
	})

	it('不同 runId 隔离', async () => {
		const store = new NoopAuditStore()
		const e1 = await store.append('r1', {a: 1})
		const e2 = await store.append('r2', {a: 2})
		expect(e1.index).toBe(0)
		expect(e2.index).toBe(0)
		expect(e1.hash).not.toBe(e2.hash) // 不同 runId 链独立
	})
})
