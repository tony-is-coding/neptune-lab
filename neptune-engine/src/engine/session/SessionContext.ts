/**
 * SessionContext — Per-Session 状态上下文
 *
 * 定义 SessionContext 接口和默认值工厂。
 * AsyncLocalStorage 管理逻辑移至 SessionContextStorage.ts。
 * TokenBudget 管理逻辑移至 TokenBudgetManager.ts。
 *
 * === 字段分组说明 ===
 * 1. [ENGINE] engine/ 实际使用的字段
 * 2. [CC_COMPAT] CC 原始代码通过 SessionContextStorage 访问的字段（兼容性保留）
 * 3. [CC_INTERNAL] CC 原始代码内部使用的字段（暂未迁移到 engine/）
 */

import type {SessionId} from '../types/ids.js'

// Inlined from @neptune/engine-product — pure type definitions, no runtime deps
/** Model name or alias string, or null for default */
export type ModelSetting = string | null
/** Map of model key to provider-specific model ID string */
export type ModelStrings = Record<string, string>
/** Per-model token usage record */
export type ModelUsage = {
	inputTokens: number
	outputTokens: number
	cacheReadInputTokens?: number
	cacheCreationInputTokens?: number
	[key: string]: unknown
}
import type {AgentColorName} from '@neptune/builtin-tools/tools/AgentTool/agentColorManager.js'
import type {TokenBudgetState} from './TokenBudgetManager.js'
import type {SessionContextSnapshot} from '../types.js'
import {SERIALIZATION_PROTOCOL_VERSION} from '../types.js'
import {asSessionId} from '../types/ids.js'

/** SessionCronTask — Session 级 cron 任务 */
export interface SessionCronTask {
	id: string
	cron: string
	prompt: string
	durable: false
}

/**
 * SessionContext — Per-Session 状态
 *
 * 字段分组：
 * - [ENGINE] engine/ 实际使用的字段
 * - [CC_COMPAT] CC 通过 SessionContextStorage 访问的字段
 * - [CC_INTERNAL] CC 内部使用的字段
 */
export interface SessionContext {
	// ============================================================
	// [ENGINE] engine/ 实际使用的字段
	// ============================================================

	/** 会话 ID */
	sessionId: SessionId

	/** 当前工作目录 */
	cwd: string

	/** 项目根目录 */
	projectRoot: string

	/** 用户记忆路径（可选） */
	memoryPath?: string

	// ============================================================
	// [CC_COMPAT] CC 原始代码通过 SessionContextStorage 访问的字段
	// ============================================================

	/** 父会话 ID */
	parentSessionId?: SessionId

	/** 原始工作目录 */
	originalCwd: string

	/** 模型使用记录 */
	modelUsage: Record<string, ModelUsage>

	/** 主循环模型覆盖 */
	mainLoopModelOverride?: ModelSetting

	/** 初始主循环模型 */
	initialMainLoopModel: ModelSetting

	/** 模型字符串 */
	modelStrings?: ModelStrings

	// ============================================================
	// [CC_INTERNAL] CC 原始代码内部使用的字段
	// ============================================================

	/** 总成本（美元） */
	totalCostUSD: number

	/** API 总耗时 */
	totalAPIDuration: number

	/** API 总耗时（不含重试） */
	totalAPIDurationWithoutRetries: number

	/** 工具总耗时 */
	totalToolDuration: number

	/** Hook 耗时（当前轮） */
	turnHookDurationMs: number

	/** 工具耗时（当前轮） */
	turnToolDurationMs: number

	/** 分类器耗时（当前轮） */
	turnClassifierDurationMs: number

	/** 工具计数（当前轮） */
	turnToolCount: number

	/** Hook 计数（当前轮） */
	turnHookCount: number

	/** 分类器计数（当前轮） */
	turnClassifierCount: number

	/** 会话开始时间 */
	startTime: number

	/** 最后交互时间 */
	lastInteractionTime: number

	/** 总添加行数 */
	totalLinesAdded: number

	/** 总删除行数 */
	totalLinesRemoved: number

	/** 是否为交互式会话 */
	isInteractive: boolean

	/** 是否为远程模式 */
	isRemoteMode: boolean

	/** 会话来源 */
	sessionSource?: string

	/** 是否绕过权限模式 */
	sessionBypassPermissionsMode: boolean

	/** 是否启用定时任务 */
	scheduledTasksEnabled: boolean

	/** 会话级定时任务 */
	sessionCronTasks: SessionCronTask[]

	/** 会话创建的团队 */
	sessionCreatedTeams: Set<string>

	/** 是否禁用会话持久化 */
	sessionPersistenceDisabled: boolean

	/** Agent 颜色映射 */
	agentColorMap: Map<string, AgentColorName>

	/** Agent 颜色索引 */
	agentColorIndex: number

	/** 是否有未知模型成本 */
	hasUnknownModelCost: boolean

	/** 是否严格工具结果配对 */
	strictToolResultPairing: boolean

	/** 用户消息选择加入 */
	userMsgOptIn: boolean

	/** Kairos 是否激活 */
	kairosActive: boolean
}

