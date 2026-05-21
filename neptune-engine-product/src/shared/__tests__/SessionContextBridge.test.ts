/**
 * SessionContextBridge POC 测试
 *
 * 验证独立 ALS 桥接层的基本功能：
 * 1. getContext() / setContext() 基本功能
 * 2. getCwd() / setCwd() 便捷方法
 * 3. getSessionId() / setSessionId() 便捷方法
 * 4. ALS 上下文隔离
 */

import {describe, test, expect} from 'bun:test'
import {
	getContext,
	runWithContext,
	createContext,
	getCwd,
	setCwd,
	getSessionId,
	setSessionId,
	isInContext,
} from '../SessionContextBridge'

describe('SessionContextBridge', () => {
	test('getContext() 在无上下文时返回 undefined', () => {
		expect(getContext()).toBeUndefined()
	})

	test('getContext() 在有上下文时返回正确数据', () => {
		const context = createContext({
			cwd: '/test/path',
			sessionId: 'test-session-id',
		})

		runWithContext(context, () => {
			const currentContext = getContext()
			expect(currentContext).toBeDefined()
			expect(currentContext?.cwd).toBe('/test/path')
			expect(currentContext?.sessionId).toBe('test-session-id')
		})
	})

	test('getCwd() / setCwd() 便捷方法', () => {
		const context = createContext({cwd: '/initial/path'})

		runWithContext(context, () => {
			expect(getCwd()).toBe('/initial/path')

			setCwd('/new/path')
			expect(getCwd()).toBe('/new/path')
		})
	})

	test('getSessionId() / setSessionId() 便捷方法', () => {
		const context = createContext({sessionId: 'initial-session'})

		runWithContext(context, () => {
			expect(getSessionId()).toBe('initial-session')

			setSessionId('new-session')
			expect(getSessionId()).toBe('new-session')
		})
	})

	test('isInContext() 正确检测上下文状态', () => {
		expect(isInContext()).toBe(false)

		const context = createContext({cwd: '/test'})
		runWithContext(context, () => {
			expect(isInContext()).toBe(true)
		})

		expect(isInContext()).toBe(false)
	})

	test('ALS 上下文隔离', () => {
		const context1 = createContext({cwd: '/context1', sessionId: 'session1'})
		const context2 = createContext({cwd: '/context2', sessionId: 'session2'})

		let context1Result: string | undefined
		let context2Result: string | undefined

		runWithContext(context1, () => {
			context1Result = getCwd()
			expect(context1Result).toBe('/context1')

			// 嵌套上下文
			runWithContext(context2, () => {
				context2Result = getCwd()
				expect(context2Result).toBe('/context2')
			})

			// 嵌套上下文结束后，应该恢复到 context1
			expect(getCwd()).toBe('/context1')
		})

		expect(context1Result).toBe('/context1')
		expect(context2Result).toBe('/context2')
	})

	test('runWithContext 返回回调函数的返回值', () => {
		const context = createContext({cwd: '/test'})

		const result = runWithContext(context, () => {
			return 'test-result'
		})

		expect(result).toBe('test-result')
	})
})
