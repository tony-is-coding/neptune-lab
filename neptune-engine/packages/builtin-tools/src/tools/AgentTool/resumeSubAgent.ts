/**
 * resumeSubAgent — 跨实例 sub-agent resume（P0.3b 协议化）
 *
 * 设计目的：
 * - cc resumeAgent.ts 266 行业务实现 sub-agent resume；
 *   substrate 用 RunStore.loadSnapshot + cleanupForResume + AgentLoop.resume 协议组合替代（~80 行）
 * - 跨实例复用：实例 A 跑完 turn 1 → 实例 B 拿同 runId 用 resume 续跑 turn 2
 *
 * 与 cc 行为对齐：
 * - 重建 messages 历史（substrate RunStore.loadSnapshot 已含 events → messages 重建）
 * - 重建 agent type（从 RunStore.run.metadata.agentType 取，复查 AgentRegistry）
 * - cleanup messages（filterUnresolvedToolUses + filterOrphanedThinking + filterWhitespace）
 * - 续跑（AgentLoop.resume 已有，e2e 测试覆盖）
 *
 * 与 cc 业务剥离：
 * - 不抄 worktree（cc 的 resumedWorktreePath / utimes 业务）
 * - 不抄 cc fork agent / forkParentSystemPrompt（业务）
 * - 不抄 langfuse / perfetto / sessionStorage cc 业务
 *
 * 协议替代证明（与 cc resumeAgent 同等）：
 * - 重建 messages ✓ (RunStore.loadSnapshot)
 * - 重建 agent type ✓ (run.metadata.agentType + AgentRegistry.get)
 * - filter 半截 tool_use / thinking ✓ (cleanupForResume from B1.2)
 * - resume 同步 / 后台 ✓ (AgentLoop.resume / runWithStore + 同样的 launchSubAgentInBackground)
 */

import {randomUUID} from 'crypto'
import type {
	AgentLoopParams,
	AgentRegistry,
	AgentManifest,
	LoopEvent,
	Message,
	RunStore,
	StreamingProviderAdapter,
	ToolUseContext as EngineToolUseContext,
	UsageSnapshot,
	Tool as EngineTool,
} from '@neptune/engine'
import {AgentLoop, EMPTY_USAGE, cleanupForResume} from '@neptune/engine'
import type {Tool} from '../../tool.js'

// ============================================================
// 类型
// ============================================================

export interface ResumeSubAgentInput {
	/** RunStore（必传）。 */
	runStore: RunStore
	/** 要 resume 的 runId。 */
	runId: string
	/** AgentRegistry（必传 — 用于按 metadata.agentType 重建 manifest）。 */
	agentRegistry: AgentRegistry
	/** 新 user prompt（追加到清理后的历史末尾）。 */
	prompt: string
	/** Model ID（resume 时可换 model）。 */
	model: string
	/** Streaming provider。 */
	provider: StreamingProviderAdapter
	/** Parent abort signal。 */
	parentSignal?: AbortSignal
	/** Sub-agent 工具池（caller 自己解析 manifest.tools 后传入）。 */
	tools: Tool[]
	/** Parent context（继承 kernel bag）。 */
	parentContext: EngineToolUseContext
	/** 起始时间戳（caller 提供）。 */
	startTime: number
	maxTurns?: number
}

export interface ResumeResult {
	reason: string
	finalMessages: Message[]
	cumulativeUsage: UsageSnapshot
	manifest: AgentManifest
	error?: Error
}

// ============================================================
// 主函数
// ============================================================

export async function resumeSubAgent(
	input: ResumeSubAgentInput,
): Promise<ResumeResult> {
	const {
		runStore,
		runId,
		agentRegistry,
		prompt,
		model,
		provider,
		parentSignal,
		tools,
		parentContext,
		startTime,
		maxTurns,
	} = input

	void startTime // 暂保留参数以保持接口向后兼容

	// 1. 加载 snapshot
	const snapshot = await runStore.loadSnapshot(runId)
	if (!snapshot) {
		throw new Error(`Run not found in RunStore: ${runId}`)
	}

	// 2. 取 manifest（从 run.metadata.agentType）
	const agentType = snapshot.run.metadata?.agentType as string | undefined
	if (!agentType) {
		throw new Error(
			`Run ${runId} has no agentType metadata; cannot resume as sub-agent. ` +
				'(metadata.agentType 应该在 launchSubAgentInBackground 时被写入)',
		)
	}
	const manifest = await agentRegistry.get(agentType)
	if (!manifest) {
		throw new Error(
			`Agent type '${agentType}' not found in AgentRegistry. Cannot resume run ${runId}.`,
		)
	}

	// 3. cleanup messages（cc 等价行为：filter 半截 tool_use / 孤儿 thinking / 空白 assistant）
	const cleanedMessages = cleanupForResume(snapshot.messages)

	// 4. 追加新 user prompt
	const userMessage: Message = {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'user', content: prompt},
	}
	const messages = [...cleanedMessages, userMessage]

	// 5. 独立 child controller
	const childController = new AbortController()
	const onParentAbort = (): void => {
		if (!childController.signal.aborted) childController.abort()
	}
	if (parentSignal) {
		if (parentSignal.aborted) {
			childController.abort()
		} else {
			parentSignal.addEventListener('abort', onParentAbort, {once: true})
		}
	}

	// 6. 构造 sub-agent context
	const subContext: EngineToolUseContext = {
		...parentContext,
		abortController: childController,
		agentId: snapshot.run.metadata?.agentId as string | undefined,
		options: {
			...parentContext.options,
			tools: tools as unknown as EngineTool[],
		},
	}

	// 7. AgentLoopParams（resume 走 runWithStore，events 继续 append 同 jsonl）
	const loopParams: AgentLoopParams = {
		messages,
		systemPrompt: manifest.systemPrompt,
		tools: tools as unknown as EngineTool[],
		model,
		signal: childController.signal,
		context: subContext,
		provider,
		runStore,
		runId,
		...(maxTurns !== undefined && {maxTurns}),
	}

	// 8. 跑（用 runWithStore 而不是 AgentLoop.resume，因为 resume 用 snapshot.messages 当作初始历史已合并 prompt）
	let resultMessages: Message[] = messages
	let cumulativeUsage: UsageSnapshot = {...EMPTY_USAGE}
	let reason = 'end_turn'
	let resumeError: Error | undefined

	try {
		const gen = AgentLoop.runWithStore(loopParams)
		while (true) {
			const next = await gen.next()
			if (next.done) {
				const r = next.value
				resultMessages = r.finalMessages
				cumulativeUsage = r.cumulativeUsage
				reason = r.reason
				if (r.error) resumeError = r.error
				break
			}
			void (next.value as LoopEvent)
		}
	} catch (err) {
		resumeError = err instanceof Error ? err : new Error(String(err))
		reason = 'error'
	} finally {
		if (parentSignal) {
			try {
				parentSignal.removeEventListener('abort', onParentAbort)
			} catch {
				// ignore
			}
		}
	}

	return {
		reason,
		finalMessages: resultMessages,
		cumulativeUsage,
		manifest,
		...(resumeError && {error: resumeError}),
	}
}