/**
 * 创建默认 SessionContext
 *
 * @param sessionId 会话 ID
 * @param cwd 工作目录
 * @param projectRoot 项目根目录
 * @returns 默认 SessionContext 实例
 */
export function createDefaultSessionContext(
	sessionId: SessionId,
	cwd: string,
	projectRoot: string,
): SessionContext {
	return {
		// [ENGINE] engine/ 实际使用的字段
		sessionId,
		cwd,
		projectRoot,
		memoryPath: undefined,

		// [CC_COMPAT] CC 通过 SessionContextStorage 访问的字段
		parentSessionId: undefined,
		originalCwd: cwd,
		modelUsage: {},
		mainLoopModelOverride: undefined,
		initialMainLoopModel: null,
		modelStrings: undefined,

		// [CC_INTERNAL] CC 内部使用的字段
		totalCostUSD: 0,
		totalAPIDuration: 0,
		totalAPIDurationWithoutRetries: 0,
		totalToolDuration: 0,
		turnHookDurationMs: 0,
		turnToolDurationMs: 0,
		turnClassifierDurationMs: 0,
		turnToolCount: 0,
		turnHookCount: 0,
		turnClassifierCount: 0,
		startTime: Date.now(),
		lastInteractionTime: Date.now(),
		totalLinesAdded: 0,
		totalLinesRemoved: 0,
		isInteractive: true,
		isRemoteMode: false,
		sessionSource: undefined,
		sessionBypassPermissionsMode: false,
		scheduledTasksEnabled: false,
		sessionCronTasks: [],
		sessionCreatedTeams: new Set(),
		sessionPersistenceDisabled: false,
		agentColorMap: new Map(),
		agentColorIndex: 0,
		hasUnknownModelCost: false,
		strictToolResultPairing: false,
		userMsgOptIn: false,
		kairosActive: false,
	}
}

export type {TokenBudgetState}

// ============================================================
// Re-export from split modules for backward compatibility
// ============================================================

// External files import directly from 'session/SessionContext.js'
export {
	getSessionContext,
	getSessionId,
	getCwd,
	getOriginalCwd,
	getProjectRoot,
	getIsRemoteMode,
	getIsNonInteractiveSession,
	getIsInteractive,
	getMemoryPath,
	isSessionPersistenceDisabled,
	runInSessionContext,
	runInSessionContextAsync,
	updateSessionContext,
	getCurrentSessionId,
	getCurrentCwd,
} from './SessionContextStorage.js'

export {
	getTokenBudgetState,
	initTokenBudgetState,
	getTurnOutputTokens,
	getCurrentTurnTokenBudget,
	snapshotOutputTokensForTurn,
	incrementBudgetContinuationCount,
	getBudgetContinuationCount,
	clearTokenBudgetState,
	tokenBudgetStates,
} from './TokenBudgetManager.js'

// ============================================================
// 序列化协议（T15 分布式基础）
// ============================================================

/**
 * 将 SessionContext 序列化为可跨进程传输的快照
 *
 * 只提取 [ENGINE] 分组的核心字段，CC 内部字段不纳入序列化。
 */
export function sessionContextToSnapshot(ctx: SessionContext): SessionContextSnapshot {
	return {
		version: SERIALIZATION_PROTOCOL_VERSION,
		sessionId: ctx.sessionId,
		cwd: ctx.cwd,
		projectRoot: ctx.projectRoot,
		memoryPath: ctx.memoryPath,
		originalCwd: ctx.originalCwd,
		totalCostUSD: ctx.totalCostUSD,
		totalAPIDuration: ctx.totalAPIDuration,
		totalAPIDurationWithoutRetries: ctx.totalAPIDurationWithoutRetries,
		totalToolDuration: ctx.totalToolDuration,
		totalLinesAdded: ctx.totalLinesAdded,
		totalLinesRemoved: ctx.totalLinesRemoved,
		modelUsage: ctx.modelUsage as Record<string, unknown> | undefined,
	}
}

/**
 * 从快照恢复 SessionContext 核心字段
 *
 * CC 内部字段使用默认值初始化，由 CC 原始代码在运行时填充。
 */
export function restoreSessionContextFromSnapshot(snapshot: SessionContextSnapshot): SessionContext {
	const ctx = createDefaultSessionContext(asSessionId(snapshot.sessionId), snapshot.cwd, snapshot.projectRoot)
	return {
		...ctx,
		memoryPath: snapshot.memoryPath,
		originalCwd: snapshot.originalCwd ?? ctx.originalCwd,
		totalCostUSD: snapshot.totalCostUSD ?? ctx.totalCostUSD,
		totalAPIDuration: snapshot.totalAPIDuration ?? ctx.totalAPIDuration,
		totalAPIDurationWithoutRetries: snapshot.totalAPIDurationWithoutRetries ?? ctx.totalAPIDurationWithoutRetries,
		totalToolDuration: snapshot.totalToolDuration ?? ctx.totalToolDuration,
		totalLinesAdded: snapshot.totalLinesAdded ?? ctx.totalLinesAdded,
		totalLinesRemoved: snapshot.totalLinesRemoved ?? ctx.totalLinesRemoved,
		modelUsage: (snapshot.modelUsage as Record<string, ModelUsage>) ?? ctx.modelUsage,
	}
}
