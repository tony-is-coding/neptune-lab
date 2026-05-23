/**
 * CircuitBreaker 单测
 */

import {describe, expect, it} from 'bun:test'
import {CircuitBreaker} from '../CircuitBreaker.js'

describe('CircuitBreaker', () => {
	it('初始 state = closed', () => {
		const cb = new CircuitBreaker()
		expect(cb.currentState).toBe('closed')
		expect(cb.allowRequest()).toBe(true)
	})

	it('连续失败到阈值 → open', () => {
		const cb = new CircuitBreaker({failureThreshold: 3})
		cb.recordFailure()
		cb.recordFailure()
		expect(cb.currentState).toBe('closed')
		cb.recordFailure()
		expect(cb.currentState).toBe('open')
		expect(cb.allowRequest()).toBe(false)
	})

	it('成功 → closed + 失败计数清零', () => {
		const cb = new CircuitBreaker({failureThreshold: 3})
		cb.recordFailure()
		cb.recordFailure()
		cb.recordSuccess()
		expect(cb.failureCount).toBe(0)
		expect(cb.currentState).toBe('closed')
	})

	it('open 状态过 resetTimeoutMs → half_open', async () => {
		const cb = new CircuitBreaker({failureThreshold: 1, resetTimeoutMs: 30})
		cb.recordFailure()
		expect(cb.currentState).toBe('open')
		await new Promise(r => setTimeout(r, 50))
		expect(cb.currentState).toBe('half_open')
		expect(cb.allowRequest()).toBe(true)
	})

	it('half_open 成功 → closed', async () => {
		const cb = new CircuitBreaker({failureThreshold: 1, resetTimeoutMs: 30})
		cb.recordFailure()
		await new Promise(r => setTimeout(r, 50))
		expect(cb.currentState).toBe('half_open')
		cb.recordSuccess()
		expect(cb.currentState).toBe('closed')
	})

	it('half_open 失败 → open（重新计时）', async () => {
		const cb = new CircuitBreaker({failureThreshold: 1, resetTimeoutMs: 30})
		cb.recordFailure()
		await new Promise(r => setTimeout(r, 50))
		expect(cb.currentState).toBe('half_open')
		cb.recordFailure()
		expect(cb.currentState).toBe('open')
	})

	it('onStateChange listener', () => {
		const cb = new CircuitBreaker({failureThreshold: 1})
		const events: Array<{oldState: string; newState: string}> = []
		cb.onStateChange(info => events.push(info))
		cb.recordFailure()
		expect(events.some(e => e.newState === 'open')).toBe(true)
	})

	it('reset 清零 + state = closed', () => {
		const cb = new CircuitBreaker({failureThreshold: 1})
		cb.recordFailure()
		expect(cb.currentState).toBe('open')
		cb.reset()
		expect(cb.currentState).toBe('closed')
		expect(cb.failureCount).toBe(0)
	})
})
