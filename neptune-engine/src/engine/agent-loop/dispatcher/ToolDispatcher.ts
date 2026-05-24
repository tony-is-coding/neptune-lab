/**
 * ToolDispatcher — 串行执行 tool_use 块、emit ToolUpdate
 *
 * 算法纲要（参考 cc query.ts:587-1450 runTools / StreamingToolExecutor 简化版）：
 *
 *   execute(toolUseBlocks, ctx):
 *     for each toolUseBlock in toolUseBlocks:
 *       1. 检查 abort signal → 标 'aborted' 包成 tool_result is_error
 *       2. 找 tool（按 name 匹配 ctx.options.tools）
 *          找不到 → 包成 tool_result is_error: 'unknown tool'
 *       3. 调 ctx.canUseTool(tool, input, ctx, toolUseId)
 *          deny → 包成 tool_result is_error: deny.message
 *          allow.updatedInput → 用更新后的 input
 *       4. tool.call(input, ctx, progressCb)
 *          - try await
 *          - catch error → 包成 tool_result is_error: error.message
 *          - 完成 → 取 result.resultForAssistant ?? result.data 序列化为 string
 *       5. emit ToolUpdate { kind: 'result', toolUseId, toolResultBlock }
 *
 * 设计原则：
 * - 错误绝不冲垮 loop（所有 tool 错误包成 tool_result is_error 发回模型）
 * - abort 时所有 in-flight tool 通过 ctx.abortController.signal 自己响应；
 *   未开始的 tool 直接标 'aborted'
 * - 串行执行（M1 简单版）；并发版后置到 Batch 之外
 *
 * 与 cc 行为差异：
 * - 不抄 StreamingToolExecutor 的并发流式（cc 366 行复杂状态机）
 * - 不抄 hook_stopped_continuation 业务（pre-tool hook 由 Batch 11 引入）
 * - 不抄 backfillObservableInput（UI 层关注点）
 * - 不抄 update.newContext（contextModifier 改 ToolUseContext —— 简化版只支持 tool 内部 mutation）
 */

import type {ToolResult, Tool, ToolCallProgress, ToolProgressData} from '../../types/tool.js'
import type {CompleteContentBlock} from '../types.js'
import type {ToolUseContext} from './ToolUseContext.js'

// ============================================================
// 公开类型
// ============================================================

/** Anthropic API tool_result block 形态。 */
export interface ToolResultBlock {
	type: 'tool_result'
	tool_use_id: string
	content: string
	is_error?: boolean
}

/**
 * Dispatcher 执行过程中 emit 给上层的事件。
 */
export type ToolUpdate =
	| {kind: 'started'; toolUseId: string; toolName: string}
	| {kind: 'progress'; toolUseId: string; toolName: string; data: ToolProgressData}
	| {kind: 'result'; toolUseId: string; toolName: string; toolResultBlock: ToolResultBlock}

/** Dispatcher 输入：单个 tool_use block（来自 SSEParser content_block_complete）。 */
export type ToolUseBlock = Extract<CompleteContentBlock, {type: 'tool_use'}>

// ============================================================
// 辅助：序列化 tool 输出
// ============================================================

/**
 * 把 ToolResult 转成 API tool_result.content 的字符串。
 *
 * 优先级：
 * 1. resultForAssistant（cc 约定字段：模型可见的输出）
 * 2. data（默认）
 * 字符串直接返回；其他类型 JSON.stringify。
 */
function serializeToolOutput(result: ToolResult<unknown>): string {
	const value = result.resultForAssistant !== undefined ? result.resultForAssistant : result.data
	if (value === undefined || value === null) return ''
	if (typeof value === 'string') return value
	try {
		return JSON.stringify(value, null, 2)
	} catch {
		return String(value)
	}
}

// ============================================================
// ToolDispatcher
// ============================================================

export class ToolDispatcher {
	/**
	 * 串行执行 tool_use 块数组，emit ToolUpdate。
	 *
	 * AsyncGenerator 让上层（AgentLoop）能拿到中间进度（progress / started）
	 * 并把 result 累计到下一轮 user message。
	 */
	static async *execute(
		toolUseBlocks: readonly ToolUseBlock[],
		ctx: ToolUseContext,
	): AsyncGenerator<ToolUpdate, void, unknown> {
		for (const block of toolUseBlocks) {
			yield* ToolDispatcher.executeOne(block, ctx)
		}
	}

