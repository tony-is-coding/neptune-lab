/**
 * FilesystemMemoryStore — 用户记忆存储的文件系统实现
 *
 * 设计：每个 userId 一个 jsonl 文件，每行 `{key, value, deleted?}`，last-wins 语义。
 * - save：append 一行 {key, value}
 * - load：从后往前扫，第一个匹配 key 即返
 * - delete：append 一行 {key, deleted: true} 软删除（后续 list/load 跳过）
 * - list：扫全文，构建 key→value map（last-wins），过滤 deleted
 * - clear：unlink
 *
 * 优势：
 * - 写入 O(1)（append-only）
 * - NFS 安全（行 < 4KB）
 * - 崩溃容错（末行截断 skip）
 *
 * 劣势：长生命周期下 jsonl 会膨胀，未来需要 compaction（compactionLog 后续做）
 */

import {unlink} from 'node:fs/promises'
import {join} from 'node:path'
import type {IMemoryStore} from './IMemoryStore.js'
import {appendJsonl, readJsonlLines} from '../utils/jsonl.js'
import {sanitizePath} from '../utils/sanitizePath.js'

interface MemoryEntry {
	key: string
	value?: unknown
	deleted?: boolean
	ts: number
}

export class FilesystemMemoryStore implements IMemoryStore {
	constructor(private readonly rootDir: string) {}

	async save(userId: string, key: string, value: unknown): Promise<void> {
		const entry: MemoryEntry = {key, value, ts: Date.now()}
		await appendJsonl(this.pathFor(userId), entry)
	}

	async load(userId: string, key: string): Promise<unknown | undefined> {
		const all = await readJsonlLines<MemoryEntry>(this.pathFor(userId))
		// 反向扫，last-wins
		for (let i = all.length - 1; i >= 0; i--) {
			const entry = all[i]!
			if (entry.key === key) {
				return entry.deleted ? undefined : entry.value
			}
		}
		return undefined
	}

	async delete(userId: string, key: string): Promise<void> {
		const entry: MemoryEntry = {key, deleted: true, ts: Date.now()}
		await appendJsonl(this.pathFor(userId), entry)
	}

	async list(
		userId: string,
		prefix?: string,
	): Promise<Array<{key: string; value: unknown}>> {
		const all = await readJsonlLines<MemoryEntry>(this.pathFor(userId))
		// 构建 last-wins map
		const map = new Map<string, MemoryEntry>()
		for (const entry of all) {
			map.set(entry.key, entry)
		}
		const result: Array<{key: string; value: unknown}> = []
		for (const [k, entry] of map) {
			if (entry.deleted) continue
			if (prefix !== undefined && !k.startsWith(prefix)) continue
			result.push({key: k, value: entry.value})
		}
		return result
	}

	async clear(userId: string): Promise<void> {
		try {
			await unlink(this.pathFor(userId))
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
			throw err
		}
	}

	async dispose(): Promise<void> {
		// no-op
	}

	private pathFor(userId: string): string {
		// userId 可能含特殊字符（如 email），sanitize 后作为文件名
		return join(this.rootDir, `${sanitizePath(userId)}.memory.jsonl`)
	}
}
