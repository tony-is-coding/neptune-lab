/**
 * ToolUseContext — Agent Loop 注入工具调用的运行时上下文
 *
 * 设计原则：
 * - 与 engine/types/tool.ts 的 opaque `{[key: string]: unknown}` 契约兼容（强类型 view）
 * - 与 builtin-tools/kernel-context.ts 的 KernelToolContext 直接对齐（kernel 字段）
 * - 让 substrate 层注入 abortController / permissions / kernel 等结构化字段，
 *   product 通过 hooks / extra 注入业务字段
 *
 * 与 cc 行为差异（详见 oracle/README.md）：
 * - 不抄 toolUseContext.queryTracking（chainId / depth — product 关注点）
 * - 不抄 toolUseContext.options.thinkingConfig 内嵌（caller 通过 extra 字段透传）
 * - 不抄 langfuseTrace / advisorModel / addNotification（业务字段，product 注入）
 */

import type {
	SkillRegistry,
	TodoState,
	TaskQueue,
	MemoryStore,
} from '../../index.js'
import type {ToolRegistry as KernelToolRegistry} from '../../tool-registry/index.js'
import type {Tool} from '../../types/tool.js'
import type {ToolPermissionContext} from '../../types/permissions.js'

// ============================================================
// Permission delegate
// ============================================================

/**
 * canUseTool 决策结果。
 *
 * 形式与 cc 一致：`behavior: 'allow' | 'deny'`，deny 时附加 message。
 */
export type CanUseToolResult =
	| {behavior: 'allow'; updatedInput?: Record<string, unknown>}
	| {behavior: 'deny'; message: string; interrupt?: boolean}

export type CanUseToolFn = (
	tool: Tool,
	input: Record<string, unknown>,
	context: ToolUseContext,
	toolUseId: string,
) => Promise<CanUseToolResult> | CanUseToolResult

/** 默认 allow-all 权限委托（substrate 默认；product 注入更严格的）。 */
export const allowAllCanUseTool: CanUseToolFn = () => ({behavior: 'allow'})

// ============================================================
// Kernel protocol bag（与 builtin-tools/kernel-context.ts 同步）
// ============================================================

export interface KernelProtocolBag {
	readonly skillRegistry?: SkillRegistry
	readonly todoState?: TodoState
	readonly taskQueue?: TaskQueue
	readonly toolRegistry?: KernelToolRegistry
	readonly memoryStore?: MemoryStore
}

// ============================================================
// ToolUseContext
// ============================================================

/**
 * Agent Loop 用的强类型 ToolUseContext。
 *
 * 形式上仍兼容 engine/types/tool.ts 的 opaque `{[key: string]: unknown}`
 * 契约（让旧的工具签名也能消费）。
 */
export interface ToolUseContext {
	/** 取消信号源；substrate 在 abort 时把所有 in-flight tool 标记 aborted。 */
	abortController: AbortController
	/** Subagent id（顶层 agent 留 undefined）。 */
	agentId?: string
	/** 选项 bag，包含 tools 列表 + 是否非交互会话等。 */
	options: {
		/** 当前会话可用的全部工具（用于 ToolRegistry / 工具发现）。 */
		tools: Tool[]
		isNonInteractiveSession: boolean
		/** Stage 2.3: PermissionMode 注入。'default' / undefined = passthrough。 */
		permissionMode?:
			| 'default'
			| 'plan'
			| 'readonly'
			| 'dangerous'
			| 'bypass'
		/** 业务方扩展：thinkingConfig / fastMode / mcpTools 等 */
		[key: string]: unknown
	}
	/** Permission 委托（默认 allow-all；product 可换 ask-user / policy）。 */
	canUseTool: CanUseToolFn
	/** 权限上下文（cc canUseTool 调用时需要传入）。可空。 */
	getToolPermissionContext?: () => Promise<ToolPermissionContext> | ToolPermissionContext
	/** Phase A 五个 protocol。Phase B kernel tools 从这里拿。 */
	kernel?: KernelProtocolBag
	/** 业务方扩展字段（langfuse / addNotification 等通过这里注入）。 */
	[key: string]: unknown
}

// ============================================================
// 工厂
// ============================================================

export interface CreateToolUseContextOptions {
	tools?: Tool[]
	isNonInteractiveSession?: boolean
	agentId?: string
	abortController?: AbortController
	canUseTool?: CanUseToolFn
	getToolPermissionContext?: () => Promise<ToolPermissionContext> | ToolPermissionContext
	kernel?: KernelProtocolBag
	/** 任意扩展字段，会合并到 context 顶层。 */
	extra?: Record<string, unknown>
	/** 任意 options 字段。 */
	optionsExtra?: Record<string, unknown>
}

/**
 * 创建 ToolUseContext 的工厂函数。
 *
 * 默认行为：
 * - abortController: 新建一个
 * - canUseTool: allow-all
 * - tools: []
 * - isNonInteractiveSession: false
 * - kernel: 不注入（product 显式传入）
 */
export function createToolUseContext(
	opts: CreateToolUseContextOptions = {},
): ToolUseContext {
	const ctx: ToolUseContext = {
		abortController: opts.abortController ?? new AbortController(),
		agentId: opts.agentId,
		options: {
			tools: opts.tools ?? [],
			isNonInteractiveSession: opts.isNonInteractiveSession ?? false,
			...(opts.optionsExtra ?? {}),
		},
		canUseTool: opts.canUseTool ?? allowAllCanUseTool,
	}
	if (opts.getToolPermissionContext) {
		ctx.getToolPermissionContext = opts.getToolPermissionContext
	}
	if (opts.kernel) {
		ctx.kernel = opts.kernel
	}
	if (opts.extra) {
		Object.assign(ctx, opts.extra)
	}
	return ctx
}
