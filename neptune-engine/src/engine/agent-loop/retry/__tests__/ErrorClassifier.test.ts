/**
 * ErrorClassifier 单测 — 决策矩阵覆盖
 */

import {describe, expect, it} from 'bun:test'
import {classifyError, isRetryable} from '../ErrorClassifier.js'

function err(message: string, status?: number, headers?: Record<string, string>): Error {
	const e = new Error(message) as Error & {
		status?: number
		headers?: Record<string, string>
	}
	if (status !== undefined) e.status = status
	if (headers) e.headers = headers
	return e
}

describe('classifyError — 决策矩阵', () => {
	it('429 → retryable_rate_limited', () => {
		expect(classifyError(err('rate limit', 429)).cls).toBe('retryable_rate_limited')
	})
	it('429 + retry-after header → retryAfterSeconds 解析', () => {
		const c = classifyError(err('rl', 429, {'retry-after': '5'}))
		expect(c.cls).toBe('retryable_rate_limited')
		expect(c.retryAfterSeconds).toBe(5)
	})
	it('529 (overloaded) → retryable_rate_limited', () => {
		expect(classifyError(err('overloaded', 529)).cls).toBe('retryable_rate_limited')
	})
	it('overloaded message 无 status → retryable_rate_limited', () => {
		expect(classifyError(err('Anthropic returned overloaded_error')).cls).toBe(
			'retryable_rate_limited',
		)
	})
	it('502 → retryable_transient', () => {
		expect(classifyError(err('bad gateway', 502)).cls).toBe('retryable_transient')
	})
	it('503 → retryable_transient', () => {
		expect(classifyError(err('unavailable', 503)).cls).toBe('retryable_transient')
	})
	it('504 → retryable_transient', () => {
		expect(classifyError(err('timeout', 504)).cls).toBe('retryable_transient')
	})
	it('401 → non_retryable_auth', () => {
		expect(classifyError(err('unauthorized', 401)).cls).toBe('non_retryable_auth')
	})
	it('403 → non_retryable_auth', () => {
		expect(classifyError(err('forbidden', 403)).cls).toBe('non_retryable_auth')
	})
	it('400 → non_retryable_client', () => {
		expect(classifyError(err('bad', 400)).cls).toBe('non_retryable_client')
	})
	it('422 → non_retryable_client', () => {
		expect(classifyError(err('val', 422)).cls).toBe('non_retryable_client')
	})
	it('404 + model not found → non_retryable_model_not_found', () => {
		expect(classifyError(err('model not found', 404)).cls).toBe(
			'non_retryable_model_not_found',
		)
	})
	it('404 其他 → non_retryable_client', () => {
		expect(classifyError(err('endpoint nope', 404)).cls).toBe('non_retryable_client')
	})
	it('ECONNRESET → retryable_transient', () => {
		expect(classifyError(new Error('ECONNRESET')).cls).toBe('retryable_transient')
	})
	it('ENOTFOUND → retryable_transient', () => {
		expect(classifyError(new Error('ENOTFOUND api.anthropic.com')).cls).toBe(
			'retryable_transient',
		)
	})
	it('fetch failed → retryable_transient', () => {
		expect(classifyError(new Error('fetch failed')).cls).toBe('retryable_transient')
	})
	it('AbortError name → non_retryable_client', () => {
		const e = new Error('aborted')
		e.name = 'AbortError'
		expect(classifyError(e).cls).toBe('non_retryable_client')
	})
	it('未知错误 → unknown', () => {
		expect(classifyError(new Error('mystery')).cls).toBe('unknown')
	})
	it('isRetryable: rate_limited / transient = true', () => {
		expect(isRetryable('retryable_rate_limited')).toBe(true)
		expect(isRetryable('retryable_transient')).toBe(true)
	})
	it('isRetryable: 其他 = false', () => {
		expect(isRetryable('non_retryable_auth')).toBe(false)
		expect(isRetryable('non_retryable_client')).toBe(false)
		expect(isRetryable('non_retryable_model_not_found')).toBe(false)
		expect(isRetryable('unknown')).toBe(false)
	})
})
