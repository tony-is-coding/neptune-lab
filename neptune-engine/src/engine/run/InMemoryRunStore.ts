/**
 * InMemoryRunStore — Map 后端，进程内单实例
 *
 * 主要用途：测试 / 单进程开发 / 临时 demo
 * 跨进程 / 持久化需求请用 FileRunStore 或 product 注入的具体实现
 */

import {randomUUID} from 'crypto'
import type {LoopEvent} from '../agent-loop/loop/loopEvents.js'
import type {Checkpoint, Run, RunSnapshot, RunStatus, RunStore} from './Run.js'
import {rebuildSnapshotFromEvents, rebuildCheckpointFromEvents} from './rebuildSnapshot.js'

export class InMemoryRunStore implements RunStore {
	private readonly runs = new Map<string, Run>()
	private readonly events = new Map<string, LoopEvent[]>()

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
		this.runs.set(id, run)
		this.events.set(id, [])
		return run
	}

	async load(id: string): Promise<Run | null> {
		return this.runs.get(id) ?? null
	}

	async updateStatus(id: string, status: RunStatus): Promise<void> {
		const run = this.runs.get(id)
		if (!run) throw new Error(`Run not found: ${id}`)
		run.status = status
		run.updatedAt = new Date().toISOString()
	}

	async appendEvent(id: string, event: LoopEvent): Promise<void> {
		const list = this.events.get(id)
		if (!list) throw new Error(`Run not found: ${id}`)
		list.push(event)
	}

	async loadEvents(
		id: string,
		opts: {fromIndex?: number} = {},
	): Promise<LoopEvent[]> {
		const list = this.events.get(id) ?? []
		const from = opts.fromIndex ?? 0
		return list.slice(from)
	}

	async loadSnapshot(id: string): Promise<RunSnapshot | null> {
		const run = this.runs.get(id)
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
		const run = this.runs.get(id)
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
		this.runs.delete(id)
		this.events.delete(id)
	}

	async dispose(): Promise<void> {
		this.runs.clear()
		this.events.clear()
	}
}
