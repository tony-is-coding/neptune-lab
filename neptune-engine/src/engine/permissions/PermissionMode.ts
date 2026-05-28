/**
 * permissions/PermissionMode.ts — Stage 2.3 PermissionMode 协议
 *
 * 5 种内置 mode × 5 类工具 category 的决策矩阵：
 *
 *                  readOnly   write   network   shell   mutation
 *   default        passthrough passthrough passthrough passthrough passthrough
 *   plan           allow      deny    allow    deny    deny
 *   readonly       allow      deny    allow    allow   deny
 *   dangerous      allow      allow   allow    allow   allow
 *   bypass         allow      allow   allow    allow   allow
 *
 * 'default' 走 ctx.canUseTool 默认链；'bypass' 跳过 hook chain（无差别 allow）。
 * 'plan' 是 cc 的"先列计划，不动手"模式：阻止 write/shell/mutation；允许 readOnly/network 用于阅读。
 * 'readonly' 比 plan 更松，允许 shell（但只读 shell；write/mutation 仍阻）。
 * 'dangerous' 是用户显式 acknowledge 后的全开模式。
 *
 * 设计原则：
 * - 接口 + 默认实现 + 可注入：product 可换 PermissionMode 决策器
 * - 不感知具体工具（按 category 决策）；工具元数据 category 在 ToolDef 上声明
 */

import type {PermissionResult} from '../types/permissions.js'

export type PermissionMode =
	| 'default'
	| 'plan'
	| 'readonly'
	| 'dangerous'
	| 'bypass'

/**
 * Tool 行为分类（用于 PermissionMode 决策）。
 * - readOnly: 读文件 / 查询（FileRead / Glob / Grep / WebFetch / WebSearch / Skill ...）
 * - write:   写文件 / 编辑（FileWrite / FileEdit / NotebookEdit / TodoWrite ...）
 * - network: 出站网络（WebFetch / WebSearch / MCP ...）
 * - shell:   shell 执行（BashTool）
 * - mutation: 副作用强（数据库 / 外部系统 / 多 agent 状态修改 / Memory 写）
 */
export type ToolCategory =
	| 'readOnly'
	| 'write'
	| 'network'
	| 'shell'
	| 'mutation'

/**
 * applyPermissionMode 决策结果。
 * - 'allow':       直接放行（updatedInput 来自 caller 原 input）
 * - 'deny':        拒绝（带 reason，让 ToolDispatcher 包成 tool_result is_error）
 * - 'passthrough': 不决策，让下游（ctx.canUseTool / 其他 hook）继续
 */
export type ModeDecision =
	| {behavior: 'allow'}
	| {behavior: 'deny'; reason: string}
	| {behavior: 'passthrough'}

/**
 * 5 mode × 5 category 决策矩阵的核心实现。
 *
 * @returns ModeDecision —— caller 判断 behavior 后包装成 PermissionResult。
 */
export function applyPermissionMode(
	mode: PermissionMode,
	category: ToolCategory,
): ModeDecision {
	if (mode === 'bypass' || mode === 'dangerous') {
		return {behavior: 'allow'}
	}
	if (mode === 'default') {
		return {behavior: 'passthrough'}
	}
	if (mode === 'plan') {
		// plan: 阻止 write/shell/mutation；允许 readOnly/network
		switch (category) {
			case 'readOnly':
			case 'network':
				return {behavior: 'allow'}
			case 'write':
				return {behavior: 'deny', reason: 'plan_mode_blocked: write tools disabled in plan mode'}
			case 'shell':
				return {behavior: 'deny', reason: 'plan_mode_blocked: shell execution disabled in plan mode'}
			case 'mutation':
				return {behavior: 'deny', reason: 'plan_mode_blocked: mutating tools disabled in plan mode'}
		}
	}
	if (mode === 'readonly') {
		// readonly: 比 plan 松一档，允许 shell（理解为只读 shell；真实安全靠 BashSecurity）
		switch (category) {
			case 'readOnly':
			case 'network':
			case 'shell':
				return {behavior: 'allow'}
			case 'write':
				return {behavior: 'deny', reason: 'readonly_mode_blocked: write tools disabled in readonly mode'}
			case 'mutation':
				return {behavior: 'deny', reason: 'readonly_mode_blocked: mutating tools disabled in readonly mode'}
		}
	}
	// 兜底（理论不应到达）
	return {behavior: 'passthrough'}
}

/**
 * 把 ModeDecision 转换成 PermissionResult（substrate 标准格式）。
 */
export function modeDecisionToPermissionResult(
	decision: ModeDecision,
	originalInput: Record<string, unknown>,
): PermissionResult {
	if (decision.behavior === 'allow') {
		return {
			behavior: 'allow',
			updatedInput: originalInput,
		}
	}
	if (decision.behavior === 'deny') {
		return {
			behavior: 'deny',
			message: decision.reason,
		} as PermissionResult
	}
	// passthrough
	return {behavior: 'passthrough'} as PermissionResult
}
