/**
 * UsageTracker — per-session 累计 token usage + cost
 *
 * 设计原则：
 * - per-session（每个 AgentLoop.run 创建独立实例，不共享全局）
 * - 4 档 token 字段（input / output / cache_write / cache_read）
 * - cost 用注入的 PriceTable 计算（默认表覆盖主流 Claude 模型）
 *
 * 与 cc 行为差异：
 * - 不抄 server_tool_use（advisor 业务）
 * - 不抄 calculateUSDCost 的全表（用最小默认表 + 可注入）
 * - 不抄 addToTotalSessionCost 全局累加（per-session 隔离）
 */

import type {UsageSnapshot} from '../types.js'
import {EMPTY_USAGE} from '../types.js'
import {calculateCost, DEFAULT_PRICES, type PriceTable} from './cost.js'

export interface UsageTrackerOptions {
	/** 自定义价格表；默认用 DEFAULT_PRICES。 */
	priceTable?: PriceTable
}

/**
 * 单次 turn 的 usage 快照（含 model + cost）。
 */
export interface TurnUsageRecord {
	turn: number
	model: string
	usage: UsageSnapshot
	costUSD: number
}

export class UsageTracker {
	private cumulative: UsageSnapshot = {...EMPTY_USAGE}
	private cumulativeCost = 0
	private readonly turnHistory: TurnUsageRecord[] = []
	private readonly priceTable: PriceTable

	constructor(options: UsageTrackerOptions = {}) {
		this.priceTable = options.priceTable ?? DEFAULT_PRICES
	}

	/**
	 * 记录一次 turn 的 usage（来自 AgentLoop 每轮 message_delta + message_start）。
	 *
	 * @param turn turn 序号（从 1 开始）
	 * @param model 这轮用的 model id
	 * @param usage 这轮的 usage delta
	 */
	recordTurn(turn: number, model: string, usage: UsageSnapshot): TurnUsageRecord {
		const costUSD = calculateCost(usage, model, this.priceTable)
		const record: TurnUsageRecord = {turn, model, usage: {...usage}, costUSD}
		this.turnHistory.push(record)

		this.cumulative = {
			input_tokens: this.cumulative.input_tokens + usage.input_tokens,
			output_tokens: this.cumulative.output_tokens + usage.output_tokens,
			cache_creation_input_tokens:
				this.cumulative.cache_creation_input_tokens + usage.cache_creation_input_tokens,
			cache_read_input_tokens:
				this.cumulative.cache_read_input_tokens + usage.cache_read_input_tokens,
		}
		this.cumulativeCost += costUSD

		return record
	}

	/** 当前累计 usage 快照（不可变）。 */
	snapshot(): {usage: UsageSnapshot; costUSD: number; turns: number} {
		return {
			usage: {...this.cumulative},
			costUSD: this.cumulativeCost,
			turns: this.turnHistory.length,
		}
	}

	/** 历史 turn 记录（不可变拷贝）。 */
	history(): readonly TurnUsageRecord[] {
		return [...this.turnHistory]
	}

	/** 清零（用于 test 或 session 重置）。 */
	reset(): void {
		this.cumulative = {...EMPTY_USAGE}
		this.cumulativeCost = 0
		this.turnHistory.length = 0
	}
}
