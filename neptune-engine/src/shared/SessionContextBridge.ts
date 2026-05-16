/**
 * SessionContextBridge — 独立的 ALS 桥接层
 *
 * 设计目的：
 * - 解决 bootstrap/state ↔ SessionContext 的循环依赖问题
 * - bootstrap/state.ts 是 import DAG 的叶子节点，不能反向依赖 engine/
 * - 提供独立的 AsyncLocalStorage 实例，与 engine/ 的 SessionContextStorage 隔离
 *
 * 关键设计约束：
 * - 只能 import Node.js 内置模块（async_hooks）
 * - 不 import 任何 src/ 下的其他模块
 * - 提供同步的 get/set 接口（与 bootstrap/state.ts 的同步 getter 匹配）
 *
 * 使用场景：
 * - Per-session 字段的 ALS 存储（cwd, sessionId, projectRoot 等）
 * - 作为后续任务（T6-T9）的基础设施
 */

import {AsyncLocalStorage} from 'node:async_hooks'

// ============================================================
// 类型定义
// ============================================================

/**
 * SessionContext 数据结构
 *
 * 包含 per-session 的核心字段，与 bootstrap/state.ts 中的字段对应。
 */
export interface SessionContextData {
	/** 当前工作目录 */
	cwd?: string
	/** Session ID */
	sessionId?: string
	/** 项目根目录（stable，不随 EnterWorktreeTool 变化） */
	projectRoot?: string
	/** 原始启动目录 */
	originalCwd?: string
	/** 成本数据（累积） */
	totalCostUSD?: number
	totalAPIDuration?: number
	totalAPIDurationWithoutRetries?: number
	totalToolDuration?: number
	totalLinesAdded?: number
	totalLinesRemoved?: number
	/** 模型使用情况 */
	modelUsage?: Record<string, unknown>
	/** 主循环模型配置 */
	mainLoopModelOverride?: unknown
	initialMainLoopModel?: unknown
	/** Session 级别的 Cron 任务 */
	sessionCronTasks?: Array<{
		id: string
		cron: string
		prompt: string
		createdAt: number
		recurring?: boolean
		agentId?: string
	}>
	/** Session 创建的团队 */
	sessionCreatedTeams?: Set<string>
	/** Agent 颜色映射 */
	agentColorMap?: Map<string, string>
	agentColorIndex?: number
	/** Session 权限模式 */
	sessionBypassPermissionsMode?: boolean
	/** Session 来源 */
	sessionSource?: string

	/** 其他扩展字段 */
	[key: string]: unknown
}

// ============================================================
// AsyncLocalStorage 实例
// ============================================================

/**
 * SessionContext 的 AsyncLocalStorage 实例
 *
 * 独立于 engine/ 的 SessionContextStorage，避免循环依赖。
 */
const sessionContextALS = new AsyncLocalStorage<SessionContextData>()

// ============================================================
// 核心 API
// ============================================================

/**
 * 获取当前 ALS 上下文
 *
 * @returns 当前上下文数据，如果没有 ALS 上下文则返回 undefined
 */
export function getContext(): SessionContextData | undefined {
	return sessionContextALS.getStore()
}

/**
 * 在指定的上下文中运行回调函数
 *
 * @param context 上下文数据
 * @param callback 要执行的回调函数
 * @returns 回调函数的返回值
 */
export function runWithContext<T>(
	context: SessionContextData,
	callback: () => T,
): T {
	return sessionContextALS.run(context, callback)
}

/**
 * 设置当前上下文中的字段值
 *
 * 注意：这个方法只在有 ALS 上下文时生效，否则静默失败。
 *
 * @param key 字段名
 * @param value 字段值
 */
export function setContextField<K extends keyof SessionContextData>(
	key: K,
	value: SessionContextData[K],
): void {
	const context = sessionContextALS.getStore()
	if (context) {
		context[key] = value
	}
}

/**
 * 获取当前上下文中的字段值
 *
 * @param key 字段名
 * @returns 字段值，如果没有上下文或字段不存在则返回 undefined
 */
export function getContextField<K extends keyof SessionContextData>(
	key: K,
): SessionContextData[K] | undefined {
	const context = sessionContextALS.getStore()
	return context?.[key]
}

// ============================================================
// 便捷方法 — 核心字段
// ============================================================

/** Cwd 相关 */
export function getCwd(): string | undefined {
	return getContextField('cwd')
}

export function setCwd(cwd: string): void {
	setContextField('cwd', cwd)
}

/** SessionId 相关 */
export function getSessionId(): string | undefined {
	return getContextField('sessionId')
}

export function setSessionId(sessionId: string): void {
	setContextField('sessionId', sessionId)
}

/** ProjectRoot 相关 */
export function getProjectRoot(): string | undefined {
	return getContextField('projectRoot')
}

export function setProjectRoot(projectRoot: string): void {
	setContextField('projectRoot', projectRoot)
}

/** OriginalCwd 相关 */
export function getOriginalCwd(): string | undefined {
	return getContextField('originalCwd')
}

export function setOriginalCwd(originalCwd: string): void {
	setContextField('originalCwd', originalCwd)
}

// ============================================================
// 便捷方法 — 成本/Token 字段
// ============================================================

export function getTotalCostUSD(): number | undefined {
	return getContextField('totalCostUSD')
}

export function setTotalCostUSD(cost: number): void {
	setContextField('totalCostUSD', cost)
}

export function getTotalAPIDuration(): number | undefined {
	return getContextField('totalAPIDuration')
}

export function setTotalAPIDuration(duration: number): void {
	setContextField('totalAPIDuration', duration)
}

export function getModelUsage(): Record<string, unknown> | undefined {
	return getContextField('modelUsage')
}

export function setModelUsage(usage: Record<string, unknown>): void {
	setContextField('modelUsage', usage)
}

export function getTotalAPIDurationWithoutRetries(): number | undefined {
	return getContextField('totalAPIDurationWithoutRetries')
}

export function setTotalAPIDurationWithoutRetries(duration: number): void {
	setContextField('totalAPIDurationWithoutRetries', duration)
}

export function getTotalToolDuration(): number | undefined {
	return getContextField('totalToolDuration')
}

export function setTotalToolDuration(duration: number): void {
	setContextField('totalToolDuration', duration)
}

export function getTotalLinesAdded(): number | undefined {
	return getContextField('totalLinesAdded')
}

export function setTotalLinesAdded(lines: number): void {
	setContextField('totalLinesAdded', lines)
}

export function getTotalLinesRemoved(): number | undefined {
	return getContextField('totalLinesRemoved')
}

export function setTotalLinesRemoved(lines: number): void {
	setContextField('totalLinesRemoved', lines)
}

// ============================================================
// 工具方法
// ============================================================

/**
 * 创建一个新的上下文对象
 *
 * @param initialData 初始数据
 * @returns 新的上下文对象
 */
export function createContext(
	initialData?: Partial<SessionContextData>,
): SessionContextData {
	return {
		...initialData,
	}
}

/**
 * 检查当前是否在 ALS 上下文中
 *
 * @returns 如果在上下文中返回 true，否则返回 false
 */
export function isInContext(): boolean {
	return sessionContextALS.getStore() !== undefined
}
