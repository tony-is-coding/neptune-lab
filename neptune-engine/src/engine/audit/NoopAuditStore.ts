/**
 * NoopAuditStore — 不持久化的占位实现，仅供测试 / 显式不需要审计场景
 *
 * 行为：
 * - append 返回填好的 AuditEvent 但不写盘
 * - load 返 []
 * - verify 总返 valid: true
 */

import {createHash} from 'node:crypto'
import {GENESIS_HASH, type AuditEvent, type AuditEventStore, type VerifyResult} from './AuditEventStore.js'
import {canonicalJson} from './canonicalJson.js'

export class NoopAuditStore implements AuditEventStore {
	private indexes = new Map<string, number>()
	private prevHashes = new Map<string, string>()

	async append(runId: string, payload: unknown): Promise<AuditEvent> {
		const index = this.indexes.get(runId) ?? 0
		const prevHash = this.prevHashes.get(runId) ?? GENESIS_HASH
		const ts = new Date().toISOString()
		const hash = computeHash(prevHash, {index, payload, ts})
		const event: AuditEvent = {index, prevHash, hash, payload, ts}
		this.indexes.set(runId, index + 1)
		this.prevHashes.set(runId, hash)
		return event
	}

	async load(_runId: string): Promise<AuditEvent[]> {
		return []
	}

	async verify(_runId: string): Promise<VerifyResult> {
		return {valid: true}
	}
}

export function computeHash(
	prevHash: string,
	body: {index: number; payload: unknown; ts: string},
): string {
	const h = createHash('sha256')
	h.update(prevHash)
	h.update(canonicalJson(body))
	return h.digest('hex')
}
