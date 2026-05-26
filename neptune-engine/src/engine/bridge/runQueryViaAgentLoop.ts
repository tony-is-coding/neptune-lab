/**
 * runQueryViaAgentLoop — AgentEngine.query 走 AgentLoop 的实现 helper
 *
 * 设计目的（v5.0 P0.1b）：
 * - AgentEngine.query 双轨保留：useAgentLoop=true 走此函数，false 走 HeadlessQueryEngine
 * - 把 AgentEngineConfig + sessionId + input 转成 AgentLoop.run* 调用
 * - LoopEvent → SDK QueryEvent 走 AgentLoopBridge
 * - 让 16 batch agent-loop 能力（retry/fallback/cache/compaction/budget/governance/runStore/audit）
 *   全部上生产路径
 *
 * 集成策略：
 * - sessionId 复用作 runStore.runId（一个 session 对应一个长 run）
 * - 历史消息从 sessionMessages cache 取（与 HeadlessQueryEngine 路径一致）
 * - kernel bag 完整注入（agentRegistry / skillRegistry / taskQueue / etc.）
 * - signal 传递：caller signal + AgentEngine 内部 abortController 合并
 *
 * 与 HeadlessQueryEngine 路径的差异：
 * - 完整 multi-turn 支持（不再单轮 stub）
 * - 完整 tool 调度（工具列表来自 config.extensions.tools 等）
 * - 自动启用 retry/fallback/watchdog（有 RetryingProvider/FallbackProvider 包装时）
 * - 自动 RunStore/Audit 持久化（注入了对应 store 时）
 */

import {randomUUID} from 'crypto'
import type {AgentLoopParams} from '../agent-loop/loop/AgentLoop.js'
import {AgentLoop} from '../agent-loop/loop/AgentLoop.js'
import type {Message} from '../types/message.js'
import type {Tool} from '../types/tool.js'
import type {QueryEvent} from '../types/query-events.js'
import type {ToolUseContext} from '../agent-loop/dispatcher/ToolUseContext.js'
import {createToolUseContext} from '../agent-loop/dispatcher/ToolUseContext.js'
import {bridgeAgentLoopToSDK} from './AgentLoopBridge.js'

// ============================================================
// 输入 / 配置
// ============================================================

/**
 * runQueryViaAgentLoop 接收的最小配置（从 AgentEngineConfig 抽取）。
 *
 * 不直接耦合 AgentEngineConfig，方便单测与重用。
 */
export interface RunQueryViaAgentLoopParams {
	/** 用户输入文本（被包成第一条 user message）。 */
	input: string
	/** 模型 ID。 */
	model: string
	/** Streaming provider（必传）。 */
	provider: import('../agent-loop/provider/StreamingProviderAdapter.js').StreamingProviderAdapter
	/** System prompt。 */
	systemPrompt?: string
	/** 历史消息（resume / 多轮场景）。 */
	historyMessages?: Message[]
	/** 工具列表。 */
	tools?: Tool[]
	/** signal 用于取消。 */
	signal?: AbortSignal
	/** 工作目录 / 业务 metadata。 */
	cwd?: string

	// substrate 协议注入
	runStore?: import('../run/index.js').RunStore
	runId?: string
	auditStore?: import('../audit/index.js').AuditEventStore
	sandbox?: import('../sandbox/index.js').SandboxAdapter
	governance?: import('../governance/index.js').GovernanceHooks
	cachePolicy?: import('../agent-loop/index.js').CacheControlPolicy
	compactionPolicy?: import('../agent-loop/index.js').CompactionPolicy
	budgetTracker?: import('../agent-loop/index.js').BudgetTracker
	tracingProvider?: import('../observability/index.js').ITracingProvider
	metricsProvider?: import('../observability/index.js').IMetricsProvider

	// kernel bag
	agentRegistry?: import('../agent-registry/index.js').AgentRegistry
	skillRegistry?: import('../skill/index.js').SkillRegistry
	taskQueue?: import('../task-queue/index.js').TaskQueue
	todoState?: import('../todo/index.js').TodoState
	memoryStore?: import('../memory/index.js').MemoryStore
	agentScopedMemoryStore?: import('../memory/index.js').AgentScopedMemoryStore
	teammateChannel?: import('../teammate/index.js').TeammateChannel
	teammateBackend?: import('../teammate/index.js').TeammateBackend
	toolRegistry?: import('../tool-registry/index.js').ToolRegistry

