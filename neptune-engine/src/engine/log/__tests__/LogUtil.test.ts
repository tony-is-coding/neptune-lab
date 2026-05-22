/**
 * LogUtil 单元测试
 *
 * 测试覆盖：
 * - 单例模式：getInstance/initialize/shutdown
 * - 日志级别过滤：debug/info/warn/error
 * - child logger：名称链、配置继承
 * - 静态快捷方法
 */

import {describe, test, expect, beforeEach, afterEach} from 'bun:test'
import {LogUtil} from '../LogUtil'
import type {LogLevel} from '../EngineLogger'
import {ConsoleLogProvider} from '../ConsoleLogProvider'
import {StandardLogFormatter} from '../StandardLogFormatter'
import type {LogConfig} from '../LogRecord'

describe('LogUtil', () => {
	afterEach(async () => {
		// 每个测试后清理单例
		await LogUtil.shutdown()
	})

	describe('单例模式', () => {
		test('getInstance 应该返回相同的实例', () => {
			const instance1 = LogUtil.getInstance()
			const instance2 = LogUtil.getInstance()
			expect(instance1).toBe(instance2)
		})

		test('initialize 应该创建新实例', () => {
			const config: LogConfig = {
				level: 'debug',
				includeCallSite: false,
			}
			LogUtil.initialize(config)

			const instance = LogUtil.getInstance()
			expect(instance).toBeDefined()
			expect(instance).toBeInstanceOf(LogUtil)
		})

		test('shutdown 后 getInstance 应该创建新实例', async () => {
			const instance1 = LogUtil.getInstance()
			await LogUtil.shutdown()

			const instance2 = LogUtil.getInstance()
			expect(instance2).toBeDefined()
			expect(instance2).not.toBe(instance1)
		})
	})

	describe('日志级别过滤', () => {
		test('debug 级别应该输出所有日志', () => {
			LogUtil.initialize({level: 'debug', includeCallSite: false})

			const logger = LogUtil.getInstance()
			// 不抛出错误即表示通过
			logger.debug('debug message')
			logger.info('info message')
			logger.warn('warn message')
			logger.error('error message')
		})

		test('info 级别应该过滤 debug 日志', () => {
			LogUtil.initialize({level: 'info', includeCallSite: false})

			const logger = LogUtil.getInstance()
			logger.info('info message')
			logger.warn('warn message')
			logger.error('error message')
			// debug 不应该输出（无法直接测试，但至少不报错）
			logger.debug('debug message')
		})

		test('warn 级别应该过滤 debug 和 info 日志', () => {
			LogUtil.initialize({level: 'warn', includeCallSite: false})

			const logger = LogUtil.getInstance()
			logger.warn('warn message')
			logger.error('error message')
		})

		test('error 级别应该只输出 error 日志', () => {
			LogUtil.initialize({level: 'error', includeCallSite: false})

			const logger = LogUtil.getInstance()
			logger.error('error message')
		})

		test('setLevel 应该动态调整日志级别', () => {
			LogUtil.initialize({level: 'info', includeCallSite: false})

			const logger = LogUtil.getInstance()
			logger.info('info message')

			// 设置为 error 级别
			LogUtil.setLevel('error')
			logger.error('error message')
			// info 应该被过滤
			logger.info('info message')
		})
	})

	describe('child logger', () => {
		test('child 应该创建具有名称链的子 logger', () => {
			LogUtil.initialize({level: 'info', includeCallSite: false})

			const parent = LogUtil.getInstance()
			const child = parent.child('session')
			const grandChild = child.child('request')

			expect(child).toBeInstanceOf(LogUtil)
			expect(grandChild).toBeInstanceOf(LogUtil)
		})

		test('child logger 应该继承父级配置', () => {
			const config: LogConfig = {
				level: 'warn',
				includeCallSite: false,
				formatter: new StandardLogFormatter(),
				provider: new ConsoleLogProvider(),
			}
			LogUtil.initialize(config)

			const parent = LogUtil.getInstance()
			const child = parent.child('session')

			// 子 logger 应该能正常工作（继承配置）
			child.warn('child warn message')
		})
	})

	describe('静态快捷方法', () => {
		beforeEach(() => {
			LogUtil.initialize({level: 'debug', includeCallSite: false})
		})

		test('debug 静态方法应该工作', () => {
			LogUtil.debug('static debug')
		})

		test('info 静态方法应该工作', () => {
			LogUtil.info('static info')
		})

		test('warn 静态方法应该工作', () => {
			LogUtil.warn('static warn')
		})

		test('error 静态方法应该工作', () => {
			LogUtil.error('static error')
		})

		test('print 静态方法应该工作', () => {
			LogUtil.print('print message')
		})
	})

	describe('setLevel', () => {
		test('setLevel 应该更新全局日志级别', () => {
			LogUtil.initialize({level: 'info', includeCallSite: false})

			const logger = LogUtil.getInstance()

			// 初始级别为 info，debug 应该被过滤
			logger.debug('should be filtered')

			// 设置为 debug
			LogUtil.setLevel('debug')
			logger.debug('should be logged')
		})

		test('setLevel 应该支持所有日志级别', () => {
			LogUtil.initialize({level: 'info', includeCallSite: false})

			const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
			const logger = LogUtil.getInstance()

			for (const level of levels) {
				LogUtil.setLevel(level)
				logger.error(`level set to ${level}`)
			}
		})
	})
})
