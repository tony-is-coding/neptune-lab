/**
 * FileRunStore — 文件系统后端，filesystem-first 默认实现
 *
 * 存储格式（与 cc sessionStorage 对齐）：
 *   {rootDir}/{runId}/
 *     ├── run.json       ← Run metadata，atomicWrite (tmp + rename)
 *     └── events.jsonl   ← LoopEvent append-only log，行级 atomic（< 4KB）
 *
 * NFS 友好性：
 * - run.json 单文件 atomic rename，跨实例并发安全
 * - events.jsonl 走 O_APPEND，单行 < 4KB 时 POSIX/NFS atomic
 * - 不依赖 inotify、不需要独占 lock
 *
 * 崩溃容错：
 * - 末行截断（writes 中断）→ 重启后 readJsonlLines 自动 skip
 * - run.json tmp 文件残留 → 下次写新 tmp，不影响读取
 *
 * Resume 语义：
 * - 跨实例：engine A 创建 + appendEvent → engine B 同 store
 *   loadSnapshot 重建 messages → 续跑
 * - rebuildSnapshotFromEvents 是 deterministic：相同 events → 相同 snapshot
 */

import {randomUUID} from 'crypto'
import {join} from 'node:path'
import {readdir, rm, stat} from 'node:fs/promises'
import type {LoopEvent} from '../agent-loop/loop/loopEvents.js'
import type {Checkpoint, Run, RunSnapshot, RunStatus, RunStore} from './Run.js'
import {rebuildSnapshotFromEvents, rebuildCheckpointFromEvents} from './rebuildSnapshot.js'
import {atomicWrite} from '../utils/atomicWrite.js'
import {appendJsonl, readJsonlLines} from '../utils/jsonl.js'

const RUN_META_FILE = 'run.json'
const EVENTS_FILE = 'events.jsonl'

export class FileRunStore implements RunStore {
	constructor(private readonly rootDir: string) {}

	async create(init?: {
		id?: string
		status?: RunStatus
		metadata?: Record<string, unknown>
	}): Promise<Run> {
		const id = init?.id ?? randomUUID()
		const now = new Date().toISOString()
		const run: Run = {
			id,
			status: init?.status ?? 'pending',
			createdAt: now,
			updatedAt: now,
			metadata: init?.metadata,
		}
		await atomicWrite(this.runMetaPath(id), JSON.stringify(run, null, 2))
		// 先 mkdir + 创建空 events.jsonl 占位（让 loadEvents 第一次返 [] 不报错）
		// 实际不必预创建：readJsonlLines 处理 ENOENT 返 []
		return run
	}

	async load(id: string): Promise<Run | null> {
		try {
			const {readFile} = await import('node:fs/promises')
			const raw = await readFile(this.runMetaPath(id), 'utf8')
			return JSON.parse(raw) as Run
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
			throw err
		}
	}

	async updateStatus(id: string, status: RunStatus): Promise<void> {
		const run = await this.load(id)
		if (!run) throw new Error(`Run not found: ${id}`)
		run.status = status
		run.updatedAt = new Date().toISOString()
		await atomicWrite(this.runMetaPath(id), JSON.stringify(run, null, 2))
	}

	async appendEvent(id: string, event: LoopEvent): Promise<void> {
		// 验证 run 存在（避免无效 runId 写脏数据）
		const exists = await this.runExists(id)
		if (!exists) throw new Error(`Run not found: ${id}`)
		await appendJsonl(this.eventsPath(id), serializeEvent(event))
	}

	async loadEvents(
		id: string,
		opts: {fromIndex?: number} = {},
	): Promise<LoopEvent[]> {
		const all = await readJsonlLines<unknown>(this.eventsPath(id))
		const from = opts.fromIndex ?? 0
		return all.slice(from).map(deserializeEvent)
	}

	async loadSnapshot(id: string): Promise<RunSnapshot | null> {
		const run = await this.load(id)
		if (!run) return null
		const events = await this.loadEvents(id)
		const rebuilt = rebuildSnapshotFromEvents(events)
		return {
			run,
			messages: rebuilt.messages,
			cumulativeUsage: rebuilt.cumulativeUsage,
			governanceSnapshot: rebuilt.governanceSnapshot,
			lastTurnNumber: rebuilt.lastTurnNumber,
			lastApiStopReason: rebuilt.lastApiStopReason,
		}
	}

	async loadCheckpoint(id: string, turnNumber: number): Promise<Checkpoint | null> {
		const run = await this.load(id)
		if (!run) return null
		const events = await this.loadEvents(id)
		const rebuilt = rebuildCheckpointFromEvents(events, turnNumber)
		if (!rebuilt) return null
		return {
			runId: id,
			turnNumber,
			messages: rebuilt.messages,
			cumulativeUsage: rebuilt.cumulativeUsage,
			governanceSnapshot: rebuilt.governanceSnapshot,
			apiStopReason: rebuilt.lastApiStopReason,
			capturedAt: new Date().toISOString(),
		}
	}

	async delete(id: string): Promise<void> {
		try {
			await rm(this.runDir(id), {recursive: true, force: true})
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
			throw err
		}
	}

	async dispose(): Promise<void> {
		// no-op
	}

	/** 列出全部 Run（list 不在 RunStore 接口里，但便于调试）。 */
	async list(): Promise<Run[]> {
		let entries: string[]
		try {
			entries = await readdir(this.rootDir)
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
			throw err
		}
		const runs: Run[] = []
		for (const name of entries) {
			const r = await this.load(name)
			if (r) runs.push(r)
		}
		return runs
	}

	private runDir(id: string): string {
		return join(this.rootDir, id)
	}

	private runMetaPath(id: string): string {
		return join(this.runDir(id), RUN_META_FILE)
	}

	private eventsPath(id: string): string {
		return join(this.runDir(id), EVENTS_FILE)
	}

	private async runExists(id: string): Promise<boolean> {
		try {
			await stat(this.runMetaPath(id))
			return true
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
			throw err
		}
	}
}

// ============================================================
// LoopEvent 序列化 / 反序列化
// ============================================================
//
// LoopEvent 大多数字段 JSON-safe，但 Error 对象需特殊处理：
// - 序列化时把 error: Error 转成 {__errorType, message, stack, name}
// - 反序列化时还原 Error 对象（保留 message + stack + name）

interface SerializedError {
	__errorType: 'Error'
	message: string
	stack?: string
	name: string
}

function serializeEvent(event: LoopEvent): unknown {
	if (event.type === 'error') {
		return {
			...event,
			error: serializeError(event.error),
		}
	}
	return event
}

function deserializeEvent(raw: unknown): LoopEvent {
	if (
		raw &&
		typeof raw === 'object' &&
		(raw as {type?: string}).type === 'error'
	) {
		const obj = raw as {error: SerializedError | Error; type: 'error'} & Record<
			string,
			unknown
		>
		const err = obj.error
		if (err && typeof err === 'object' && '__errorType' in err) {
			return {
				...obj,
				error: deserializeError(err as SerializedError),
			} as LoopEvent
		}
	}
	return raw as LoopEvent
}

function serializeError(err: Error): SerializedError {
	return {
		__errorType: 'Error',
		message: err.message,
		stack: err.stack,
		name: err.name,
	}
}

function deserializeError(s: SerializedError): Error {
	const err = new Error(s.message)
	if (s.stack !== undefined) err.stack = s.stack
	err.name = s.name
	return err
}
