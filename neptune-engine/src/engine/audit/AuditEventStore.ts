/**
 * AuditEventStore — 不可篡改审计事件链
 *
 * 设计目标（Stage 4.1）：
 * - 在已有 RunStore.events.jsonl 之上叠加 hash chain，让审计场景可证明
 *   事件不可篡改（合规护城河）
 * - 每个 AuditEvent 含 prevHash + hash = sha256(prevHash + canonicalJson(payload))
 * - verify(runId) 重算整个 chain，篡改任意中间 event 必被检出
 *
 * 与 cc 行为差异：
 * - cc 没有 hash chain（仅靠 jsonl append-only 不可改）；这里在 substrate
 *   层提供合规级保证
 *
 * 设计原则：
 * - 接口不预设后端（Filesystem / S3 / DB / 区块链都可以）
 * - canonical JSON：sort keys 后序列化，保证跨实例哈希一致
 * - 0 外部依赖（仅 node:crypto）
 */

/**
 * 单条 AuditEvent — 链式哈希记录。
 *
 * 字段不可变（append-only 语义）；篡改 payload / hash 都会被 verify 检出。
 */
export interface AuditEvent {
	/** 0-based 序号。append 时由 store 自动填充。 */
	index: number
	/** 上一个 event 的 hash；index=0 时为 genesis hash（'0'.repeat(64)）。 */
	prevHash: string
	/** sha256(prevHash + canonicalJson({index, payload, ts}))。 */
	hash: string
	/** event payload（JSON-serializable）。 */
	payload: unknown
	/** ISO8601 写入时间戳。 */
	ts: string
}

export interface VerifyResult {
	valid: boolean
	/** valid=false 时，第一个不一致的 event index（-1 表示空 chain）。 */
	firstBadIndex?: number
	/** valid=false 时的失败原因摘要。 */
	reason?: string
}

/**
 * AuditEventStore 接口 — 不可篡改审计事件链
 */
export interface AuditEventStore {
	/**
	 * 追加一个 audit event。返回填充好的 AuditEvent（含 index/prevHash/hash/ts）。
	 * 实现必须保证：1) index 单调递增；2) prevHash 链完整；3) atomic write
	 */
	append(runId: string, payload: unknown): Promise<AuditEvent>

	/**
	 * 加载某个 run 的全部 audit events，按 index 顺序。
	 * 不存在返 []。
	 */
	load(runId: string): Promise<AuditEvent[]>

	/**
	 * 验证某个 run 的 audit chain 完整性。
	 *
	 * - 空 chain → valid=true
	 * - 任意 prevHash 链断裂 / hash 不匹配 → valid=false + firstBadIndex
	 */
	verify(runId: string): Promise<VerifyResult>

	/** 释放资源（fs flush 等）。 */
	dispose?(): Promise<void>
}

/** Genesis hash — index=0 的 prevHash。 */
export const GENESIS_HASH = '0'.repeat(64)
