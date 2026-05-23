/**
 * InMemoryMemoryStore — 默认 MemoryStore 实现
 *
 * 进程内 Map<MemoryRef, MemoryEntry>。重启清空。够 SDK demo 与单进程
 * agent 演示。持久化版（SqliteMemoryStore / VectorMemoryStore）实现
 * 相同接口即可替换。
 *
 * search() 关键词匹配（不区分大小写、子串包含）；命中后按 importance
 * desc + createdAt desc 排序，便于 model 优先看到"重要且新"的事实。
 */

import {randomUUID} from 'crypto'

import type {
	MemoryEntry,
	MemoryEntryInput,
	MemoryQuery,
	MemoryRef,
	MemoryStore,
} from './types.js'

export class InMemoryMemoryStore implements MemoryStore {
	private readonly entries = new Map<MemoryRef, MemoryEntry>()

	async put(entry: MemoryEntryInput): Promise<MemoryRef> {
		const ref: MemoryRef = randomUUID()
		const stored: MemoryEntry = {
			ref,
			createdAt: new Date().toISOString(),
			...entry,
		}
		this.entries.set(ref, stored)
		return ref
	}

	async get(ref: MemoryRef): Promise<MemoryEntry | undefined> {
		const entry = this.entries.get(ref)
		if (!entry) return undefined
		if (isExpired(entry)) {
			this.entries.delete(ref)
			return undefined
		}
		return entry
	}

	async delete(ref: MemoryRef): Promise<void> {
		this.entries.delete(ref)
	}

	async search(query: MemoryQuery): Promise<readonly MemoryEntry[]> {
		const all = [...this.entries.values()].filter(e => !isExpired(e))
		const filtered = all.filter(e => matches(e, query))
		filtered.sort((a, b) => {
			const ai = a.importance ?? 0
			const bi = b.importance ?? 0
			if (ai !== bi) return bi - ai
			return b.createdAt.localeCompare(a.createdAt)
		})
		const limit = query.limit ?? filtered.length
		return filtered.slice(0, Math.max(0, limit))
	}

	async *list(namespace?: string): AsyncIterable<MemoryEntry> {
		for (const entry of this.entries.values()) {
			if (isExpired(entry)) continue
			if (namespace !== undefined && entry.namespace !== namespace) continue
			yield entry
		}
	}
}

function isExpired(entry: MemoryEntry): boolean {
	if (!entry.expiresAt) return false
	return Date.parse(entry.expiresAt) <= Date.now()
}

function matches(entry: MemoryEntry, query: MemoryQuery): boolean {
	if (query.namespace !== undefined && entry.namespace !== query.namespace) {
		return false
	}
	if (query.text !== undefined) {
		const needle = query.text.toLowerCase()
		if (!entry.content.toLowerCase().includes(needle)) return false
	}
	if (query.tags && query.tags.length > 0) {
		const tags = new Set(entry.tags ?? [])
		if (!query.tags.every(t => tags.has(t))) return false
	}
	if (query.since !== undefined && entry.createdAt < query.since) {
		return false
	}
	return true
}
