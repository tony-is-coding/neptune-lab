/**
 * LocalArtifactStore.test.ts — Stage 4.4 content-addressable 测试
 */

import {describe, expect, it, beforeEach, afterEach} from 'bun:test'
import {mkdtemp, rm, readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {LocalArtifactStore} from '../index.js'
import type {ArtifactInput} from '../../governance/index.js'

function input(content: string | Uint8Array, hint?: string): ArtifactInput {
	return {
		runId: 'r1',
		toolInvocationId: 't1',
		source: {
			toolName: 'TestTool',
			agentTemplateVersion: 'v1',
		},
		content,
		mime: 'text/plain',
		hint,
	}
}

describe('LocalArtifactStore', () => {
	let dir: string
	let store: LocalArtifactStore

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'nep-art-'))
		store = new LocalArtifactStore(dir)
	})

	afterEach(async () => {
		await rm(dir, {recursive: true, force: true})
	})

	it('persistArtifact 写入 fs + 返回 EvidenceArtifact', async () => {
		const a = await store.persistArtifact(input('hello'))
		expect(a.id).toBeDefined()
		expect(a.hash).toMatch(/^sha256:[0-9a-f]{64}$/)
		expect(a.mime).toBe('text/plain')
		expect(a.kind).toBe('attachment') // 无 hint
		expect(a.source.toolName).toBe('TestTool')

		// 读回内容
		const data = await store.read(a.hash)
		expect(data).not.toBeNull()
		expect(new TextDecoder().decode(data!)).toBe('hello')
	})

	it('hint 传递到 EvidenceArtifact.kind', async () => {
		const a = await store.persistArtifact(input('voucher-data', 'voucher'))
		expect(a.kind).toBe('voucher')
	})

	it('相同 content 自动 dedup（hash 相同，文件不重写）', async () => {
		const a1 = await store.persistArtifact(input('same content'))
		const a2 = await store.persistArtifact(input('same content'))
		// hash 相同
		expect(a1.hash).toBe(a2.hash)
		// id 不同（每次新生成）
		expect(a1.id).not.toBe(a2.id)
		// 文件应该只有一个（content-addressable）
		const cleanHash = a1.hash.replace(/^sha256:/, '')
		const path = join(dir, 'artifacts', cleanHash.slice(0, 2), cleanHash)
		const data = await readFile(path, 'utf8')
		expect(data).toBe('same content')
	})

	it('Uint8Array 二进制 content', async () => {
		const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) // PNG header
		const a = await store.persistArtifact({
			...input(bytes),
			mime: 'image/png',
		})
		expect(a.mime).toBe('image/png')
		const read = await store.read(a.hash)
		expect(Array.from(read!)).toEqual([0x89, 0x50, 0x4e, 0x47])
	})

	it('read 不存在 hash → null', async () => {
		const r = await store.read('sha256:' + 'a'.repeat(64))
		expect(r).toBeNull()
	})

	it('has() 检查存在性', async () => {
		const a = await store.persistArtifact(input('exists'))
		expect(await store.has(a.hash)).toBe(true)
		expect(await store.has('sha256:' + 'b'.repeat(64))).toBe(false)
	})

	it('文件路径分桶：artifacts/{hash[:2]}/{hash}', async () => {
		const a = await store.persistArtifact(input('test'))
		const cleanHash = a.hash.replace(/^sha256:/, '')
		const expectedPath = join(dir, 'artifacts', cleanHash.slice(0, 2), cleanHash)
		const data = await readFile(expectedPath, 'utf8')
		expect(data).toBe('test')
	})

	it('source 字段完整透传', async () => {
		const a = await store.persistArtifact({
			...input('x'),
			source: {
				toolName: 'PaymentTool',
				agentTemplateVersion: 'v2.4.0',
				connectorVersion: 'stripe@2024-01',
			},
		})
		expect(a.source.toolName).toBe('PaymentTool')
		expect(a.source.agentTemplateVersion).toBe('v2.4.0')
		expect(a.source.connectorVersion).toBe('stripe@2024-01')
	})
})
