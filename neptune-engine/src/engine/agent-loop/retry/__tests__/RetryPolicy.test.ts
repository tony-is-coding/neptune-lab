/**
 * RetryPolicy 单测
 */

import {describe, expect, it} from 'bun:test'
import {DefaultRetryPolicy} from '../RetryPolicy.js'

function withStatus(message: string, status?: number, headers?: Record<string, string>): Error {
	const e = new Error(message) as Error & {
		status?: number
		headers?: Record<string, string>
	}
	if (status !== undefined) e.status = status
	if (headers) e.headers = headers
	return e
}

describe('DefaultRetryPolicy', () => {
	it('429 第一次 → retry', () => {
		const p = new DefaultRetryPolicy({jitter: false})
		const d = p.decide(withStatus('429', 429), {attempt: 0, elapsedMs: 0})
		expect(d.retry).toBe(true)
		expect(d.waitMs).toBe(500)
	})

	it('指数退避：第 0/1/2/3 次 = 500/1000/2000/4000', () => {
		const p = new DefaultRetryPolicy({jitter: false})
		const errArg = withStatus('boom', 500)
		expect(p.decide(errArg, {attempt: 0, elapsedMs: 0}).waitMs).toBe(500)
		expect(p.decide(errArg, {attempt: 1, elapsedMs: 0}).waitMs).toBe(1000)
		expect(p.decide(errArg, {attempt: 2, elapsedMs: 0}).waitMs).toBe(2000)
		expect(p.decide(errArg, {attempt: 3, elapsedMs: 0}).waitMs).toBe(4000)
	})

	it('达到 maxRetries → 不重试，reason: exhausted', () => {
		const p = new DefaultRetryPolicy({maxRetries: 2, jitter: false})
		const d = p.decide(withStatus('500', 500), {attempt: 2, elapsedMs: 0})
		expect(d.retry).toBe(false)
		expect(d.reason).toBe('exhausted')
	})

	it('non_retryable_auth → 立即放弃', () => {
		const p = new DefaultRetryPolicy()
		const d = p.decide(withStatus('forbidden', 403), {attempt: 0, elapsedMs: 0})
		expect(d.retry).toBe(false)
		expect(d.reason).toBe('non_retryable')
	})

	it('non_retryable_client → 立即放弃', () => {
		const p = new DefaultRetryPolicy()
		const d = p.decide(withStatus('bad', 400), {attempt: 0, elapsedMs: 0})
		expect(d.retry).toBe(false)
		expect(d.reason).toBe('non_retryable')
	})

	it('429 + retry-after → 优先用 server 提示', () => {
		const p = new DefaultRetryPolicy({jitter: false})
		const d = p.decide(withStatus('rl', 429, {'retry-after': '10'}), {
			attempt: 0,
			elapsedMs: 0,
		})
		expect(d.waitMs).toBe(10_000)
	})

	it('总预算超出 → reason: budget_exceeded', () => {
		const p = new DefaultRetryPolicy({totalBudgetMs: 1000, jitter: false})
		const d = p.decide(withStatus('boom', 500), {attempt: 1, elapsedMs: 950})
		expect(d.retry).toBe(false)
		expect(d.reason).toBe('budget_exceeded')
	})

	it('jitter: 在 base 的 0.8-1.2 范围内', () => {
		const p = new DefaultRetryPolicy({jitter: true, baseDelayMs: 1000})
		const samples = Array.from({length: 50}, () =>
			p.decide(withStatus('500', 500), {attempt: 0, elapsedMs: 0}).waitMs,
		)
		const min = Math.min(...samples)
		const max = Math.max(...samples)
		expect(min).toBeGreaterThanOrEqual(800)
		expect(max).toBeLessThanOrEqual(1200)
	})

	it('单次延迟上限 maxDelayMs', () => {
		const p = new DefaultRetryPolicy({maxRetries: 20, maxDelayMs: 5000, jitter: false})
		const d = p.decide(withStatus('500', 500), {attempt: 10, elapsedMs: 0})
		// 2^10 * 500 = 512000 > 5000 → cap to 5000
		expect(d.waitMs).toBe(5000)
	})
})
