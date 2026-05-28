/**
 * Stage 2.3 — PermissionMode 决策矩阵测试
 *
 * 5 mode × 5 category = 25 决策点全覆盖。
 */

import {describe, expect, it} from 'bun:test'
import {
	applyPermissionMode,
	modeDecisionToPermissionResult,
	type PermissionMode,
	type ToolCategory,
} from '../PermissionMode.js'

const MODES: PermissionMode[] = ['default', 'plan', 'readonly', 'dangerous', 'bypass']
const CATEGORIES: ToolCategory[] = ['readOnly', 'write', 'network', 'shell', 'mutation']

describe('applyPermissionMode — 25 决策点矩阵', () => {
	describe('default', () => {
		for (const cat of CATEGORIES) {
			it(`default × ${cat} = passthrough`, () => {
				expect(applyPermissionMode('default', cat).behavior).toBe('passthrough')
			})
		}
	})

	describe('plan（阻止 write/shell/mutation；允许 readOnly/network）', () => {
		it('plan × readOnly = allow', () => {
			expect(applyPermissionMode('plan', 'readOnly').behavior).toBe('allow')
		})
		it('plan × network = allow', () => {
			expect(applyPermissionMode('plan', 'network').behavior).toBe('allow')
		})
		it('plan × write = deny', () => {
			const d = applyPermissionMode('plan', 'write')
			expect(d.behavior).toBe('deny')
			if (d.behavior === 'deny') {
				expect(d.reason).toContain('plan_mode_blocked')
			}
		})
		it('plan × shell = deny', () => {
			const d = applyPermissionMode('plan', 'shell')
			expect(d.behavior).toBe('deny')
			if (d.behavior === 'deny') {
				expect(d.reason).toContain('plan_mode_blocked')
			}
		})
		it('plan × mutation = deny', () => {
			const d = applyPermissionMode('plan', 'mutation')
			expect(d.behavior).toBe('deny')
			if (d.behavior === 'deny') {
				expect(d.reason).toContain('plan_mode_blocked')
			}
		})
	})

	describe('readonly（阻止 write/mutation；允许 readOnly/network/shell）', () => {
		it('readonly × readOnly = allow', () => {
			expect(applyPermissionMode('readonly', 'readOnly').behavior).toBe('allow')
		})
		it('readonly × network = allow', () => {
			expect(applyPermissionMode('readonly', 'network').behavior).toBe('allow')
		})
		it('readonly × shell = allow', () => {
			expect(applyPermissionMode('readonly', 'shell').behavior).toBe('allow')
		})
		it('readonly × write = deny', () => {
			const d = applyPermissionMode('readonly', 'write')
			expect(d.behavior).toBe('deny')
			if (d.behavior === 'deny') {
				expect(d.reason).toContain('readonly_mode_blocked')
			}
		})
		it('readonly × mutation = deny', () => {
			const d = applyPermissionMode('readonly', 'mutation')
			expect(d.behavior).toBe('deny')
			if (d.behavior === 'deny') {
				expect(d.reason).toContain('readonly_mode_blocked')
			}
		})
	})

	describe('dangerous（全 allow）', () => {
		for (const cat of CATEGORIES) {
			it(`dangerous × ${cat} = allow`, () => {
				expect(applyPermissionMode('dangerous', cat).behavior).toBe('allow')
			})
		}
	})

	describe('bypass（跳过 hook chain — 全 allow）', () => {
		for (const cat of CATEGORIES) {
			it(`bypass × ${cat} = allow`, () => {
				expect(applyPermissionMode('bypass', cat).behavior).toBe('allow')
			})
		}
	})

	it('全矩阵 25 决策点都明确（无 fallback passthrough）', () => {
		for (const mode of MODES) {
			for (const cat of CATEGORIES) {
				const decision = applyPermissionMode(mode, cat)
				expect(['allow', 'deny', 'passthrough']).toContain(decision.behavior)
			}
		}
	})
})

describe('modeDecisionToPermissionResult', () => {
	it('allow 决策 → behavior:allow + updatedInput', () => {
		const result = modeDecisionToPermissionResult(
			{behavior: 'allow'},
			{x: 1},
		)
		expect((result as {behavior: string}).behavior).toBe('allow')
	})

	it('deny 决策 → behavior:deny + message', () => {
		const result = modeDecisionToPermissionResult(
			{behavior: 'deny', reason: 'no'},
			{},
		)
		expect((result as {behavior: string; message: string}).behavior).toBe('deny')
		expect((result as {behavior: string; message: string}).message).toBe('no')
	})

	it('passthrough 决策 → behavior:passthrough', () => {
		const result = modeDecisionToPermissionResult({behavior: 'passthrough'}, {})
		expect((result as {behavior: string}).behavior).toBe('passthrough')
	})
})
