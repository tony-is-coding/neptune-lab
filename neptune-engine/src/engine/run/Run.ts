/**
 * Run.ts — Run 类型 + RunStore 接口
 *
 * Run 是 engine 的"一次完整对话"概念，runtime 状态外化的载体：
 * - id：UUID
 * - status：lifecycle（pending → running → paused/completed/failed/aborted）
 * - createdAt / updatedAt：ISO 时间
 * - metadata：业务自由字典（不进 engine 决策）
 *
 * Run 上挂的事件（LoopEvent）由 RunStore.appendEvent 持久化；
 * resume 时从 events 重建 messages 续跑。
 *
 * 设计原则（与 cc sessionStorage 对齐）：
 * - Run 元数据用单独 JSON 文件 + atomic rename（小文件）
 * - LoopEvent 走 jsonl append-only（行级 atomic + NFS 友好）
 * - RunSnapshot 是从 events 重建的中间产物，不持久化（保持 single source of truth）
 */

import type {LoopEvent} from '../agent-loop/loop/loopEvents.js'
import type {Message} from '../types/message.js'
import type {UsageSnapshot, StopReason} from '../agent-loop/types.js'
import type {GovernanceSnapshot} from '../agent-loop/loop/loopEvents.js'

/** Run lifecycle 状态机。 */
export type RunStatus =
	| 'pending' // 已创建，未开始
	| 'running' // 主循环执行中
	| 'paused' // 被 abort / pause_turn 等中断，可 resume
	| 'completed' // end_turn 等正常退出
	| 'failed' // error 退出
	| 'aborted' // signal abort 退出

export interface Run {
	id: string // uuid
	status: RunStatus
	createdAt: string // ISO8601
	updatedAt: string
	metadata?: Record<string, unknown>
}

/**
 * RunSnapshot — 从 events 重建出的中间状态，用于 resume。
 *
 * 不持久化（caller 调 RunStore.loadSnapshot 现算）。
 */
export interface RunSnapshot {
	run: Run
	/** 重建的对话历史（assistant_message + tool_result 配对组装）。 */
	messages: Message[]
	cumulativeUsage: UsageSnapshot
	governanceSnapshot?: GovernanceSnapshot
	lastTurnNumber: number
	lastApiStopReason: StopReason | null
}

/**
 * Stage 4.3: Checkpoint —— 任意 turn 末尾的快照
 *
 * 与 RunSnapshot 区别：
 * - RunSnapshot 是 "loadSnapshot 时的最新状态"
 * - Checkpoint 是 "指定 turnNumber 末尾的状态"（含历史定格）
 *
 * 用途：让 resume 可以从特定 turn 续跑（而非永远从最新）。
 */
export interface Checkpoint {
	runId: string
	turnNumber: number
	messages: Message[]
	cumulativeUsage: UsageSnapshot
	governanceSnapshot?: GovernanceSnapshot
	apiStopReason: StopReason | null
	capturedAt: string
}

/**
 * RunStore — Run 状态外化的协议接口。
 *
 * 所有方法异步。具体后端：InMemory（默认）/ Filesystem（默认）/ PG / S3 / ...
 */
export interface RunStore {
	/** 创建一个新 Run。返回 Run（含生成的 id）。 */
	create(init?: {
		id?: string
		status?: RunStatus
		metadata?: Record<string, unknown>
	}): Promise<Run>

	/** 加载 Run metadata；不存在返 null。 */
	load(id: string): Promise<Run | null>

	/** 更新 status。会同时刷 updatedAt。 */
	updateStatus(id: string, status: RunStatus): Promise<void>

	/** 追加一个 LoopEvent。Run 必须已存在。 */
	appendEvent(id: string, event: LoopEvent): Promise<void>

	/**
	 * 加载所有 events（按 append 顺序）。
	 *
	 * @param opts.fromIndex 从哪个 index 开始（默认 0）
	 */
	loadEvents(id: string, opts?: {fromIndex?: number}): Promise<LoopEvent[]>

	/**
	 * 从 events 重建 RunSnapshot。
	 *
	 * 如果 Run 不存在返 null。
	 */
	loadSnapshot(id: string): Promise<RunSnapshot | null>

	/**
	 * Stage 4.3: 加载某个 turn 末尾的 Checkpoint。
	 *
	 * - turnNumber=1 表示第 1 轮 assistant_message + 后续 tool_results 都
	 *   完成的状态
	 * - 不存在该 turn 返 null（如 turnNumber > 实际跑过的轮数）
	 * - 可选实现（不是所有 store 都支持）
	 */
	loadCheckpoint?(id: string, turnNumber: number): Promise<Checkpoint | null>

	/** 删除 Run（含所有 events）。不存在不报错。 */
	delete(id: string): Promise<void>

	/** 释放底层资源。 */
	dispose?(): Promise<void>
}
