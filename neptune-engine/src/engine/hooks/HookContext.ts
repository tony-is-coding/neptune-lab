/**
 * HookContext — Hook 执行的核心上下文接口
 *
 * 从 ToolUseContext 中抽象出的核心部分，零 UI 依赖。
 * 用于 headless/SDK/server 模式的 Hook 执行。
 */

/**
 * Hook 执行结果（对应原始 HookOutsideReplResult）
 */
export interface HookResult {
	/** 命令是否成功执行 */
	succeeded: boolean
	/** Hook 命令输出 */
	output?: string
	/** Hook 命令 */
	command?: string
}

/**
 * Hook 核心上下文接口 — 零 UI 依赖
 *
 * 提供 headless/SDK 模式下执行 Hook 所需的最小上下文。
 * UI 相关的上下文（如权限弹窗、渲染回调）不在此接口中。
 */
export interface HookContext {
	/** 当前会话 ID */
	sessionId: string

	/** 项目根目录 */
	projectRoot: string

	/** 是否非交互式会话（headless/SDK 模式） */
	isNonInteractive: boolean

	/** Hook 超时时间（毫秒） */
	timeoutMs?: number
}

/**
 * Hook 执行器接口 — 核心执行能力
 *
 * 每个方法对应一种 Hook 事件类型。
 * 这些方法在 headless/SDK 模式下可以独立工作。
 */
export interface HookExecutor {
	/** 执行通知 Hook */
	executeNotificationHooks(data: {
		message: string
		title?: string
		notificationType: string
	}): Promise<void>

	/** 执行配置变更 Hook */
	executeConfigChangeHooks(
		source: string,
		filePath?: string,
		timeoutMs?: number,
	): Promise<HookResult[]>

	/** 执行会话结束 Hook */
	executeSessionEndHooks(
		reason: string,
		options?: { signal?: AbortSignal },
	): Promise<void>
}

/**
 * 从 HookContext 构造基础输入
 */
export function buildBaseHookInput(ctx: HookContext): {
	sessionId: string
	projectRoot: string
} {
	return {
		sessionId: ctx.sessionId,
		projectRoot: ctx.projectRoot,
	}
}
