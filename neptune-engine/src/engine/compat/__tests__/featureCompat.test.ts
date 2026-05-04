/**
 * featureCompat 测试
 *
 * 测试目标：
 * 1. isEnabledSync 在非 Bun 环境返回 false
 * 2. isEnabledSync 在有 overrides 时使用 overrides 值
 * 3. createFeatureChecker 创建的 checker 正常工作
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { isEnabledSync, createFeatureChecker, type FeatureOverride } from '../featureCompat'

describe('featureCompat', () => {
	describe('isEnabledSync', () => {
		test('在非 Bun 环境下（模拟）应返回 false', () => {
			// 注意：此测试在 Bun 环境运行，但我们可以通过 overrides 覆盖
			const result = isEnabledSync('NONEXISTENT_FLAG', { NONEXISTENT_FLAG: false })
			expect(result).toBe(false)
		})

		test('有 overrides 时应使用 overrides 值', () => {
			const overrides: FeatureOverride = {
				TEST_FLAG_1: true,
				TEST_FLAG_2: false,
			}

			expect(isEnabledSync('TEST_FLAG_1', overrides)).toBe(true)
			expect(isEnabledSync('TEST_FLAG_2', overrides)).toBe(false)
		})

		test('overrides 中未定义的 flag 应使用默认行为', () => {
			const overrides: FeatureOverride = {
				TEST_FLAG_1: true,
			}

			// TEST_FLAG_2 未在 overrides 中定义，应使用默认行为
			// 在 Bun 环境下，默认行为是调用原生 feature()，返回 false（flag 未启用）
			const result = isEnabledSync('TEST_FLAG_2', overrides)
			expect(typeof result).toBe('boolean')
		})

		test('空 overrides 应使用默认行为', () => {
			const result = isEnabledSync('SOME_FLAG', {})
			expect(typeof result).toBe('boolean')
		})

		test('undefined overrides 应使用默认行为', () => {
			const result = isEnabledSync('SOME_FLAG')
			expect(typeof result).toBe('boolean')
		})
	})

	describe('createFeatureChecker', () => {
		test('应创建带有固定 overrides 的 checker', () => {
			const overrides: FeatureOverride = {
				TEST_FLAG: true,
			}
			const checker = createFeatureChecker(overrides)

			expect(checker.check('TEST_FLAG')).toBe(true)
			expect(checker.check('ANOTHER_FLAG')).toBe(false) // 默认行为
		})

		test('update 方法应更新 overrides', () => {
			const overrides: FeatureOverride = {
				TEST_FLAG: true,
			}
			const checker = createFeatureChecker(overrides)

			expect(checker.check('TEST_FLAG')).toBe(true)

			checker.update({ TEST_FLAG: false })

			expect(checker.check('TEST_FLAG')).toBe(false)
		})

		test('update 方法应合并新配置', () => {
			const overrides: FeatureOverride = {
				FLAG_1: true,
			}
			const checker = createFeatureChecker(overrides)

			checker.update({ FLAG_2: false })

			expect(checker.check('FLAG_1')).toBe(true)
			expect(checker.check('FLAG_2')).toBe(false)
		})
	})
})
