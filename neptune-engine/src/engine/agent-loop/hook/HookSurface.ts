/**
 * HookSurface — Agent Loop 业务注入点
 *
 * 设计原则：
 * - per-session 注册（不全局，避免污染其他会话）
 * - 多 hook 顺序执行（preStream/postStream）或并发（onError）
 * - 每个 hook 独立 try/catch（一个失败不影响其他）
 * - hook 抛错只记录到 onError，不冲垮 loop
 *
 * 与 cc 行为差异：
 * - 不抄 cc 的 stop_hook 业务实现（特定 product 场景）
 * - 不抄 advisor / queryTracking 业务 hook
 * - 不抄 langfuse 集成（product 自己注入即可）
 */

import type {AssistantMessage} from '../../types/message.js'
import type {ToolUseBlock, ToolResultBlock} from '../dispatcher/ToolDispatcher.js'
import type {ToolUseContext} from '../dispatcher/ToolUseContext.js'

// ============================================================
// Hook 类型
// ============================================================

/** stream 发起前调用，可读 / 修改请求 hint（默认 no-op）。 */
export type PreStreamHook = (info: {
	turn: number
	messageCount: number
}) => Promise<void> | void

/** stream 收到完整 assistant message 后调用。 */
export type PostStreamHook = (info: {
	turn: number
	message: AssistantMessage
}) => Promise<void> | void

/**
 * tool 执行前调用。
 * 返回 {allow: false, reason} → 工具被拒（包成 tool_result is_error）。
 * 返回 {allow: true} 或 undefined / void → 继续执行。
 */
export type PreToolHook = (info: {
	toolUse: ToolUseBlock
	context: ToolUseContext
}) => Promise<{allow: boolean; reason?: string} | void> | {allow: boolean; reason?: string} | void

/** tool 执行后调用。 */
export type PostToolHook = (info: {
	toolUse: ToolUseBlock
	toolResult: ToolResultBlock
	context: ToolUseContext
}) => Promise<void> | void

/** 错误事件回调。 */
export type OnErrorHook = (info: {
	phase: 'stream' | 'tool' | 'serialization' | 'hook'
	error: Error
	turn?: number
}) => Promise<void> | void

// ============================================================
// HookSurface
// ============================================================

export interface HookRegistry {
	preStream?: PreStreamHook[]
	postStream?: PostStreamHook[]
	preTool?: PreToolHook[]
	postTool?: PostToolHook[]
	onError?: OnErrorHook[]
}

export class HookSurface {
	private readonly hooks: Required<HookRegistry>

	constructor(initial: HookRegistry = {}) {
		this.hooks = {
			preStream: [...(initial.preStream ?? [])],
			postStream: [...(initial.postStream ?? [])],
			preTool: [...(initial.preTool ?? [])],
			postTool: [...(initial.postTool ?? [])],
			onError: [...(initial.onError ?? [])],
		}
	}

	register<K extends keyof HookRegistry>(
		kind: K,
		hook: NonNullable<HookRegistry[K]>[number],
	): void {
		;(this.hooks[kind] as Array<typeof hook>).push(hook)
	}

	/**
	 * 顺序执行所有 preStream hook。
	 * Hook 抛错 → 调 onError，loop 继续（不阻断）。
	 */
	async runPreStream(info: Parameters<PreStreamHook>[0]): Promise<void> {
		for (const hook of this.hooks.preStream) {
			try {
				await hook(info)
			} catch (err) {
				await this.runOnError({
					phase: 'hook',
					error: err instanceof Error ? err : new Error(String(err)),
					turn: info.turn,
				})
			}
		}
	}

	async runPostStream(info: Parameters<PostStreamHook>[0]): Promise<void> {
		for (const hook of this.hooks.postStream) {
			try {
				await hook(info)
			} catch (err) {
				await this.runOnError({
					phase: 'hook',
					error: err instanceof Error ? err : new Error(String(err)),
					turn: info.turn,
				})
			}
		}
	}

	/**
	 * 顺序执行所有 preTool hook。
	 * 任何 hook 返回 {allow: false} → 立即拒绝，返回该 reason。
	 * 否则返回 {allow: true}。
	 */
	async runPreTool(info: Parameters<PreToolHook>[0]): Promise<{allow: boolean; reason?: string}> {
		for (const hook of this.hooks.preTool) {
			try {
				const result = await hook(info)
				if (result && result.allow === false) {
					return {allow: false, reason: result.reason}
				}
			} catch (err) {
				await this.runOnError({
					phase: 'hook',
					error: err instanceof Error ? err : new Error(String(err)),
				})
				// hook 抛错 → 视作不阻拦（继续）
			}
		}
		return {allow: true}
	}

	async runPostTool(info: Parameters<PostToolHook>[0]): Promise<void> {
		for (const hook of this.hooks.postTool) {
			try {
				await hook(info)
			} catch (err) {
				await this.runOnError({
					phase: 'hook',
					error: err instanceof Error ? err : new Error(String(err)),
				})
			}
		}
	}

	/**
	 * 错误事件并发派发给所有 onError hook（不串行，避免 hook 互相阻塞）。
	 * onError hook 自己抛错 → 静默吞（避免无限递归）。
	 */
	async runOnError(info: Parameters<OnErrorHook>[0]): Promise<void> {
		await Promise.allSettled(
			this.hooks.onError.map(async hook => {
				try {
					await hook(info)
				} catch {
					// 静默
				}
			}),
		)
	}

	/** 测试用：拿到当前注册的 hook 数。 */
	count(kind: keyof HookRegistry): number {
		return this.hooks[kind].length
	}
}
