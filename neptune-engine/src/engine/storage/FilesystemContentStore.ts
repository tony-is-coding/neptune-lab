/**
 * FilesystemContentStore — Session 内容存储的文件系统实现
 *
 * 设计：每个 sessionId 一个 jsonl 文件，append-only。
 * - append：行级 atomic（< 4KB on Linux/POSIX）
 * - read：with from / to / limit options（按行 index 切片）
 * - truncate：reload + filter + atomicWrite 替换文件
 * - count：行数（O(N) 读全文 split）
 * - clear：unlink 文件
 *
 * NFS 友好：appendFile 走 O_APPEND，并发安全（单行 < 4KB 时）
 */

import {unlink} from 'node:fs/promises'
import {join} from 'node:path'
import type {
	ISessionContentStore,
	SessionContentItem,
	ReadOptions,
} from './ISessionContentStore.js'
import {appendJsonl, readJsonlLines} from '../utils/jsonl.js'
import {atomicWrite} from '../utils/atomicWrite.js'

export class FilesystemContentStore implements ISessionContentStore {
	constructor(private readonly rootDir: string) {}

	async append(
		sessionId: string,
		content: string,
		metadata?: Record<string, unknown>,
	): Promise<void> {
		const item: SessionContentItem = {
			content,
			timestamp: Date.now(),
		}
		if (metadata !== undefined) item.metadata = metadata
		await appendJsonl(this.pathFor(sessionId), item)
	}

	async read(
		sessionId: string,
		options: ReadOptions = {},
	): Promise<SessionContentItem[]> {
		const all = await readJsonlLines<SessionContentItem>(this.pathFor(sessionId))
		const fromRaw = options.from ?? 0
		const from = fromRaw < 0 ? 0 : fromRaw
		const to = options.to !== undefined ? Math.min(options.to, all.length) : all.length
		let slice = all.slice(from, to)
		if (options.limit !== undefined && options.limit < slice.length) {
			slice = slice.slice(0, options.limit)
		}
		return slice
	}

	async truncate(sessionId: string, keepLastN: number): Promise<void> {
		const all = await readJsonlLines<SessionContentItem>(this.pathFor(sessionId))
		if (keepLastN >= all.length) return
		const kept = keepLastN <= 0 ? [] : all.slice(-keepLastN)
		const lines = kept.map(item => JSON.stringify(item)).join('\n') + (kept.length ? '\n' : '')
		await atomicWrite(this.pathFor(sessionId), lines)
	}

	async count(sessionId: string): Promise<number> {
		const all = await readJsonlLines<SessionContentItem>(this.pathFor(sessionId))
		return all.length
	}

	async clear(sessionId: string): Promise<void> {
		try {
			await unlink(this.pathFor(sessionId))
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
			throw err
		}
	}

	async dispose(): Promise<void> {
		// no-op
	}

	private pathFor(sessionId: string): string {
		return join(this.rootDir, `${sessionId}.content.jsonl`)
	}
}
