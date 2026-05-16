/**
 * ConsoleLogProvider 单元测试
 *
 * 测试覆盖：
 * - write() 方法输出到正确的 console level
 * - print() 方法输出到 console.log
 * - dispose() 无副作用
 */

import {describe, test, expect, beforeEach, afterEach} from 'bun:test'
import {ConsoleLogProvider} from '../ConsoleLogProvider'

describe('ConsoleLogProvider', () => {
	let provider: ConsoleLogProvider
	let originalConsole: {
		debug: typeof console.debug
		info: typeof console.info
		warn: typeof console.warn
		error: typeof console.error
		log: typeof console.log
	}

	beforeEach(() => {
		provider = new ConsoleLogProvider()
		// 保存原始 console 方法
		originalConsole = {
			debug: console.debug,
			info: console.info,
			warn: console.warn,
			error: console.error,
			log: console.log,
		}
	})

	afterEach(() => {
		// 恢复原始 console 方法
		console.debug = originalConsole.debug
		console.info = originalConsole.info
		console.warn = originalConsole.warn
		console.error = originalConsole.error
		console.log = originalConsole.log
	})

	describe('write()', () => {
		test('应该使用 console.debug 输出 debug 日志', () => {
			let called = false
			console.debug = (..._args: unknown[]) => {
				called = true
			}

			provider.write('debug message', 'debug')
			expect(called).toBe(true)
		})

		test('应该使用 console.info 输出 info 日志', () => {
			let called = false
			console.info = (..._args: unknown[]) => {
				called = true
			}

			provider.write('info message', 'info')
			expect(called).toBe(true)
		})

		test('应该使用 console.warn 输出 warn 日志', () => {
			let called = false
			console.warn = (..._args: unknown[]) => {
				called = true
			}

			provider.write('warn message', 'warn')
			expect(called).toBe(true)
		})

		test('应该使用 console.error 输出 error 日志', () => {
			let called = false
			console.error = (..._args: unknown[]) => {
				called = true
			}

			provider.write('error message', 'error')
			expect(called).toBe(true)
		})

		test('应该传递完整的格式化消息', () => {
			let receivedMessage = ''
			console.info = (...args: unknown[]) => {
				receivedMessage = args.join(' ')
			}

			provider.write('formatted message', 'info')
			expect(receivedMessage).toBe('formatted message')
		})
	})

	describe('print()', () => {
		test('应该使用 console.log 输出原始消息', () => {
			let called = false
			let receivedMessage = ''
			console.log = (...args: unknown[]) => {
				called = true
				receivedMessage = args[0] as string
			}

			provider.print('raw message')
			expect(called).toBe(true)
			expect(receivedMessage).toBe('raw message')
		})
	})

	describe('dispose()', () => {
		test('dispose 应该无副作用且不抛出错误', () => {
			expect(() => {
				provider.dispose()
			}).not.toThrow()
		})

		test('dispose 后仍然可以调用 write', () => {
			provider.dispose()
			expect(() => {
				provider.write('message', 'info')
			}).not.toThrow()
		})
	})
})
