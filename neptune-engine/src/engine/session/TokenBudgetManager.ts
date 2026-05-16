/**
 * TokenBudgetManager — Per-Session Token 预算管理
 *
 * 管理每个 session 的 token 预算状态。
 * 从 SessionContext.ts 拆分出来，职责单一。
 *
 * v2: 将全局状态改为实例属性，支持多 AgentEngine 实例隔离
 */

import type {SessionId} from '../types/ids.js'
import type {SessionContext} from './SessionContext.js'
import {getSessionContext} from './SessionContextStorage.js'

// ============================================================
// 类型定义
// ============================================================

/** TokenBudgetState — Per-Session token 预算状态 */
export interface TokenBudgetState {
	outputTokensAtTurnStart: number
	currentTurnTokenBudget: number | null
	budgetContinuationCount: number
}

// ============================================================
// Token Budget Manager 类
// ============================================================

/**
 * TokenBudgetManager — Per-Session token 预算管理器
 *
 * 每个 AgentEngine 实例应该拥有自己的 TokenBudgetManager 实例，
 * 避免全局状态导致的跨实例污染。
 */
export class TokenBudgetManager {
	private readonly states = new Map<SessionId, TokenBudgetState>()

	/** 初始化 TokenBudgetState */
	initTokenBudgetState(sessionId: SessionId): void {
		this.states.set(sessionId, {
			outputTokensAtTurnStart: 0,
			currentTurnTokenBudget: null,
			budgetContinuationCount: 0,
		})
	}

	/** 获取 TokenBudgetState */
	getTokenBudgetState(sessionId: SessionId): TokenBudgetState | undefined {
		return this.states.get(sessionId)
	}

	/** 获取当前 turn 输出 tokens */
	getTurnOutputTokens(sessionId: SessionId, ctx: SessionContext): number {
		const budget = this.getTokenBudgetState(sessionId)
		if (!budget) return 0
		// 需要从 modelUsage 计算 totalOutputTokens
		const totalOutputTokens = Object.values(ctx.modelUsage).reduce(
			(sum, usage) => sum + (usage.outputTokens || 0),
			0,
		)
		return totalOutputTokens - budget.outputTokensAtTurnStart
	}

	/** 获取当前 turn token 预算 */
	getCurrentTurnTokenBudget(sessionId: SessionId): number | null {
		return this.getTokenBudgetState(sessionId)?.currentTurnTokenBudget ?? null
	}

	/** 快照 turn 开始时的输出 tokens */
	snapshotOutputTokensForTurn(sessionId: SessionId, ctx: SessionContext, budget: number | null): void {
		const tokenBudget = this.states.get(sessionId)
		if (!tokenBudget) return

		const totalOutputTokens = Object.values(ctx.modelUsage).reduce(
			(sum, usage) => sum + (usage.outputTokens || 0),
			0,
		)
		tokenBudget.outputTokensAtTurnStart = totalOutputTokens
		tokenBudget.currentTurnTokenBudget = budget
	}

	/** 增加 budget continuation 计数 */
	incrementBudgetContinuationCount(sessionId: SessionId): void {
		const tokenBudget = this.states.get(sessionId)
		if (tokenBudget) {
			tokenBudget.budgetContinuationCount++
		}
	}

	/** 获取 budget continuation 计数 */
	getBudgetContinuationCount(sessionId: SessionId): number {
		return this.states.get(sessionId)?.budgetContinuationCount ?? 0
	}

	/** 清理 TokenBudgetState（用于 session 销毁） */
	clearTokenBudgetState(sessionId: SessionId): void {
		this.states.delete(sessionId)
	}

	/** 清理所有状态 */
	dispose(): void {
		this.states.clear()
	}
}

// ============================================================
// 向后兼容的全局单例（保留以避免破坏现有代码）
// ============================================================

/** 全局 TokenBudgetState 存储（已废弃，建议使用 TokenBudgetManager 实例） */
export const tokenBudgetStates = new Map<SessionId, TokenBudgetState>()

/** 初始化 TokenBudgetState（全局版本，已废弃） */
export function initTokenBudgetState(sessionId: SessionId): void {
	tokenBudgetStates.set(sessionId, {
		outputTokensAtTurnStart: 0,
		currentTurnTokenBudget: null,
		budgetContinuationCount: 0,
	})
}

/** 获取 TokenBudgetState（全局版本，已废弃） */
export function getTokenBudgetState(): TokenBudgetState | undefined {
	const sessionId = getSessionContext()?.sessionId
	if (!sessionId) return undefined
	return tokenBudgetStates.get(sessionId)
}

/** 获取当前 turn 输出 tokens（全局版本，已废弃） */
export function getTurnOutputTokens(): number {
	const ctx = getSessionContext()
	const budget = getTokenBudgetState()
	if (!ctx || !budget) return 0
	// 需要从 modelUsage 计算 totalOutputTokens
	const totalOutputTokens = Object.values(ctx.modelUsage).reduce(
		(sum, usage) => sum + (usage.outputTokens || 0),
		0,
	)
	return totalOutputTokens - budget.outputTokensAtTurnStart
}

/** 获取当前 turn token 预算（全局版本，已废弃） */
export function getCurrentTurnTokenBudget(): number | null {
	return getTokenBudgetState()?.currentTurnTokenBudget ?? null
}

/** 快照 turn 开始时的输出 tokens（全局版本，已废弃） */
export function snapshotOutputTokensForTurn(budget: number | null): void {
	const ctx = getSessionContext()
	const tokenBudget = getTokenBudgetState()
	if (!ctx || !tokenBudget) return

	const totalOutputTokens = Object.values(ctx.modelUsage).reduce(
		(sum, usage) => sum + (usage.outputTokens || 0),
		0,
	)
	tokenBudget.outputTokensAtTurnStart = totalOutputTokens
	tokenBudget.currentTurnTokenBudget = budget
}

/** 增加 budget continuation 计数（全局版本，已废弃） */
export function incrementBudgetContinuationCount(): void {
	const tokenBudget = getTokenBudgetState()
	if (tokenBudget) {
		tokenBudget.budgetContinuationCount++
	}
}

/** 获取 budget continuation 计数（全局版本，已废弃） */
export function getBudgetContinuationCount(): number {
	return getTokenBudgetState()?.budgetContinuationCount ?? 0
}

/** 清理 TokenBudgetState（全局版本，已废弃） */
export function clearTokenBudgetState(sessionId: SessionId): void {
	tokenBudgetStates.delete(sessionId)
}
