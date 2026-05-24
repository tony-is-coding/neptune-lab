/**
 * loopEvents.ts — AgentLoop 对外 emit 的事件类型
 */

import type {AssistantMessage} from '../../types/message.js'
import type {UsageSnapshot, StopReason} from '../types.js'
import type {ToolUpdate} from '../dispatcher/ToolDispatcher.js'
import type {PolicyDecision, HumanReview, EvidenceArtifact} from '@shared/contracts'

/**
 * Stage 2.4: Governance event payload — emit when a governance hook fires.
 *
 * 4 个 phase 对应 4 类 hook：
 *   - pre_tool          → PolicyHook.beforeToolUse 决策返回
 *   - human_review      → HumanReviewHook.requestReview 完成
 *   - artifact_persisted → ArtifactHook.persistArtifact 完成
 *   - eval_complete     → EvalHook.onRunComplete 完成
 */
export type GovernanceEvent =
	| {phase: 'pre_tool'; toolUseId: string; toolName: string; decision: PolicyDecision}
	| {phase: 'human_review'; toolUseId: string; toolName: string; review: HumanReview}
	| {phase: 'artifact_persisted'; toolUseId: string; toolName: string; artifact: EvidenceArtifact}
	| {phase: 'eval_complete'; runId: string; result: unknown}

/**
 * AgentLoop 在运行过程中 yield 给上层的事件。
 *
 * 上层（HeadlessQueryEngine / 业务代码）可以选择消费哪些事件，
 * 通常会全部转发给 SDK consumer。
 */
export type LoopEvent =
	/** 准备发起一轮 LLM 请求（每个 turn 开头）。 */
	| {type: 'stream_request_start'; turn: number}
	/** assistant 的完整消息（每个 turn 一条）。 */
	| {type: 'assistant_message'; message: AssistantMessage}
	/** 工具执行的中间事件（started / progress / result）。 */
	| {type: 'tool_update'; update: ToolUpdate}
	/** Token usage 累计（每个 turn 末尾）。 */
	| {type: 'usage_update'; usage: UsageSnapshot; cumulative: UsageSnapshot}
	/** Stage 2.4: Governance hook 触发。 */
	| {type: 'governance_decision'; event: GovernanceEvent}
	/** 错误事件：上层决策（继续 / 退出）。 */
	| {type: 'error'; error: Error; phase: 'stream' | 'tool' | 'serialization' | 'governance'}

/**
 * Stage 2.4: Governance 触发计数（在 LoopResult 中暴露给上层观测）。
 */
export interface GovernanceSnapshot {
	policyDecisionsCount: number
	humanReviewsCount: number
	artifactsPersistedCount: number
	evalRunsCount: number
}

/**
 * AgentLoop 退出时的最终状态。
 */
export interface LoopResult {
	/** 终止原因。 */
	reason:
		| 'end_turn'
		| 'max_tokens'
		| 'stop_sequence'
		| 'pause_turn'
		| 'refusal'
		| 'aborted'
		| 'error'
		| 'max_turns'
		| 'budget_exceeded'
	/** 最终的 stop_reason（来自 API）。aborted/error/max_turns 时为 null。 */
	apiStopReason: StopReason | null
	/** 累计 usage。 */
	cumulativeUsage: UsageSnapshot
	/** Loop 退出后的完整 message 列表（含初始 + 中间 + 最终）。 */
	finalMessages: import('../../types/message.js').Message[]
	/** turn 数（end_turn 时是 1+，max_turns 时等于上限）。 */
	turnCount: number
	/** 错误信息（reason='error' 时）。 */
	error?: Error
	/** Stage 2.4: Governance 计数快照（仅当 governance hooks 注入时非零）。 */
	governanceSnapshot?: GovernanceSnapshot
}
