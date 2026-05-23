/**
 * AgentLoop — Multi-turn agent loop 的 substrate 实现
 *
 * 算法纲要（参考 cc query.ts:276-1778 queryLoop 主体，剥离 product 关注点后）：
 *
 *   while (turn < maxTurns):
 *     1. emit stream_request_start
 *     2. resolveTools = MessageSerializer.resolveToolParams(tools)
 *     3. provider.queryStream({messages, systemPrompt, resolvedTools, signal, ...})
 *     4. 消费 ParsedSSEEvent 序列：
 *        - message_start          → 累积 partialMessage
 *        - content_block_complete → 累积到 contentBlocks 数组
 *        - message_delta          → 更新 stop_reason + usage
 *        - error                  → emit LoopEvent.error，退出
 *     5. 用 partialMessage + contentBlocks 构造 AssistantMessage，emit
 *     6. 把 AssistantMessage push 到 messages
 *     7. 累计 usage
 *     8. 根据 stop_reason 决策：
 *        - 'end_turn' / null → break，reason: 'end_turn'
 *        - 'tool_use'        → 抽 tool_use blocks → ToolDispatcher.execute → 收集 tool_result
 *                              → 把 tool_result 包成 user message push 进 messages
 *                              → continue
 *        - 'max_tokens'      → break，reason: 'max_tokens'（M2 处理 recovery）
 *        - 'stop_sequence'   → break
 *        - 'pause_turn'      → break，reason: 'pause_turn'（M3 处理 resume）
 *        - 'refusal'         → break
 *     9. 检查 abort signal：true → break，reason: 'aborted'
 *
 * 设计原则：
 * - 一次 run 一个完整请求-响应链；不内置 retry / fallback / watchdog（外层 batch 12-13 注入）
 * - 不抄 cc 的 snip / microcompact / autocompact / token budget / queryTracking 等业务逻辑
 * - 取消信号一路传到 provider 和 dispatcher
 * - tool 错误（包成 tool_result is_error）继续循环；API 错误（stream error）退出
 */

