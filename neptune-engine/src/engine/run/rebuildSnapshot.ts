/**
 * rebuildSnapshot.ts — 从 LoopEvent 序列重建 RunSnapshot
 *
 * 算法（与 AgentLoop 主循环语义对齐）：
 * 1. 遍历 events 顺序累积 messages：
 *    - assistant_message → push assistant message
 *    - tool_update kind=result → 按 toolUseId 收集，等所有 tool_use 完成后包成 user message
 *      （为避免误判：在下一个 stream_request_start 或 assistant_message 之前的 tool_results 集中包）
 * 2. usage_update 累计 cumulativeUsage（每个 turn 的最后值是权威值，所以用 max 而非 sum）
 *    更精准：每 turn 末尾 usage_update.cumulative 就是最权威的累计 → 取最后一个
 * 3. governance_decision 计入 governanceSnapshot 计数
 * 4. lastApiStopReason / lastTurnNumber 从最后的事件推断
 *
 * 注意：此函数纯函数，不读 store；caller 必须先 loadEvents 后传入。
 */

import {randomUUID} from 'crypto'
import type {LoopEvent, GovernanceSnapshot} from '../agent-loop/loop/loopEvents.js'
import type {Message, ContentItem} from '../types/message.js'
import type {UsageSnapshot, StopReason} from '../agent-loop/types.js'
import {EMPTY_USAGE} from '../agent-loop/types.js'
import type {ToolResultBlock} from '../agent-loop/dispatcher/ToolDispatcher.js'

export interface RebuildResult {
	messages: Message[]
	cumulativeUsage: UsageSnapshot
	governanceSnapshot: GovernanceSnapshot
	lastTurnNumber: number
	lastApiStopReason: StopReason | null
}

export function rebuildSnapshotFromEvents(events: LoopEvent[]): RebuildResult {
	return rebuildSnapshotInternal(events, undefined)
}

/**
 * Stage 4.3: 从 events 重建到指定 turnNumber 末尾的快照。
 *
 * 算法：扫到 turnNumber+1 的 stream_request_start 时停（即 turnNumber 已完成）。
 * 如果跑过的轮数 < turnNumber，返 null。
 */
export function rebuildCheckpointFromEvents(
	events: LoopEvent[],
	turnNumber: number,
): RebuildResult | null {
	if (turnNumber < 1) return null
	// 找到 turnNumber+1 的 stream_request_start，截到那之前
	let cutoff = events.length // 默认到尾
	let maxTurn = 0
	for (let i = 0; i < events.length; i++) {
		const e = events[i]!
		if (e.type === 'stream_request_start') {
			maxTurn = Math.max(maxTurn, e.turn)
			if (e.turn > turnNumber) {
				cutoff = i
				break
			}
		}
	}
	// 如果还没跑到 turnNumber → null
	if (maxTurn < turnNumber) return null
	return rebuildSnapshotInternal(events.slice(0, cutoff), turnNumber)
}

function rebuildSnapshotInternal(
	events: LoopEvent[],
	_turnLimit: number | undefined,
): RebuildResult {
	const messages: Message[] = []
	let cumulativeUsage: UsageSnapshot = {...EMPTY_USAGE}
	const govSnapshot: GovernanceSnapshot = {
		policyDecisionsCount: 0,
		humanReviewsCount: 0,
		artifactsPersistedCount: 0,
		evalRunsCount: 0,
	}
	let lastTurnNumber = 0
	let lastApiStopReason: StopReason | null = null

	// 收集当前 turn 的 tool_results（待打包成 user message）
	let pendingToolResults: ToolResultBlock[] = []

	const flushToolResults = (): void => {
		if (pendingToolResults.length === 0) return
		const userMessage: Message = {
			type: 'user',
			uuid: randomUUID() as unknown as Message['uuid'],
			message: {
				role: 'user',
				content: pendingToolResults as unknown as ContentItem[],
			},
		}
		messages.push(userMessage)
		pendingToolResults = []
	}

	for (const event of events) {
		switch (event.type) {
			case 'stream_request_start':
				// 新 turn 开始 → flush 前 turn 的 tool_results
				flushToolResults()
				lastTurnNumber = event.turn
				break

			case 'assistant_message':
				// assistant_message 也意味着前 turn 的 tool_results 必须先 flush
				flushToolResults()
				messages.push(event.message)
				// stop_reason 从 message.message.stop_reason 提取
				if (event.message.message?.stop_reason !== undefined) {
					lastApiStopReason = event.message.message.stop_reason as StopReason
				}
				break

			case 'tool_update':
				if (event.update.kind === 'result') {
					pendingToolResults.push(event.update.toolResultBlock)
				}
				break

			case 'usage_update':
				cumulativeUsage = {...event.cumulative}
				break

			case 'governance_decision':
				switch (event.event.phase) {
					case 'pre_tool':
						govSnapshot.policyDecisionsCount++
						break
					case 'human_review':
						govSnapshot.humanReviewsCount++
						break
					case 'artifact_persisted':
						govSnapshot.artifactsPersistedCount++
						break
					case 'eval_complete':
						govSnapshot.evalRunsCount++
						break
				}
				break

			case 'error':
				// error 事件不直接进 messages，但可能影响 stop_reason 判断
				break
		}
	}

	// 流末尾仍有 pending tool_results（resume 场景：上一个 engine 中断在 tool 收集后）
	flushToolResults()

	return {
		messages,
		cumulativeUsage,
		governanceSnapshot: govSnapshot,
		lastTurnNumber,
		lastApiStopReason,
	}
}
