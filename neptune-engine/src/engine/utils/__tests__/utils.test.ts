/**
 * utils.test.ts — sanitizePath / atomicWrite / jsonl 单测
 */

import {describe, expect, it, beforeEach, afterEach} from 'bun:test'
import {mkdtemp, rm, readFile, writeFile, stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {
	sanitizePath,
	MAX_SANITIZED_LENGTH,
	atomicWrite,
	appendJsonl,
	readJsonlLines,
	streamJsonlLines,
} from '../index.js'

describe('sanitizePath', () => {
	it('alphanumeric 不变', () => {
		expect(sanitizePath('hello123')).toBe('hello123')
	})

	it('特殊字符替换为 -', () => {
		expect(sanitizePath('/Users/foo/my-project')).toBe('-Users-foo-my-project')
		expect(sanitizePath('plugin:name:server')).toBe('plugin-name-server')
		expect(sanitizePath('a.b.c')).toBe('a-b-c')
	})

	it('200 字符内不截断', () => {
		const s = 'a'.repeat(200)
		expect(sanitizePath(s)).toBe(s)
		expect(sanitizePath(s).length).toBe(200)
	})

	it('超过 200 字符 → 截断 + hash 后缀', () => {
		const s = 'a'.repeat(300)
		const result = sanitizePath(s)
		expect(result.length).toBeLessThan(220) // 200 + dash + hash
		expect(result.startsWith('a'.repeat(MAX_SANITIZED_LENGTH))).toBe(true)
		expect(result).toContain('-')
	})

	it('hash 决定性：相同 input → 相同 output', () => {
		const s = 'unicode/path/' + 'x'.repeat(300)
		expect(sanitizePath(s)).toBe(sanitizePath(s))
	})
})

describe('atomicWrite', () => {
	let dir: string
	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'nep-test-'))
	})
	afterEach(async () => {
		await rm(dir, {recursive: true, force: true})
	})

	it('写文件成功', async () => {
		const p = join(dir, 'foo.json')
		await atomicWrite(p, '{"a":1}')
		const content = await readFile(p, 'utf8')
		expect(content).toBe('{"a":1}')
	})

	it('父目录不存在时自动 mkdir', async () => {
		const p = join(dir, 'sub', 'nested', 'foo.txt')
		await atomicWrite(p, 'hello')
		expect((await readFile(p, 'utf8'))).toBe('hello')
	})

	it('Uint8Array 二进制写入', async () => {
		const p = join(dir, 'bin')
		const buf = new Uint8Array([1, 2, 3, 4])
		await atomicWrite(p, buf)
		const out = await readFile(p)
		expect(Array.from(out.values())).toEqual([1, 2, 3, 4])
	})

	it('完成后无 .tmp 文件残留', async () => {
		const p = join(dir, 'foo')
		await atomicWrite(p, 'x')
		const {readdir} = await import('node:fs/promises')
		const entries = await readdir(dir)
		expect(entries.filter(e => e.startsWith('.foo.tmp'))).toEqual([])
	})
})

describe('appendJsonl + readJsonlLines', () => {
	let dir: string
	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'nep-jsonl-'))
	})
	afterEach(async () => {
		await rm(dir, {recursive: true, force: true})
	})

	it('append 单条 + read', async () => {
		const p = join(dir, 'log.jsonl')
		await appendJsonl(p, {a: 1})
		const lines = await readJsonlLines(p)
		expect(lines).toEqual([{a: 1}])
	})

	it('append 多条 + read 顺序保留', async () => {
		const p = join(dir, 'log.jsonl')
		for (let i = 0; i < 5; i++) await appendJsonl(p, {i})
		const lines = await readJsonlLines<{i: number}>(p)
		expect(lines.map(l => l.i)).toEqual([0, 1, 2, 3, 4])
	})

	it('文件不存在 → readJsonlLines 返空数组', async () => {
		const p = join(dir, 'nonexistent.jsonl')
		const lines = await readJsonlLines(p)
		expect(lines).toEqual([])
	})

	it('末行截断（崩溃模拟）→ skip', async () => {
		const p = join(dir, 'log.jsonl')
		await appendJsonl(p, {ok: 1})
		await appendJsonl(p, {ok: 2})
		// 模拟崩溃：手动追加半行
		const {appendFile} = await import('node:fs/promises')
		await appendFile(p, '{"truncated":')
		const lines = await readJsonlLines<{ok?: number; truncated?: number}>(p)
		expect(lines.map(l => l.ok)).toEqual([1, 2])
	})

	it('streamJsonlLines yield 顺序正确', async () => {
		const p = join(dir, 'log.jsonl')
		for (let i = 0; i < 3; i++) await appendJsonl(p, {n: i})
		const collected: number[] = []
		for await (const item of streamJsonlLines<{n: number}>(p)) {
			collected.push(item.n)
		}
		expect(collected).toEqual([0, 1, 2])
	})

	it('mkdirParents：父目录不存在时自动创建', async () => {
		const p = join(dir, 'a', 'b', 'log.jsonl')
		await appendJsonl(p, {hi: 1})
		const lines = await readJsonlLines(p)
		expect(lines).toEqual([{hi: 1}])
	})
})