import {randomUUID} from 'crypto'
import type {AssistantMessage, Message, ContentItem} from '../../types/message.js'
import type {Tool} from '../../types/tool.js'
import type {
	BetaTextBlockParam,
	BetaContentBlockParam,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type {ParsedSSEEvent, UsageSnapshot, StopReason, CompleteContentBlock, PartialAssistantMessage} from '../types.js'
import {EMPTY_USAGE} from '../types.js'
import {MessageSerializer} from '../message/MessageSerializer.js'
import type {StreamingProviderAdapter} from '../provider/StreamingProviderAdapter.js'
import {ToolDispatcher, type ToolUseBlock, type ToolResultBlock} from '../dispatcher/ToolDispatcher.js'
import type {ToolUseContext} from '../dispatcher/ToolUseContext.js'
import type {LoopEvent, LoopResult} from './loopEvents.js'
import type {HookSurface} from '../hook/HookSurface.js'
import type {UsageTracker} from '../usage/UsageTracker.js'

const DEFAULT_MAX_TURNS = 50

// ============================================================
// 公开类型
// ============================================================

export interface AgentLoopParams {
	/** 初始 messages（包含 user message + 历史）。 */
	messages: Message[]
	systemPrompt?: string | BetaTextBlockParam[]
	/** 工具列表（每轮都序列化发给 API）。 */
	tools?: Tool[]
	/** 模型 ID。 */
	model: string
	/** 取消信号；abort 时在最近的安全点退出循环。 */
	signal?: AbortSignal
	/** ToolUseContext（注入 kernel protocols / canUseTool / agentId 等）。 */
	context: ToolUseContext
	/** Streaming Provider（Anthropic / 其他）。 */
	provider: StreamingProviderAdapter
	/** 单轮最大 token（透给 API max_tokens）。默认 4096。 */
	maxTokens?: number
	/** Loop 最大 turn 数（防跑飞，substrate 默认 50；product 可覆盖）。 */
	maxTurns?: number
	/** 透传给 provider.extra（caching breakpoints / beta flags）。 */
	extra?: Record<string, unknown>
	/** 业务 hook 注入（默认无）。 */
	hooks?: HookSurface
	/** Usage tracker（默认无；上层可注入跨 turn 累计）。 */
	usageTracker?: UsageTracker
	/** Prompt caching policy（默认无 caching；注入 DefaultCachePolicy 即可启用）。 */
	cachePolicy?: import('../caching/CacheControlPolicy.js').CacheControlPolicy
}

// ============================================================
// 累加 usage
// ============================================================

function addUsage(a: UsageSnapshot, b: UsageSnapshot): UsageSnapshot {
	return {
		input_tokens: a.input_tokens + b.input_tokens,
		output_tokens: a.output_tokens + b.output_tokens,
		cache_creation_input_tokens:
			a.cache_creation_input_tokens + b.cache_creation_input_tokens,
		cache_read_input_tokens:
			a.cache_read_input_tokens + b.cache_read_input_tokens,
	}
}

// ============================================================
// 把 ParsedSSEEvent 序列收集成 AssistantMessage
// ============================================================

interface CollectedAssistant {
	partialMessage: PartialAssistantMessage | null
	blocks: Array<CompleteContentBlock | undefined>
	stopReason: StopReason
	finalUsage: UsageSnapshot
}

/**
 * 消费 provider stream，累积出一条 AssistantMessage。
 *
 * 如遇到 ParsedSSEEvent.error，直接把错误抛出，让上层 emit error 事件。
 */
async function collectAssistantMessage(
	stream: AsyncGenerator<ParsedSSEEvent>,
): Promise<CollectedAssistant> {
	const result: CollectedAssistant = {
		partialMessage: null,
		blocks: [],
		stopReason: null,
		finalUsage: {...EMPTY_USAGE},
	}
	for await (const event of stream) {
		switch (event.type) {
			case 'message_start':
				result.partialMessage = event.message
				result.finalUsage = addUsage(result.finalUsage, event.message.usage)
				break
			case 'content_block_complete':
				result.blocks[event.index] = event.block
				break
			case 'message_delta':
				result.stopReason = event.stop_reason
				result.finalUsage = addUsage(result.finalUsage, event.usage)
				break
			case 'message_stop':
				// 自然结束
				break
			case 'error':
				throw event.error
		}
	}
	return result
}

/**
 * 把累积的 partialMessage + blocks 拼成 AssistantMessage。
 */
function buildAssistantMessage(collected: CollectedAssistant): AssistantMessage {
	const blocks = collected.blocks.filter(
		(b): b is CompleteContentBlock => b !== undefined,
	)
	// 把内部类型转成 API ContentBlockParam 形态（Anthropic API 接受这个格式）
	const contentBlocks: BetaContentBlockParam[] = blocks.map(
		b => b as unknown as BetaContentBlockParam,
	)
	const inner: AssistantMessage['message'] = {
		role: 'assistant',
		content: contentBlocks as unknown as ContentItem[],
	}
	if (collected.partialMessage) {
		inner.id = collected.partialMessage.id
		inner.model = collected.partialMessage.model
		inner.type = collected.partialMessage.type
		inner.stop_reason = collected.stopReason
		inner.stop_sequence = collected.partialMessage.stop_sequence
		inner.usage = collected.finalUsage as unknown as Record<string, unknown>
	}
	return {
		type: 'assistant',
		uuid: randomUUID() as unknown as AssistantMessage['uuid'],
		message: inner,
	}
}

// ============================================================
// AgentLoop
// ============================================================

export class AgentLoop {
	/**
	 * 跑 multi-turn agent loop，emit LoopEvent，return LoopResult。
	 */
	static async *run(
		params: AgentLoopParams,
	): AsyncGenerator<LoopEvent, LoopResult, unknown> {
		const maxTurns = params.maxTurns ?? DEFAULT_MAX_TURNS
		const messages: Message[] = [...params.messages]
		const cumulativeUsage: UsageSnapshot = {...EMPTY_USAGE}
		let turnCount = 0
		let lastStopReason: StopReason = null

		// 每个 turn 都 resolve description（让模型每轮都看到最新 description；Batch 14 的 caching 策略会避免重发）
		// 但 tools 数组本身在 loop 内是稳定的 → 一次 resolve 重复使用
		let resolvedTools
		try {
			resolvedTools = params.tools && params.tools.length > 0
				? await MessageSerializer.resolveToolParams(params.tools)
				: undefined
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err))
			if (params.hooks) {
				await params.hooks.runOnError({phase: 'serialization', error})
			}
			yield {type: 'error', error, phase: 'serialization'}
			return {
				reason: 'error',
				apiStopReason: null,
				cumulativeUsage,
				finalMessages: messages,
				turnCount,
				error,
			}
		}

		while (turnCount < maxTurns) {
			turnCount++

			// 取消检查
			if (params.signal?.aborted || params.context.abortController.signal.aborted) {
				return {
					reason: 'aborted',
					apiStopReason: lastStopReason,
					cumulativeUsage,
					finalMessages: messages,
					turnCount: turnCount - 1, // 这一轮没真正开始
				}
			}

			yield {type: 'stream_request_start', turn: turnCount}

			// preStream hook
			if (params.hooks) {
				await params.hooks.runPreStream({turn: turnCount, messageCount: messages.length})
			}

			// 调 provider，收集流。如果有 cachePolicy，先序列化 messages 然后让 policy 改写 cache_control。
			let collected: CollectedAssistant
			try {
				const queryParams = {
					model: params.model,
					messages,
					systemPrompt: params.systemPrompt,
					resolvedTools,
					maxTokens: params.maxTokens,
					signal: params.signal ?? params.context.abortController.signal,
					extra: params.extra,
				}
				// 把 cache_control 注入 extra（让 provider 透传给 SDK）
				if (params.cachePolicy) {
					const serialized = MessageSerializer.toRequestParams({
						model: params.model,
						messages,
						systemPrompt: params.systemPrompt,
						tools: resolvedTools,
						maxTokens: params.maxTokens,
					})
					const planned = params.cachePolicy.plan({
						messages: serialized.messages,
						system: serialized.system,
						tools: serialized.tools,
					})
					// 把 planned 后的字段塞进 extra，让 AnthropicStreamingProvider 直接用
					queryParams.extra = {
						...(queryParams.extra ?? {}),
						__cachePlanned: {
							messages: planned.messages,
							system: planned.system,
							tools: planned.tools,
						},
					}
				}
				collected = await collectAssistantMessage(
					params.provider.queryStream(queryParams),
				)
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err))
				if (params.hooks) {
					await params.hooks.runOnError({phase: 'stream', error, turn: turnCount})
				}
				yield {type: 'error', error, phase: 'stream'}
				return {
					reason: 'error',
					apiStopReason: lastStopReason,
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
					error,
				}
			}

			// 累加 usage
			Object.assign(cumulativeUsage, addUsage(cumulativeUsage, collected.finalUsage))

			// 注入 UsageTracker
			if (params.usageTracker) {
				params.usageTracker.recordTurn(turnCount, params.model, collected.finalUsage)
			}

			// 构造 AssistantMessage 并 emit
			const assistantMessage = buildAssistantMessage(collected)
			messages.push(assistantMessage)
			yield {type: 'assistant_message', message: assistantMessage}

			// postStream hook
			if (params.hooks) {
				await params.hooks.runPostStream({turn: turnCount, message: assistantMessage})
			}

			yield {
				type: 'usage_update',
				usage: collected.finalUsage,
				cumulative: {...cumulativeUsage},
			}

			lastStopReason = collected.stopReason

			// 决策 stop_reason
			if (
				collected.stopReason === null ||
				collected.stopReason === 'end_turn'
			) {
				return {
					reason: 'end_turn',
					apiStopReason: collected.stopReason,
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
				}
			}

			if (collected.stopReason === 'max_tokens') {
				return {
					reason: 'max_tokens',
					apiStopReason: 'max_tokens',
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
				}
			}

			if (collected.stopReason === 'stop_sequence') {
				return {
					reason: 'stop_sequence',
					apiStopReason: 'stop_sequence',
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
				}
			}

			if (collected.stopReason === 'pause_turn') {
				return {
					reason: 'pause_turn',
					apiStopReason: 'pause_turn',
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
				}
			}

			if (collected.stopReason === 'refusal') {
				return {
					reason: 'refusal',
					apiStopReason: 'refusal',
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
				}
			}

			// stop_reason === 'tool_use' → 跑工具
			const toolUseBlocks = collected.blocks.filter(
				(b): b is ToolUseBlock => b !== undefined && b.type === 'tool_use',
			)
			if (toolUseBlocks.length === 0) {
				// 模型说 tool_use 却没有 tool_use block —— 异常，退出
				return {
					reason: 'error',
					apiStopReason: 'tool_use',
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
					error: new Error(
						'AgentLoop: stop_reason=tool_use but no tool_use blocks emitted',
					),
				}
			}

			// 跑工具，收集 tool_result。preTool / postTool hook 在这里包一层。
			const toolResults: ToolResultBlock[] = []
			try {
				for (const block of toolUseBlocks) {
					// preTool hook：可拒绝
					if (params.hooks) {
						const decision = await params.hooks.runPreTool({
							toolUse: block,
							context: params.context,
						})
						if (!decision.allow) {
							const denied: ToolResultBlock = {
								type: 'tool_result',
								tool_use_id: block.id,
								content: decision.reason ?? 'Hook rejected this tool call.',
								is_error: true,
							}
							yield {
								type: 'tool_update',
								update: {
									kind: 'result',
									toolUseId: block.id,
									toolName: block.name,
									toolResultBlock: denied,
								},
							}
							toolResults.push(denied)
							continue
						}
					}

					// 真正调 dispatcher
					let lastResult: ToolResultBlock | undefined
					for await (const update of ToolDispatcher.execute([block], params.context)) {
						yield {type: 'tool_update', update}
						if (update.kind === 'result') {
							lastResult = update.toolResultBlock
							toolResults.push(update.toolResultBlock)
						}
					}

					// postTool hook
					if (params.hooks && lastResult) {
						await params.hooks.runPostTool({
							toolUse: block,
							toolResult: lastResult,
							context: params.context,
						})
					}
				}
			} catch (err) {
				// dispatcher 内部 throw（不应该发生 —— 它会包错为 tool_result is_error）
				const error = err instanceof Error ? err : new Error(String(err))
				if (params.hooks) {
					await params.hooks.runOnError({phase: 'tool', error, turn: turnCount})
				}
				yield {type: 'error', error, phase: 'tool'}
				return {
					reason: 'error',
					apiStopReason: lastStopReason,
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
					error,
				}
			}

			// 把 tool_result 包成 user message
			const userToolResultMessage: Message = {
				type: 'user',
				uuid: randomUUID() as unknown as Message['uuid'],
				message: {
					role: 'user',
					content: toolResults as unknown as ContentItem[],
				},
			}
			messages.push(userToolResultMessage)

			// 取消检查（tool 执行可能很久）
			if (params.signal?.aborted || params.context.abortController.signal.aborted) {
				return {
					reason: 'aborted',
					apiStopReason: lastStopReason,
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
				}
			}
		}

		// 达到 maxTurns 上限
		return {
			reason: 'max_turns',
			apiStopReason: lastStopReason,
			cumulativeUsage,
			finalMessages: messages,
			turnCount,
		}
	}
}
