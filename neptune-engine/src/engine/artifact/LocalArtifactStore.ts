/**
 * LocalArtifactStore — Filesystem 实现 ArtifactHook
 *
 * Stage 4.4 — content-addressable 落盘：
 * - 文件名用 sha256 hash，相同 content 自动 dedup
 * - 路径分桶：{rootDir}/artifacts/{hash[:2]}/{hash} 防止单目录文件爆炸
 * - 配套读取 API：read(hash) → Uint8Array | null
 *
 * 与 cc 行为差异：
 * - cc 没有专门的 ArtifactStore；把 artifact 作为 message attachment 内联
 *   传输；这里抽象为独立 store 让 product 可注入更安全的后端（S3 / signed
 *   URL）
 */

import {createHash} from 'node:crypto'
import {join, dirname} from 'node:path'
import {readFile, mkdir, stat} from 'node:fs/promises'
import {randomUUID} from 'crypto'
import type {EvidenceArtifact} from '@shared/contracts'
import type {ArtifactHook, ArtifactInput} from '../governance/index.js'
import {atomicWrite} from '../utils/atomicWrite.js'

export class LocalArtifactStore implements ArtifactHook {
	constructor(private readonly rootDir: string) {}

	async persistArtifact(input: ArtifactInput): Promise<EvidenceArtifact> {
		const hash = computeContentHash(input.content)
		const path = this.pathFor(hash)
		// dedup：内容已在则跳过写入
		const exists = await this.existsAt(path)
		if (!exists) {
			await mkdir(dirname(path), {recursive: true})
			await atomicWrite(path, normalizeContent(input.content))
		}
		return {
			id: randomUUID(),
			kind: input.hint ?? 'attachment',
			mime: input.mime,
			createdAt: new Date().toISOString(),
			hash: `sha256:${hash}`,
			source: {
				toolName: input.source.toolName,
				agentTemplateVersion: input.source.agentTemplateVersion,
				connectorVersion: input.source.connectorVersion,
			},
		}
	}

	/** 按 hash 读 artifact 内容（不存在返 null）。 */
	async read(hash: string): Promise<Uint8Array | null> {
		// hash 可能含 sha256: 前缀，剥掉
		const cleanHash = hash.replace(/^sha256:/, '')
		const path = this.pathFor(cleanHash)
		try {
			const buf = await readFile(path)
			return new Uint8Array(buf)
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
			throw err
		}
	}

	/** 检查 artifact 是否已存在（不读内容）。 */
	async has(hash: string): Promise<boolean> {
		const cleanHash = hash.replace(/^sha256:/, '')
		return this.existsAt(this.pathFor(cleanHash))
	}

	private pathFor(hash: string): string {
		// {rootDir}/artifacts/{hash[:2]}/{hash}
		return join(this.rootDir, 'artifacts', hash.slice(0, 2), hash)
	}

	private async existsAt(path: string): Promise<boolean> {
		try {
			await stat(path)
			return true
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
			throw err
		}
	}
}

function computeContentHash(content: string | Uint8Array | ArrayBuffer): string {
	const h = createHash('sha256')
	if (typeof content === 'string') {
		h.update(content)
	} else if (content instanceof Uint8Array) {
		h.update(content)
	} else {
		h.update(new Uint8Array(content))
	}
	return h.digest('hex')
}

function normalizeContent(content: string | Uint8Array | ArrayBuffer): Uint8Array | string {
	if (typeof content === 'string') return content
	if (content instanceof Uint8Array) return content
	return new Uint8Array(content)
}
