/**
 * BudgetTracker 单测
 */

import {describe, expect, it} from 'bun:test'
import {DefaultBudgetTracker, NoOpBudgetTracker} from '../BudgetTracker.js'
import type {UsageSnapshot} from '../../types.js'

const u = (input: number, output: number = 0): UsageSnapshot => ({
	input_tokens: input,
	output_tokens: output,
	cache_creation_input_tokens: 0,
	cache_read_input_tokens: 0,
})

describe('DefaultBudgetTracker', () => {
	it('初始 used = 0', () => {
		const t = new DefaultBudgetTracker()
		expect(t.check().used).toBe(0)
		expect(t.check().shouldStop).toBe(false)
	})

	it('record + check 累加', () => {
		const t = new DefaultBudgetTracker({tokenLimit: 1000})
		t.recordUsage(u(100, 50))
		t.recordUsage(u(200, 100))
		const d = t.check()
		expect(d.used).toBe(450)
		expect(d.limit).toBe(1000)
		expect(d.shouldStop).toBe(false)
	})

	it('达到上限 → shouldStop: true + reason', () => {
		const t = new DefaultBudgetTracker({tokenLimit: 100})
		t.recordUsage(u(60, 50))
		const d = t.check()
		expect(d.shouldStop).toBe(true)
		expect(d.reason).toBe('token_budget_exceeded')
	})

	it('tokenLimit=0 → 永不停', () => {
		const t = new DefaultBudgetTracker({tokenLimit: 0})
		t.recordUsage(u(999_999, 999_999))
		expect(t.check().shouldStop).toBe(false)
	})

	it('reset 清零', () => {
		const t = new DefaultBudgetTracker({tokenLimit: 100})
		t.recordUsage(u(80))
		t.reset()
		expect(t.check().used).toBe(0)
		expect(t.check().shouldStop).toBe(false)
	})

	it('默认 limit = 200_000', () => {
		const t = new DefaultBudgetTracker()
		t.recordUsage(u(199_000))
		expect(t.check().shouldStop).toBe(false)
		t.recordUsage(u(2_000))
		expect(t.check().shouldStop).toBe(true)
	})
})

describe('NoOpBudgetTracker', () => {
	it('永不 stop', () => {
		const t = new NoOpBudgetTracker()
		t.recordUsage(u(999_999_999))
		expect(t.check().shouldStop).toBe(false)
	})
})
