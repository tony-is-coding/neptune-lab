/**
 * UsageTracker 单测
 */

import {describe, expect, it} from 'bun:test'
import {UsageTracker} from '../UsageTracker.js'
import {calculateCost, DEFAULT_PRICES} from '../cost.js'
import type {UsageSnapshot} from '../../types.js'

const u = (overrides: Partial<UsageSnapshot>): UsageSnapshot => ({
	input_tokens: 0,
	output_tokens: 0,
	cache_creation_input_tokens: 0,
	cache_read_input_tokens: 0,
	...overrides,
})

describe('UsageTracker', () => {
	it('初始 snapshot 为空', () => {
		const t = new UsageTracker()
		expect(t.snapshot()).toEqual({
			usage: u({}),
			costUSD: 0,
			turns: 0,
		})
	})

	it('累加多个 turn 的 usage', () => {
		const t = new UsageTracker()
		t.recordTurn(1, 'claude-sonnet-4-20250514', u({input_tokens: 100, output_tokens: 50}))
		t.recordTurn(2, 'claude-sonnet-4-20250514', u({input_tokens: 200, output_tokens: 30}))

		const snap = t.snapshot()
		expect(snap.usage.input_tokens).toBe(300)
		expect(snap.usage.output_tokens).toBe(80)
		expect(snap.turns).toBe(2)
	})

	it('cost 计算：sonnet-4 input 3 USD/M + output 15 USD/M', () => {
		const t = new UsageTracker()
		t.recordTurn(1, 'claude-sonnet-4-20250514', u({input_tokens: 1_000_000, output_tokens: 1_000_000}))
		expect(t.snapshot().costUSD).toBe(18) // 3 + 15
	})

	it('cache_read 显著便宜（10× 折扣）', () => {
		const t = new UsageTracker()
		t.recordTurn(
			1,
			'claude-sonnet-4-20250514',
			u({cache_read_input_tokens: 1_000_000}),
		)
		// cacheRead = input × 0.1 = 0.3 USD/M
		expect(t.snapshot().costUSD).toBeCloseTo(0.3, 4)
	})

	it('未知 model + 无 fallback → cost = 0', () => {
		const t = new UsageTracker()
		t.recordTurn(1, 'unknown-model', u({input_tokens: 1_000_000}))
		expect(t.snapshot().costUSD).toBe(0)
	})

	it('注入 fallback 价格', () => {
		const t = new UsageTracker({
			priceTable: {
				prices: {},
				fallback: {input: 1, output: 2, cacheWrite: 1, cacheRead: 1},
			},
		})
		t.recordTurn(1, 'unknown-model', u({input_tokens: 1_000_000, output_tokens: 1_000_000}))
		expect(t.snapshot().costUSD).toBe(3)
	})

	it('history 记录每个 turn', () => {
		const t = new UsageTracker()
		t.recordTurn(1, 'm', u({input_tokens: 10}))
		t.recordTurn(2, 'm', u({input_tokens: 20}))
		const h = t.history()
		expect(h).toHaveLength(2)
		expect(h[0]?.turn).toBe(1)
		expect(h[1]?.usage.input_tokens).toBe(20)
	})

	it('reset 清零', () => {
		const t = new UsageTracker()
		t.recordTurn(1, 'claude-sonnet-4-20250514', u({input_tokens: 100, output_tokens: 100}))
		t.reset()
		expect(t.snapshot()).toEqual({usage: u({}), costUSD: 0, turns: 0})
		expect(t.history()).toHaveLength(0)
	})
})

describe('calculateCost', () => {
	it('opus-4: input 15 / output 75', () => {
		const cost = calculateCost(
			u({input_tokens: 1_000_000, output_tokens: 1_000_000}),
			'claude-opus-4-20250514',
			DEFAULT_PRICES,
		)
		expect(cost).toBe(90)
	})

	it('haiku 最便宜：input 0.8 / output 4', () => {
		const cost = calculateCost(
			u({input_tokens: 1_000_000, output_tokens: 1_000_000}),
			'claude-3-5-haiku-20241022',
			DEFAULT_PRICES,
		)
		expect(cost).toBeCloseTo(4.8, 4)
	})

	it('cache_creation 比 input 贵 25%', () => {
		const cost = calculateCost(
			u({cache_creation_input_tokens: 1_000_000}),
			'claude-sonnet-4-20250514',
			DEFAULT_PRICES,
		)
		expect(cost).toBe(3.75) // 3 × 1.25
	})
})
