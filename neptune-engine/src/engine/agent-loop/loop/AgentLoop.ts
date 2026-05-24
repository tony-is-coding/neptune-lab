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
import type {LoopEvent, LoopResult, GovernanceSnapshot} from './loopEvents.js'
import type {HookSurface} from '../hook/HookSurface.js'
import type {UsageTracker} from '../usage/UsageTracker.js'
import type {PolicyDecision, ToolInvocation} from '@shared/contracts'

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
	/** History compaction policy（默认无；注入 MicroCompaction 即可启用）。 */
	compactionPolicy?: import('../compaction/CompactionPolicy.js').CompactionPolicy
	/** Budget tracker（默认无；注入 DefaultBudgetTracker 即可启用 token 上限保护）。 */
	budgetTracker?: import('../budget/BudgetTracker.js').BudgetTracker
	/** Stage 2.4: Governance hooks（PolicyHook / HumanReviewHook / EvalHook / ArtifactHook）。 */
	governance?: import('../../governance/index.js').GovernanceHooks
	/**
	 * Stage 3.5: RunStore 注入（状态外化）。
	 * - 提供时，每个 LoopEvent 自动 append 到 store；退出时 updateStatus
	 * - runId 必须配合 runStore；不传则 store.create() 内部生成
	 */
	runStore?: import('../../run/index.js').RunStore
	/** Stage 3.5: 显式指定 runId（resume 场景必传）。 */
	runId?: string
	/**
	 * Stage 4.1: AuditEventStore 注入（合规 hash chain）。
	 * - 提供时，governance_decision / tool_update / assistant_message
	 *   自动 append 到 audit chain
	 * - 与 runStore 互补：runStore 是 resume / state 用，auditStore 是合规 / 审计用
	 */
	auditStore?: import('../../audit/index.js').AuditEventStore
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

		// Stage 2.4: governance counters（仅当 governance 注入时才填充非零）
		const governance = params.governance
		const governanceActive = !!(
			governance?.policyHook ||
			governance?.humanReviewHook ||
			governance?.evalHook ||
			governance?.artifactHook
		)
		const govSnapshot: GovernanceSnapshot = {
			policyDecisionsCount: 0,
			humanReviewsCount: 0,
			artifactsPersistedCount: 0,
			evalRunsCount: 0,
		}
		const buildResult = (base: Omit<LoopResult, 'governanceSnapshot'>): LoopResult => {
			if (governanceActive) {
				return {...base, governanceSnapshot: {...govSnapshot}}
			}
			return base
		}

		const runId = (params.context as {runId?: string}).runId ?? randomUUID()

		// Stage 2.4: 收尾 helper —— 在每个退出点调一次 EvalHook（如果注入了），并把 governanceSnapshot 注入 LoopResult
		// 用 generator delegation：`return yield* finalize(...)` 会把 finalize 的 return value 作为外层的 return value
		const finalize = async function* (
			base: Omit<LoopResult, 'governanceSnapshot'>,
		): AsyncGenerator<LoopEvent, LoopResult, unknown> {
			if (governance?.evalHook) {
				try {
					const evalResult = await governance.evalHook.onRunComplete(runId, base)
					govSnapshot.evalRunsCount++
					yield {
						type: 'governance_decision',
						event: {phase: 'eval_complete', runId, result: evalResult},
					}
				} catch (err) {
					const e = err instanceof Error ? err : new Error(String(err))
					yield {type: 'error', error: e, phase: 'governance'}
				}
			}
			return buildResult(base)
		}

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
			return yield* finalize({
				reason: 'error',
				apiStopReason: null,
				cumulativeUsage,
				finalMessages: messages,
				turnCount,
				error,
			})
		}

		while (turnCount < maxTurns) {
			turnCount++

			// 取消检查
			if (params.signal?.aborted || params.context.abortController.signal.aborted) {
				return yield* finalize({
					reason: 'aborted',
					apiStopReason: lastStopReason,
					cumulativeUsage,
					finalMessages: messages,
					turnCount: turnCount - 1, // 这一轮没真正开始
				})
			}

			yield {type: 'stream_request_start', turn: turnCount}

			// preStream hook
			if (params.hooks) {
				await params.hooks.runPreStream({turn: turnCount, messageCount: messages.length})
			}

			// History compaction（可选）
			if (params.compactionPolicy) {
				const should = params.compactionPolicy.shouldCompact(messages, {
					usage: cumulativeUsage,
				})
				if (should) {
					const result = params.compactionPolicy.compact(messages)
					if (result.messagesCompacted > 0) {
						messages.length = 0
						messages.push(...result.messages)
					}
				}
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
				return yield* finalize({
					reason: 'error',
					apiStopReason: lastStopReason,
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
					error,
				})
			}

			// 累加 usage
			Object.assign(cumulativeUsage, addUsage(cumulativeUsage, collected.finalUsage))

			// 注入 UsageTracker
			if (params.usageTracker) {
				params.usageTracker.recordTurn(turnCount, params.model, collected.finalUsage)
			}

			// Budget check（统计；超出则在 emit 后退出）
			let budgetExceeded = false
			if (params.budgetTracker) {
				params.budgetTracker.recordUsage(collected.finalUsage)
				if (params.budgetTracker.check().shouldStop) {
					budgetExceeded = true
				}
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

			// Budget exceeded → 在 assistantMessage emit 后退出
			if (budgetExceeded) {
				return yield* finalize({
					reason: 'budget_exceeded',
					apiStopReason: collected.stopReason,
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
				})
			}

			// 决策 stop_reason
			if (
				collected.stopReason === null ||
				collected.stopReason === 'end_turn'
			) {
				return yield* finalize({
					reason: 'end_turn',
					apiStopReason: collected.stopReason,
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
				})
			}

			if (collected.stopReason === 'max_tokens') {
				return yield* finalize({
					reason: 'max_tokens',
					apiStopReason: 'max_tokens',
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
				})
			}

			if (collected.stopReason === 'stop_sequence') {
				return yield* finalize({
					reason: 'stop_sequence',
					apiStopReason: 'stop_sequence',
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
				})
			}

			if (collected.stopReason === 'pause_turn') {
				return yield* finalize({
					reason: 'pause_turn',
					apiStopReason: 'pause_turn',
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
				})
			}

			if (collected.stopReason === 'refusal') {
				return yield* finalize({
					reason: 'refusal',
					apiStopReason: 'refusal',
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
				})
			}

			// stop_reason === 'tool_use' → 跑工具
			const toolUseBlocks = collected.blocks.filter(
				(b): b is ToolUseBlock => b !== undefined && b.type === 'tool_use',
			)
			if (toolUseBlocks.length === 0) {
				// 模型说 tool_use 却没有 tool_use block —— 异常，退出
				return yield* finalize({
					reason: 'error',
					apiStopReason: 'tool_use',
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
					error: new Error(
						'AgentLoop: stop_reason=tool_use but no tool_use blocks emitted',
					),
				})
			}

			// 跑工具，收集 tool_result。preTool / postTool hook 在这里包一层。
			const toolResults: ToolResultBlock[] = []
			try {
				for (const block of toolUseBlocks) {
					// Stage 2.4: PolicyHook（先于 preTool hook；产品级业务策略）
					if (governance?.policyHook) {
						const invocation: ToolInvocation = {
							id: randomUUID(),
							runId,
							toolName: block.name,
							inputSnapshot: block.input,
							status: 'pending',
							startedAt: new Date().toISOString(),
						}
						let decision: PolicyDecision | undefined
						try {
							decision = await governance.policyHook.beforeToolUse(invocation)
						} catch (err) {
							const e = err instanceof Error ? err : new Error(String(err))
							yield {type: 'error', error: e, phase: 'governance'}
							// fail-open：放行（继续走后续 preTool hook）
						}
						if (decision) {
							govSnapshot.policyDecisionsCount++
							yield {
								type: 'governance_decision',
								event: {
									phase: 'pre_tool',
									toolUseId: block.id,
									toolName: block.name,
									decision,
								},
							}
							if (decision.behavior === 'deny') {
								const denied: ToolResultBlock = {
									type: 'tool_result',
									tool_use_id: block.id,
									content:
										decision.reason ??
										'Tool call denied by policy.',
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
							if (decision.behavior === 'require_review') {
								// 调 HumanReviewHook（如未注入则相当于 deny —— 安全默认）
								if (!governance.humanReviewHook) {
									const denied: ToolResultBlock = {
										type: 'tool_result',
										tool_use_id: block.id,
										content:
											decision.reason ??
											'Tool call requires human review (no reviewer configured).',
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
								let review
								try {
									review = await governance.humanReviewHook.requestReview({
										runId,
										findingId: invocation.id,
										severity: 'medium',
										evidence: [block.id],
									})
									govSnapshot.humanReviewsCount++
									yield {
										type: 'governance_decision',
										event: {
											phase: 'human_review',
											toolUseId: block.id,
											toolName: block.name,
											review,
										},
									}
								} catch (err) {
									const e = err instanceof Error ? err : new Error(String(err))
									yield {type: 'error', error: e, phase: 'governance'}
								}
								if (review && review.decision !== 'approved') {
									const denied: ToolResultBlock = {
										type: 'tool_result',
										tool_use_id: block.id,
										content: `Tool rejected by human reviewer: ${review.decision}`,
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
							// allow / approved → 继续
						}
					}

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
					let lastMcpMeta:
						| {_meta?: Record<string, unknown>; structuredContent?: Record<string, unknown>}
						| undefined
					for await (const update of ToolDispatcher.execute([block], params.context)) {
						yield {type: 'tool_update', update}
						if (update.kind === 'result') {
							lastResult = update.toolResultBlock
							lastMcpMeta = update.mcpMeta
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

					// Stage 2.4: ArtifactHook —— 从 ToolResult.mcpMeta._meta.artifactInputs 提取
					// 约定（产品级元数据，substrate 不解析具体业务字段）：
					//   tool 在返回 ToolResult 时挂 mcpMeta._meta.artifactInputs: ArtifactInputLite[]
					//   字段：{mime, content, hint?, connectorVersion?}
					if (
						governance?.artifactHook &&
						lastResult &&
						!lastResult.is_error &&
						lastMcpMeta?._meta
					) {
						const inputs = lastMcpMeta._meta.artifactInputs as
							| Array<{
									mime: string
									content: string | Uint8Array | ArrayBuffer
									hint?: string
									connectorVersion?: string
							  }>
							| undefined
						if (Array.isArray(inputs) && inputs.length > 0) {
							for (const input of inputs) {
								try {
									const artifact = await governance.artifactHook.persistArtifact({
										runId,
										toolInvocationId: block.id,
										source: {
											toolName: block.name,
											agentTemplateVersion:
												((params.context as {agentTemplateVersion?: string})
													.agentTemplateVersion ?? 'unknown'),
											connectorVersion: input.connectorVersion,
										},
										content: input.content,
										mime: input.mime,
										hint: input.hint,
									})
									govSnapshot.artifactsPersistedCount++
									yield {
										type: 'governance_decision',
										event: {
											phase: 'artifact_persisted',
											toolUseId: block.id,
											toolName: block.name,
											artifact,
										},
									}
								} catch (err) {
									const e =
										err instanceof Error ? err : new Error(String(err))
									yield {type: 'error', error: e, phase: 'governance'}
								}
							}
						}
					}
				}
			} catch (err) {
				// dispatcher 内部 throw（不应该发生 —— 它会包错为 tool_result is_error）
				const error = err instanceof Error ? err : new Error(String(err))
				if (params.hooks) {
					await params.hooks.runOnError({phase: 'tool', error, turn: turnCount})
				}
				yield {type: 'error', error, phase: 'tool'}
				return yield* finalize({
					reason: 'error',
					apiStopReason: lastStopReason,
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
					error,
				})
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
				return yield* finalize({
					reason: 'aborted',
					apiStopReason: lastStopReason,
					cumulativeUsage,
					finalMessages: messages,
					turnCount,
				})
			}
		}

		// 达到 maxTurns 上限
		return yield* finalize({
			reason: 'max_turns',
			apiStopReason: lastStopReason,
			cumulativeUsage,
			finalMessages: messages,
			turnCount,
		})
	}

	/**
	 * Stage 3.5: runWithStore — 包装 AgentLoop.run，在每个 LoopEvent yield 前
	 * 同步 append 到 RunStore；退出时按 LoopResult.reason 更新 Run.status。
	 *
	 * 用法：
	 *   const store = new FileRunStore('./runs')
	 *   const run = await store.create({metadata: {...}})
	 *   const gen = AgentLoop.runWithStore({...params, runStore: store, runId: run.id})
	 *   for await (const event of gen) { ... }  // events 自动持久化
	 *   // run.json status 已被刷成 'completed' / 'failed' / 'aborted'
	 *
	 * 不传 runStore 时退化为 AgentLoop.run（透传）。
	 */
	static async *runWithStore(
		params: AgentLoopParams,
	): AsyncGenerator<LoopEvent, LoopResult, unknown> {
		const store = params.runStore
		if (!store) {
			// 无 store → 直接透传（为方便 caller 统一调用）
			return yield* AgentLoop.run(params)
		}
		// 没传 runId 就 store.create() 拿
		let runId = params.runId
		if (!runId) {
			const run = await store.create()
			runId = run.id
		}
		// 状态切到 running
		try {
			await store.updateStatus(runId, 'running')
		} catch {
			// 容忍 updateStatus 失败（store 实现可能 strict 检查 run 存在）
			// 此时 caller 已传 runId 但未先 create，我们尝试 create 一次
			await store.create({id: runId})
			await store.updateStatus(runId, 'running')
		}

		const inner = AgentLoop.run({...params, runId})
		let result: LoopResult | undefined
		try {
			let next = await inner.next()
			while (!next.done) {
				const event = next.value as LoopEvent
				// 先持久化再 yield 给 caller —— 保证 store 是 source of truth
				try {
					await store.appendEvent(runId, event)
				} catch (err) {
					// store 写入失败：emit error 但继续（fail-open）
					yield {
						type: 'error',
						error: err instanceof Error ? err : new Error(String(err)),
						phase: 'serialization',
					}
				}
				// Stage 4.1: 同步写 audit chain（仅审计敏感事件）
				if (params.auditStore && shouldAudit(event)) {
					try {
						await params.auditStore.append(runId, auditPayloadOf(event))
					} catch (err) {
						yield {
							type: 'error',
							error: err instanceof Error ? err : new Error(String(err)),
							phase: 'serialization',
						}
					}
				}
				yield event
				next = await inner.next()
			}
			result = next.value as LoopResult
		} finally {
			// 根据 result.reason 决定 final status
			const status = mapReasonToStatus(result?.reason)
			try {
				await store.updateStatus(runId, status)
			} catch {
				// 退出阶段不应再抛
			}
		}
		// result 一定存在（while 循环 break 时已赋值）
		return result as LoopResult
	}

	/**
	 * Stage 3.5 + 4.3: resume — 从已存在 Run 续跑
	 *
	 * 流程：
	 * 1. store.loadSnapshot(runId) 重建 messages（默认从最新位置）
	 * 2. opts.fromCheckpoint 提供时，改用 loadCheckpoint(runId, turnNumber)
	 *    重建到指定 turn 末尾的状态（任意点 resume）
	 * 3. 用重建的 messages 作为初始 messages 调 runWithStore（events 仍 append
	 *    到原 jsonl 末尾）
	 *
	 * 不传 runStore 时抛 Error。
	 */
	static async *resume(
		runId: string,
		params: Omit<AgentLoopParams, 'messages' | 'runId'>,
		opts?: {fromCheckpoint?: number},
	): AsyncGenerator<LoopEvent, LoopResult, unknown> {
		if (!params.runStore) {
			throw new Error('AgentLoop.resume requires params.runStore')
		}
		let messages: Message[]
		if (opts?.fromCheckpoint !== undefined) {
			if (!params.runStore.loadCheckpoint) {
				throw new Error('runStore does not implement loadCheckpoint')
			}
			const cp = await params.runStore.loadCheckpoint(runId, opts.fromCheckpoint)
			if (!cp) {
				throw new Error(
					`Checkpoint not found for run ${runId} at turn ${opts.fromCheckpoint}`,
				)
			}
			messages = cp.messages
		} else {
			const snapshot = await params.runStore.loadSnapshot(runId)
			if (!snapshot) {
				throw new Error(`Run not found for resume: ${runId}`)
			}
			messages = snapshot.messages
		}
		// 用重建后的 messages 作为初始 messages，runId 复用
		return yield* AgentLoop.runWithStore({
			...params,
			messages,
			runId,
		})
	}
}

/**
 * 把 LoopResult.reason 映射到 RunStatus。
 */
function mapReasonToStatus(
	reason: LoopResult['reason'] | undefined,
): import('../../run/index.js').RunStatus {
	if (!reason) return 'failed'
	switch (reason) {
		case 'end_turn':
		case 'stop_sequence':
		case 'refusal':
			return 'completed'
		case 'aborted':
			return 'aborted'
		case 'pause_turn':
		case 'max_tokens':
		case 'max_turns':
		case 'budget_exceeded':
			return 'paused'
		case 'error':
			return 'failed'
		default:
			return 'failed'
	}
}

/**
 * Stage 4.1: 决定哪些 LoopEvent 应该写 audit chain。
 *
 * 选择"语义敏感"事件：
 * - assistant_message：模型输出（决策核心）
 * - tool_update kind=result：工具执行结果（行动核心）
 * - governance_decision：策略 / 人工复核 / artifact / eval 决策
 * - error：失败事件（重要审计点）
 *
 * 跳过：stream_request_start（每 turn 噪音）、tool_update kind=started/progress（中间态）、usage_update（统计）
 */
function shouldAudit(event: LoopEvent): boolean {
	if (event.type === 'assistant_message') return true
	if (event.type === 'governance_decision') return true
	if (event.type === 'error') return true
	if (event.type === 'tool_update' && event.update.kind === 'result') return true
	return false
}

/**
 * Stage 4.1: 把 LoopEvent 转成 audit payload（精简关键字段，避免审计 chain 巨大）。
 */
function auditPayloadOf(event: LoopEvent): Record<string, unknown> {
	switch (event.type) {
		case 'assistant_message':
			return {
				kind: 'assistant_message',
				stopReason: event.message.message?.stop_reason ?? null,
				contentLen: Array.isArray(event.message.message?.content)
					? event.message.message?.content.length
					: typeof event.message.message?.content === 'string'
						? event.message.message?.content.length
						: 0,
			}
		case 'tool_update':
			if (event.update.kind === 'result') {
				return {
					kind: 'tool_result',
					toolUseId: event.update.toolUseId,
					toolName: event.update.toolName,
					isError: event.update.toolResultBlock.is_error ?? false,
				}
			}
			return {kind: 'tool_update', updateKind: event.update.kind}
		case 'governance_decision':
			return {
				kind: 'governance_decision',
				phase: event.event.phase,
				...(event.event.phase === 'pre_tool' && {
					toolName: event.event.toolName,
					decision: event.event.decision.behavior,
				}),
				...(event.event.phase === 'human_review' && {
					toolName: event.event.toolName,
					decision: event.event.review.decision,
				}),
				...(event.event.phase === 'artifact_persisted' && {
					toolName: event.event.toolName,
					artifactId: event.event.artifact.id,
					hash: event.event.artifact.hash,
				}),
			}
		case 'error':
			return {
				kind: 'error',
				phase: event.phase,
				message: event.error.message,
			}
		default:
			return {kind: event.type}
	}
}
