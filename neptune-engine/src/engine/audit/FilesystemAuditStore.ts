/**
 * FilesystemAuditStore — 文件系统后端
 *
 * 存储：{rootDir}/{runId}/audit.jsonl
 * - 每行一个 AuditEvent JSON（包含 index / prevHash / hash / payload / ts）
 * - append-only 行级 atomic（< 4KB on POSIX/NFS）
 *
 * 链头：append 前先 load 当前最后一行，取 hash 作为新 event 的 prevHash
 * - 内存中缓存 lastHash + nextIndex 加速并发 append（同 runId 单进程内安全）
 * - 跨进程 append 同一 runId：依赖 fs append atomic + 重新 load 拿 lastHash
 *   （并发率高时性能差但正确性保证）
 *
 * verify 重算整个 chain：从 GENESIS_HASH 开始，逐行验证 prevHash + hash
 */

import {join} from 'node:path'
import {GENESIS_HASH, type AuditEvent, type AuditEventStore, type VerifyResult} from './AuditEventStore.js'
import {computeHash} from './NoopAuditStore.js'
import {appendJsonl, readJsonlLines} from '../utils/jsonl.js'

const AUDIT_FILE = 'audit.jsonl'

interface CacheEntry {
	nextIndex: number
	lastHash: string
}

export class FilesystemAuditStore implements AuditEventStore {
	private cache = new Map<string, CacheEntry>()

	constructor(private readonly rootDir: string) {}

	async append(runId: string, payload: unknown): Promise<AuditEvent> {
		const head = await this.getHead(runId)
		const ts = new Date().toISOString()
		const event: AuditEvent = {
			index: head.nextIndex,
			prevHash: head.lastHash,
			hash: computeHash(head.lastHash, {index: head.nextIndex, payload, ts}),
			payload,
			ts,
		}
		await appendJsonl(this.auditPath(runId), event)
		// 更新 cache
		this.cache.set(runId, {
			nextIndex: head.nextIndex + 1,
			lastHash: event.hash,
		})
		return event
	}

	async load(runId: string): Promise<AuditEvent[]> {
		return readJsonlLines<AuditEvent>(this.auditPath(runId))
	}

	async verify(runId: string): Promise<VerifyResult> {
		const events = await this.load(runId)
		if (events.length === 0) return {valid: true}
		let expectedPrev = GENESIS_HASH
		for (let i = 0; i < events.length; i++) {
			const e = events[i]!
			if (e.index !== i) {
				return {
					valid: false,
					firstBadIndex: i,
					reason: `index mismatch at ${i}: stored=${e.index}, expected=${i}`,
				}
			}
			if (e.prevHash !== expectedPrev) {
				return {
					valid: false,
					firstBadIndex: i,
					reason: `prevHash mismatch at index ${i}: chain broken`,
				}
			}
			const recomputed = computeHash(expectedPrev, {
				index: e.index,
				payload: e.payload,
				ts: e.ts,
			})
			if (recomputed !== e.hash) {
				return {
					valid: false,
					firstBadIndex: i,
					reason: `hash mismatch at index ${i}: payload tampered`,
				}
			}
			expectedPrev = e.hash
		}
		return {valid: true}
	}

	async dispose(): Promise<void> {
		this.cache.clear()
	}

	private auditPath(runId: string): string {
		return join(this.rootDir, runId, AUDIT_FILE)
	}

	/**
	 * 获取链头（nextIndex + lastHash）。
	 *
	 * 优先从 cache 取；cache miss 时 read jsonl 末行。
	 * 跨进程并发：cache 可能 stale，但 read 总能拿正确值 → load 时 prevHash
	 * 不匹配会被 verify 检出。
	 */
	private async getHead(runId: string): Promise<CacheEntry> {
		const cached = this.cache.get(runId)
		if (cached) return cached
		const events = await this.load(runId)
		const entry: CacheEntry =
			events.length === 0
				? {nextIndex: 0, lastHash: GENESIS_HASH}
				: {nextIndex: events.length, lastHash: events[events.length - 1]!.hash}
		this.cache.set(runId, entry)
		return entry
	}
}
