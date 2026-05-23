/**
 * BudgetTracker — 模型跑飞防御
 *
 * 设计原则：
 * - 接口 + 默认实现 + 可注入
 * - per-session（不全局）
 * - 默认 token budget：单会话 200k token 上限
 * - 上限触发后 emit budget_exceeded（让 AgentLoop 退出）
 *
 * 与 cc 行为差异：
 * - 不抄 cc 的 createBudgetTracker / TOKEN_BUDGET feature gate
 * - 不抄 cc 的 nudge message 自动注入（让 product 决策）
 * - 不抄 cc 的 task_budget API 字段（model 端决策）
 */

import type {UsageSnapshot} from '../types.js'

export interface BudgetDecision {
	/** 是否应该停止 loop。 */
	shouldStop: boolean
	/** 已使用 token 数。 */
	used: number
	/** 上限（undefined = 无上限）。 */
	limit?: number
	/** 超出原因（shouldStop=true 时）。 */
	reason?: 'token_budget_exceeded'
}

export interface BudgetTracker {
	recordUsage(usage: UsageSnapshot): void
	check(): BudgetDecision
	reset(): void
}

// ============================================================
// 默认 BudgetTracker
// ============================================================

export interface DefaultBudgetOptions {
	/** Token 上限（input + output 累计）。默认 200_000。设 0 = 无上限。 */
	tokenLimit?: number
}

export class DefaultBudgetTracker implements BudgetTracker {
	private readonly limit: number
	private used = 0

	constructor(options: DefaultBudgetOptions = {}) {
		this.limit = options.tokenLimit ?? 200_000
	}

	recordUsage(usage: UsageSnapshot): void {
		this.used += usage.input_tokens + usage.output_tokens
	}

	check(): BudgetDecision {
		if (this.limit <= 0) {
			return {shouldStop: false, used: this.used}
		}
		if (this.used >= this.limit) {
			return {
				shouldStop: true,
				used: this.used,
				limit: this.limit,
				reason: 'token_budget_exceeded',
			}
		}
		return {shouldStop: false, used: this.used, limit: this.limit}
	}

	reset(): void {
		this.used = 0
	}
}

/** 永不停的 budget（默认 disable 用）。 */
export class NoOpBudgetTracker implements BudgetTracker {
	recordUsage(): void {
		/* no-op */
	}
	check(): BudgetDecision {
		return {shouldStop: false, used: 0}
	}
	reset(): void {
		/* no-op */
	}
}
