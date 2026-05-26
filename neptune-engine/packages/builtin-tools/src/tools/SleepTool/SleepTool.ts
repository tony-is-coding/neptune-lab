/**
 * SleepTool — 时序原语（让 LLM 暂停指定秒数）
 *
 * 设计目的（P0.7）：
 * - cc 原版硬编码 feature('PROACTIVE') / require('src/proactive/...') 业务
 * - substrate 重写为纯 sleep + 取消机制
 * - 是否拒绝 sleep 由 host 通过 ctx.shouldRefuseSleep 注入决策（业务自决）
 *
 * 与 cc 行为对齐：
 * - 输入 { duration_seconds } / 输出 { slept_seconds, interrupted }
 * - signal abort 时立即解锁（interrupted=true）
 *
 * 业务剥离：
 * - 不依赖 'bun:bundle' feature() / 'src/proactive/' cc 模块
 * - product 注入 ctx.shouldRefuseSleep 实现 cc proactive 等价行为
 */

import {z} from 'zod/v4'
import type {ToolResultBlockParam, ToolUseContext} from '../../tool.js'
import {buildTool} from '../../tool.js'
import {lazySchema} from '../../utils/lazySchema.js'
import {SLEEP_TOOL_NAME, DESCRIPTION, SLEEP_TOOL_PROMPT} from './prompt.js'

const inputSchema = lazySchema(() =>
	z.strictObject({
		duration_seconds: z
			.number()
			.describe(
				'How long to sleep in seconds. Can be interrupted by the user at any time.',
			),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>
type SleepInput = z.infer<InputSchema>

type SleepOutput = { slept_seconds: number; interrupted: boolean }

/**
 * Host 注入的「是否拒绝当前 Sleep」决策回调。
 *
 * 返回 true → 立即返回 interrupted=true（不实际 sleep）。
 * 返回 false / undefined → 正常 sleep。
 *
 * cc 等价行为：把 isProactiveActive() 取反包装成此函数。
 */
type ShouldRefuseSleepFn = () => boolean | Promise<boolean>

interface SleepToolContext extends ToolUseContext {
	shouldRefuseSleep?: ShouldRefuseSleepFn
}

export const SleepTool = buildTool({
	name: SLEEP_TOOL_NAME,
	searchHint: 'wait pause sleep rest idle duration timer',
	maxResultSizeChars: 1_000,
	strict: true,

	get inputSchema(): InputSchema {
		return inputSchema()
	},

	async description() {
		return DESCRIPTION
	},
	async prompt() {
		return SLEEP_TOOL_PROMPT
	},

	isConcurrencySafe() {
		return true
	},
	isReadOnly() {
		return true
	},

	userFacingName() {
		return SLEEP_TOOL_NAME
	},

	renderToolUseMessage(input: Partial<SleepInput>) {
		const secs = input.duration_seconds ?? '?'
		return `Sleep: ${secs}s`
	},

	mapToolResultToToolResultBlockParam(
		content: SleepOutput,
		toolUseID: string,
	): ToolResultBlockParam {
		const msg = content.interrupted
			? `Sleep interrupted after ${content.slept_seconds}s`
			: `Slept for ${content.slept_seconds}s`
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: msg,
		}
	},

	async call(input: SleepInput, context: SleepToolContext) {
		// Host 注入的拒绝决策（cc proactive 等价）— 不内联 cc 业务
		if (context.shouldRefuseSleep) {
			const refuse = await context.shouldRefuseSleep()
			if (refuse) {
				return {
					data: {
						slept_seconds: 0,
						interrupted: true,
					},
				}
			}
		}

		const {duration_seconds} = input
		const startTime = Date.now()

		try {
			await new Promise<void>((resolve, reject) => {
				const timer = setTimeout(resolve, duration_seconds * 1000)

				// Abort via user interrupt
				const abortHandler = (): void => {
					clearTimeout(timer)
					reject(new Error('interrupted'))
				}
				context.abortController?.signal.addEventListener('abort', abortHandler, {
					once: true,
				})
			})
			return {
				data: {
					slept_seconds: duration_seconds,
					interrupted: false,
				},
			}
		} catch {
			const elapsed = Math.round((Date.now() - startTime) / 1000)
			return {
				data: {
					slept_seconds: elapsed,
					interrupted: true,
				},
			}
		}
	},
})
