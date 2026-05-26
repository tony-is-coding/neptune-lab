/**
 * runSubAgent — substrate 内 sub-agent 运行核心
 *
 * 设计目的（Stage B2.2 / B2.3 / B2.5）：
 * - 把 manifest + prompt 转成 AgentLoop.run 调用，处理结果聚合
 * - 三段错误处理：tool throw / API error / AbortError + partial result extraction
 * - cancellation 链路：parent abort → child AbortController abort（独立但联动）
 *
 * 与 cc 行为对齐（cc runAgent.ts ~1003 行的核心 ~250 行）：
 * - 一次完整对话：spawn sub-agent → AgentLoop run → result aggregate
 * - last assistant text + 回溯 fallback（assistant message 没 text 时找前面的）
 * - countToolUses + token usage trailer
 * - 三类错误统一捕获 → returns { error, partialContent }
 *
 * 与 cc 业务剥离：
 * - 不抄 LocalAgentTask 业务（async background 走 B4 协议化路径）
 * - 不抄 forkSubagent / worktree（红线 #4 业务）
 * - 不抄 agent context / claude.md / git status 注入（红线业务）
 * - 不抄 langfuse / perfetto telemetry（业务）
 */

import {randomUUID} from 'crypto'
import type {
	AgentManifest,
	AgentLoopParams,
	LoopEvent,
	Message,
	ContentItem,
	StreamingProviderAdapter,
	ToolUseContext as EngineToolUseContext,
	UsageSnapshot,
	Tool as EngineTool,
} from '@neptune/engine'
import {AgentLoop, EMPTY_USAGE} from '@neptune/engine'
import type {Tool} from '../../tool.js'

// ============================================================
// 类型
// ============================================================

export interface RunSubAgentInput {
	/** Agent manifest（来自 ctx.kernel.agentRegistry.get(type)）。 */
	readonly manifest: AgentManifest
	/** sub-agent 第一轮看到的 user prompt。 */
	readonly prompt: string
	/** 模型 ID（已经按 3 段优先级解析好）。 */
	readonly model: string
	/** Streaming provider（与 parent 共享 / 独立都可）。 */
	readonly provider: StreamingProviderAdapter
	/** Parent abort signal（abort 时 sub-agent 也 abort）。 */
	readonly parentSignal?: AbortSignal
	/** 给 sub-agent 用的工具池（已按 manifest.tools 白名单过滤）。 */
	readonly tools: Tool[]
	/** Parent ToolUseContext（注入 kernel bag 给 sub-agent）。 */
	readonly parentContext: EngineToolUseContext
	/** sub-agent agentId（caller 生成；用于 result + log）。 */
	readonly agentId: string
	/** 起始时间戳（caller 提供，用于 result.totalDurationMs）。 */
	readonly startTime: number
	/** AgentLoop maxTurns（默认 50）。 */
	readonly maxTurns?: number
	/** EventBus / observer：sub-agent 跑起来后转发 LoopEvent 给 caller。 */
	readonly onEvent?: (event: LoopEvent) => void
}

export interface SubAgentRunResult {
	/** sub-agent 的最终 content（last assistant text 或回溯 fallback）。 */
	readonly content: Array<{type: 'text'; text: string}>
	/** 累计 token usage。 */
	readonly usage: UsageSnapshot
	/** sub-agent 跑了多少 tool_use（含失败的）。 */
	readonly totalToolUseCount: number
	/** 单调时长（ms）。 */
	readonly totalDurationMs: number
	/** 完整 messages（含 user/assistant/tool_result）— 用于 product 持久化或调试。 */
	readonly messages: Message[]
	/** end_turn / max_turns / aborted / error / max_tokens / pause_turn。 */
	readonly reason: string
	/** 是否 partial（abort / error 时可能是 partial）。 */
	readonly isPartial: boolean
	/** 错误（reason='error' 时）。 */
	readonly error?: Error
}

// ============================================================
// 主函数
// ============================================================

/**
 * 运行一个 sub-agent。
 *
 * 流程：
 * 1. 构造 sub-agent system prompt（manifest.systemPrompt 直接用，不抄 cc 的 enhanceSystemPromptWithEnvDetails）
 * 2. 构造初始 messages: [user(prompt)]
 * 3. 创建独立 AbortController（parent abort 时联动）
 * 4. 跑 AgentLoop.run，转发 events 给 onEvent
 * 5. 退出时 aggregate result（last assistant text + countToolUses + usage）
 * 6. 三类错误处理：API error / Abort / 异常 throw
 */