	// 其他
	maxTurns?: number
	maxTokensPerTurn?: number
}

// ============================================================
// 主函数
// ============================================================

/**
 * 跑一次 query，走 AgentLoop + AgentLoopBridge。
 *
 * 返回 SDK QueryEvent 流。
 */
export async function* runQueryViaAgentLoop(
	params: RunQueryViaAgentLoopParams,
): AsyncGenerator<QueryEvent, void, unknown> {
	// 1. 构造初始 messages：history + 新 user message
	const userMessage: Message = {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'user', content: params.input},
	}
	const messages: Message[] = [...(params.historyMessages ?? []), userMessage]

	// 2. 构造 ToolUseContext（注入 kernel bag + provider + agentId）
	const ctx: ToolUseContext = createToolUseContext({
		tools: params.tools ?? [],
		isNonInteractiveSession: false,
		abortController: new AbortController(),
		canUseTool: () => ({behavior: 'allow' as const}),
		sandbox: params.sandbox,
		kernel: {
			agentRegistry: params.agentRegistry,
			skillRegistry: params.skillRegistry,
			taskQueue: params.taskQueue,
			todoState: params.todoState,
			memoryStore: params.memoryStore,
			toolRegistry: params.toolRegistry,
		},
	})
	// 注入 substrate 业务字段（AgentTool 用 ctx.provider / ctx.kernel.teammateChannel 等）
	;(ctx as Record<string, unknown>).provider = params.provider
	if (params.agentScopedMemoryStore) {
		;(ctx.kernel as Record<string, unknown>).agentScopedMemoryStore =
			params.agentScopedMemoryStore
	}
	if (params.teammateChannel) {
		;(ctx.kernel as Record<string, unknown>).teammateChannel = params.teammateChannel
	}
	if (params.teammateBackend) {
		;(ctx.kernel as Record<string, unknown>).teammateBackend = params.teammateBackend
	}

	// 3. 联动 caller signal 到 ctx.abortController（确保 caller 取消时 AgentLoop 能感知）
	if (params.signal) {
		if (params.signal.aborted) {
			ctx.abortController.abort()
		} else {
			params.signal.addEventListener(
				'abort',
				() => {
					if (!ctx.abortController.signal.aborted) {
						ctx.abortController.abort()
					}
				},
				{once: true},
			)
		}
	}

	// 4. 构造 AgentLoopParams
	const loopParams: AgentLoopParams = {
		messages,
		model: params.model,
		provider: params.provider,
		context: ctx,
		signal: ctx.abortController.signal,
		...(params.systemPrompt !== undefined && {systemPrompt: params.systemPrompt}),
		...(params.tools && {tools: params.tools}),
		...(params.maxTurns !== undefined && {maxTurns: params.maxTurns}),
		...(params.maxTokensPerTurn !== undefined && {maxTokens: params.maxTokensPerTurn}),
		...(params.governance && {governance: params.governance}),
		...(params.runStore && {runStore: params.runStore}),
		...(params.runId !== undefined && {runId: params.runId}),
		...(params.auditStore && {auditStore: params.auditStore}),
		...(params.cachePolicy && {cachePolicy: params.cachePolicy}),
		...(params.compactionPolicy && {compactionPolicy: params.compactionPolicy}),
		...(params.budgetTracker && {budgetTracker: params.budgetTracker}),
		...(params.tracingProvider && {tracingProvider: params.tracingProvider}),
		...(params.metricsProvider && {metricsProvider: params.metricsProvider}),
	}

	// 5. 跑 AgentLoop（注入 runStore 时走 runWithStore，否则走 run）
	const loopGen = params.runStore
		? AgentLoop.runWithStore(loopParams)
		: AgentLoop.run(loopParams)

	// 6. LoopEvent → SDK QueryEvent
	yield* bridgeAgentLoopToSDK(loopGen)
}
