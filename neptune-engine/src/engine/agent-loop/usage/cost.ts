/**
 * cost.ts — 简单的 model 价格表 + cost 计算
 *
 * 价格按 Anthropic 官方 USD/百万 token 定价。
 * 不抄 cc 的 calculateUSDCost 大表（cc 含历史价格、企业定制价等业务关注点），
 * 只覆盖 substrate 默认场景；product 可注入更精细的 PriceTable。
 *
 * 单位：USD per 1M tokens。
 */

import type {UsageSnapshot} from '../types.js'

export interface ModelPrices {
	/** 普通 input token 价格（USD/M）。 */
	input: number
	/** 输出 token 价格（USD/M）。 */
	output: number
	/** 写入 cache 价格（USD/M）— 通常是 input × 1.25。 */
	cacheWrite: number
	/** 命中 cache 价格（USD/M）— 通常是 input × 0.1。 */
	cacheRead: number
}

export interface PriceTable {
	prices: Record<string, ModelPrices>
	/** 找不到 model 时的兜底（默认无价 = 0）。 */
	fallback?: ModelPrices
}

/**
 * 默认价格表（截至 2025-12，参考 Anthropic 官方）。
 *
 * 不保证最新；product 应注入自己的 PriceTable。
 */
export const DEFAULT_PRICES: PriceTable = {
	prices: {
		'claude-opus-4-20250514': {input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5},
		'claude-opus-4-1-20250805': {input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5},
		'claude-opus-4-7': {input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5},
		'claude-sonnet-4-20250514': {input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3},
		'claude-sonnet-4-5': {input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3},
		'claude-3-7-sonnet-20250219': {input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3},
		'claude-3-5-sonnet-20241022': {input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3},
		'claude-3-5-haiku-20241022': {input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08},
	},
}

/**
 * 计算 usage 对应的 USD cost。
 *
 * 找不到 model 时用 fallback；fallback 也没设时返回 0。
 */
export function calculateCost(
	usage: UsageSnapshot,
	model: string,
	priceTable: PriceTable = DEFAULT_PRICES,
): number {
	const prices = priceTable.prices[model] ?? priceTable.fallback
	if (!prices) return 0
	const M = 1_000_000
	return (
		(usage.input_tokens * prices.input) / M +
		(usage.output_tokens * prices.output) / M +
		(usage.cache_creation_input_tokens * prices.cacheWrite) / M +
		(usage.cache_read_input_tokens * prices.cacheRead) / M
	)
}
