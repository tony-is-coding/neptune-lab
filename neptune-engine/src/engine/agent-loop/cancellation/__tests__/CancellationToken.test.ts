/**
 * CancellationToken 单测
 */

import {describe, expect, it} from 'bun:test'
import {CancellationToken} from '../CancellationToken.js'

describe('CancellationToken', () => {
	it('初始未 abort', () => {
		const t = new CancellationToken()
		expect(t.aborted).toBe(false)
		expect(t.cancellationInfo).toBeNull()
	})

	it('cancel 触发 signal abort', () => {
		const t = new CancellationToken()
		t.cancel('user', 'user pressed Ctrl-C')
		expect(t.aborted).toBe(true)
		expect(t.signal.aborted).toBe(true)
		expect(t.cancellationInfo?.reason).toBe('user')
		expect(t.cancellationInfo?.detail).toContain('Ctrl-C')
	})

	it('多次 cancel 幂等 —— 只记录第一次 reason', () => {
		const t = new CancellationToken()
		t.cancel('user')
		t.cancel('watchdog')
		t.cancel('budget')
		expect(t.cancellationInfo?.reason).toBe('user')
	})

	it('包装外部 AbortController', () => {
		const ctrl = new AbortController()
		const t = new CancellationToken(ctrl)
		t.cancel('error')
		expect(ctrl.signal.aborted).toBe(true)
	})

	it('createChild：父 abort 自动级联子', () => {
		const parent = new CancellationToken()
		const child = parent.createChild()
		expect(child.aborted).toBe(false)
		parent.cancel('user')
		expect(child.aborted).toBe(true)
		expect(child.cancellationInfo?.reason).toBe('parent')
		expect(child.cancellationInfo?.detail).toContain('user')
	})

	it('createChild：父已 abort 时子立即 abort', () => {
		const parent = new CancellationToken()
		parent.cancel('watchdog')
		const child = parent.createChild()
		expect(child.aborted).toBe(true)
		expect(child.cancellationInfo?.reason).toBe('parent')
	})

	it('多个子 token 全部级联', () => {
		const parent = new CancellationToken()
		const child1 = parent.createChild()
		const child2 = parent.createChild()
		parent.cancel('budget')
		expect(child1.aborted).toBe(true)
		expect(child2.aborted).toBe(true)
	})

	it('子 token cancel 不影响父', () => {
		const parent = new CancellationToken()
		const child = parent.createChild()
		child.cancel('user')
		expect(parent.aborted).toBe(false)
	})

	it('cancellationInfo timestamp 是 Date.now()', () => {
		const t = new CancellationToken()
		const before = Date.now()
		t.cancel('user')
		const after = Date.now()
		expect(t.cancellationInfo!.timestamp).toBeGreaterThanOrEqual(before)
		expect(t.cancellationInfo!.timestamp).toBeLessThanOrEqual(after)
	})
})