export async function runSubAgent(
	input: RunSubAgentInput,
): Promise<SubAgentRunResult> {
	const {
		manifest,
		prompt,
		model,
		provider,
		parentSignal,
		tools,
		parentContext,
		agentId,
		startTime,
		maxTurns,
		onEvent,
	} = input

	// 独立 child controller：abort 时不影响 parent，但 parent abort → child abort
	const childController = new AbortController()
	const abortChild = (): void => {
		if (!childController.signal.aborted) childController.abort()
	}
	if (parentSignal) {
		if (parentSignal.aborted) {
			childController.abort()
		} else {
			parentSignal.addEventListener('abort', abortChild, {once: true})
		}
	}

	// 构造 sub-agent ToolUseContext（继承 parent 的 kernel bag + 独立 abortController + agentId）
	const subContext: EngineToolUseContext = {
		...parentContext,
		abortController: childController,
		agentId,
		options: {
			...parentContext.options,
			tools: tools as unknown as EngineTool[],
		},
	}

	// 构造初始 messages
	const userMessage: Message = {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'user', content: prompt},
	}
	const initialMessages: Message[] = [userMessage]

	// 准备 AgentLoop 参数
	const loopParams: AgentLoopParams = {
		messages: initialMessages,
		systemPrompt: manifest.systemPrompt,
		tools: tools as unknown as EngineTool[],
		model,
		signal: childController.signal,
		context: subContext,
		provider,
		maxTurns,
	}

	// 跑 AgentLoop，捕获 events + result
	let resultMessages: Message[] = initialMessages
	let cumulativeUsage: UsageSnapshot = {...EMPTY_USAGE}
	let reason = 'end_turn'
	let toolUseCount = 0
	let loopError: Error | undefined

	try {
		const gen = AgentLoop.run(loopParams)
		while (true) {
			const next = await gen.next()
			if (next.done) {
				const r = next.value
				resultMessages = r.finalMessages
				cumulativeUsage = r.cumulativeUsage
				reason = r.reason
				if (r.error) loopError = r.error
				break
			}
			const event = next.value as LoopEvent
			// 计 tool_use
			if (event.type === 'tool_update' && event.update.kind === 'started') {
				toolUseCount++
			}
			if (onEvent) {
				try {
					onEvent(event)
				} catch {
					// observer 错误不影响主循环
				}
			}
		}
	} catch (err) {
		// 任何 throw 都视为 error reason
		loopError = err instanceof Error ? err : new Error(String(err))
		reason = 'error'
	} finally {
		// 解绑 parent signal listener，防 memory leak
		if (parentSignal) {
			try {
				parentSignal.removeEventListener('abort', abortChild)
			} catch {
				// ignore
			}
		}
	}

	// Aggregate result
	const content = aggregateAssistantText(resultMessages)
	const isPartial =
		reason === 'aborted' ||
		reason === 'error' ||
		reason === 'max_turns' ||
		reason === 'budget_exceeded' ||
		reason === 'max_tokens'

	return {
		content: content.length > 0 ? content : [{type: 'text' as const, text: ''}],
		usage: cumulativeUsage,
		totalToolUseCount: toolUseCount,
		totalDurationMs: Date.now() - startTime,
		messages: resultMessages,
		reason,
		isPartial,
		...(loopError && {error: loopError}),
	}
}

// ============================================================
// 辅助：从 messages 提取 last assistant text（含回溯 fallback）
// ============================================================

/**
 * cc agentToolUtils.ts:266-300 等价：
 * - 优先返 last assistant message 的 text blocks
 * - 如果 last 是纯 tool_use，回溯找前面有 text 的 assistant
 * - 都没有返空数组（caller fallback 到 "(Subagent completed but returned no output.)"）
 */
function aggregateAssistantText(
	messages: readonly Message[],
): Array<{type: 'text'; text: string}> {
	let lastAssistantIdx = -1
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i]?.type === 'assistant') {
			lastAssistantIdx = i
			break
		}
	}
	if (lastAssistantIdx < 0) return []

	const lastAssistant = messages[lastAssistantIdx]!
	const lastBlocks = (lastAssistant.message?.content as ContentItem[]) ?? []
	const lastText = lastBlocks.filter(
		(b): b is {type: 'text'; text: string} =>
			(b as {type?: string}).type === 'text',
	)
	if (lastText.length > 0) {
		return lastText.map(b => ({type: 'text' as const, text: b.text}))
	}

	// 回溯 fallback
	for (let i = lastAssistantIdx - 1; i >= 0; i--) {
		const m = messages[i]
		if (m?.type !== 'assistant') continue
		const blocks = (m.message?.content as ContentItem[]) ?? []
		const text = blocks.filter(
			(b): b is {type: 'text'; text: string} =>
				(b as {type?: string}).type === 'text',
		)
		if (text.length > 0) {
			return text.map(b => ({type: 'text' as const, text: b.text}))
		}
	}
	return []
}

/**
 * 提取 partial result 字符串（abort / error 时给 caller 看的最佳尝试）。
 *
 * 与 cc agentToolUtils.ts:577-595 等价：从 messages 后向前找有 text 的 assistant。
 */
export function extractPartialResult(
	messages: readonly Message[],
): string | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i]
		if (m?.type !== 'assistant') continue
		const blocks = (m.message?.content as ContentItem[]) ?? []
		const texts = blocks
			.filter(
				(b): b is {type: 'text'; text: string} =>
					(b as {type?: string}).type === 'text',
			)
			.map(b => b.text)
		if (texts.length > 0) return texts.join('\n')
	}
	return undefined
}

/**
 * count tool_use blocks across all assistant messages.
 *
 * 与 cc agentToolUtils.ts:248-263 等价。
 */
export function countToolUses(messages: readonly Message[]): number {
	let count = 0
	for (const m of messages) {
		if (m.type !== 'assistant') continue
		const blocks = (m.message?.content as ContentItem[]) ?? []
		for (const b of blocks) {
			if ((b as {type?: string}).type === 'tool_use') count++
		}
	}
	return count
}