	private static async *executeOne(
		block: ToolUseBlock,
		ctx: ToolUseContext,
	): AsyncGenerator<ToolUpdate, void, unknown> {
		const {id: toolUseId, name: toolName, input} = block

		// Abort 检查 — 已经 abort 的话，直接标 aborted，不再调用 tool
		if (ctx.abortController.signal.aborted) {
			yield {
				kind: 'result',
				toolUseId,
				toolName,
				toolResultBlock: {
					type: 'tool_result',
					tool_use_id: toolUseId,
					content: 'Tool execution aborted before start.',
					is_error: true,
				},
			}
			return
		}

		// 找 tool
		const tool = ctx.options.tools.find(t => t.name === toolName)
		if (!tool) {
			yield {
				kind: 'result',
				toolUseId,
				toolName,
				toolResultBlock: {
					type: 'tool_result',
					tool_use_id: toolUseId,
					content: `Unknown tool: ${toolName}`,
					is_error: true,
				},
			}
			return
		}

		yield {kind: 'started', toolUseId, toolName}

		// Stage 2.3: PermissionMode pre-check（在 canUseTool 之前）
		// 工具元数据 category 必须在 ToolDef 上声明（默认 'mutation' 保守）
		const permissionMode = ctx.options.permissionMode as
			| import('../../permissions/PermissionMode.js').PermissionMode
			| undefined
		if (permissionMode && permissionMode !== 'default') {
			const {applyPermissionMode} = await import(
				'../../permissions/PermissionMode.js'
			)
			const category = (tool as {category?: import('../../permissions/PermissionMode.js').ToolCategory})
				.category ?? 'mutation' // 默认保守 mutation
			const modeDecision = applyPermissionMode(permissionMode, category)
			if (modeDecision.behavior === 'deny') {
				yield {
					kind: 'result',
					toolUseId,
					toolName,
					toolResultBlock: {
						type: 'tool_result',
						tool_use_id: toolUseId,
						content: modeDecision.reason,
						is_error: true,
					},
				}
				return
			}
			// 'allow' / 'passthrough' 都继续走 canUseTool（passthrough 是默认行为；allow 也再走 hook 不影响）
		}

		// Permission check
		try {
			const decision = await ctx.canUseTool(tool, input, ctx, toolUseId)
			if (decision.behavior === 'deny') {
				yield {
					kind: 'result',
					toolUseId,
					toolName,
					toolResultBlock: {
						type: 'tool_result',
						tool_use_id: toolUseId,
						content: decision.message,
						is_error: true,
					},
				}
				return
			}
			// allow.updatedInput → 用新 input
			const effectiveInput =
				decision.behavior === 'allow' && decision.updatedInput !== undefined
					? decision.updatedInput
					: input

			// Tool 不支持 call → 错误（应该在 ToolRegistry 阶段已经过滤）
			if (typeof tool.call !== 'function') {
				yield {
					kind: 'result',
					toolUseId,
					toolName,
					toolResultBlock: {
						type: 'tool_result',
						tool_use_id: toolUseId,
						content: `Tool '${toolName}' has no call() method`,
						is_error: true,
					},
				}
				return
			}

			// Progress callback —— 把 progress 转成 ToolUpdate emit
			// 注意：因为 tool.call 是 Promise（不是 generator），
			// progress 必须通过外部 buffer 收集，再在 await 完成前/后冲刷。
			const progressBuffer: ToolProgressData[] = []
			const progressCb: ToolCallProgress = msg => {
				progressBuffer.push(msg.data)
			}

			// 调用工具
			let toolResult: ToolResult<unknown>
			try {
				toolResult = await (tool.call as NonNullable<Tool['call']>)(
					effectiveInput,
					ctx,
					progressCb,
				)
			} catch (err) {
				// 工具抛错 → 包成 tool_result is_error，不冲垮 loop
				const message = err instanceof Error ? err.message : String(err)
				// 冲刷缓冲的 progress（让上层即使在错误前也能看到）
				for (const data of progressBuffer) {
					yield {kind: 'progress', toolUseId, toolName, data}
				}
				yield {
					kind: 'result',
					toolUseId,
					toolName,
					toolResultBlock: {
						type: 'tool_result',
						tool_use_id: toolUseId,
						content: `Tool error: ${message}`,
						is_error: true,
					},
				}
				return
			}

			// 冲刷 progress
			for (const data of progressBuffer) {
				yield {kind: 'progress', toolUseId, toolName, data}
			}

			yield {
				kind: 'result',
				toolUseId,
				toolName,
				toolResultBlock: {
					type: 'tool_result',
					tool_use_id: toolUseId,
					content: serializeToolOutput(toolResult),
				},
			}
		} catch (err) {
			// 兜底：canUseTool 抛错或其他意外
			const message = err instanceof Error ? err.message : String(err)
			yield {
				kind: 'result',
				toolUseId,
				toolName,
				toolResultBlock: {
					type: 'tool_result',
					tool_use_id: toolUseId,
					content: `Tool dispatch error: ${message}`,
					is_error: true,
				},
			}
		}
	}
}
