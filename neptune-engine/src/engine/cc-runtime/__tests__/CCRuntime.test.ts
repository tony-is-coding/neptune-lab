/**
 * CCRuntime 单元测试
 *
 * 验证 CCRuntime 接口和实现的基本功能。
 */

import {describe, test, expect, beforeEach} from 'bun:test'
import {MockCCRuntime, createMockCCRuntime} from '../MockCCRuntime.js'
import type {CCRuntime, MockCCRuntimeOptions} from '../index.js'

describe('CCRuntime 接口', () => {
	describe('MockCCRuntime', () => {
		let runtime: CCRuntime

		beforeEach(() => {
			runtime = createMockCCRuntime()
		})

		test('应该返回空工具列表（默认）', () => {
			const tools = runtime.getAllBaseTools()
			expect(tools).toEqual([])
		})

		test('应该返回配置的工具列表', () => {
			const mockTools = [{name: 'test-tool'} as any]
			const customRuntime = createMockCCRuntime({tools: mockTools})
			const tools = customRuntime.getAllBaseTools()
			expect(tools).toEqual(mockTools)
		})

		test('应该支持 enableConfigs（空实现）', () => {
			expect(() => runtime.enableConfigs()).not.toThrow()
		})

		test('应该支持 setupBootstrap（空实现）', () => {
			expect(() =>
				runtime.setupBootstrap({
					cwd: '/test',
					originalCwd: '/test',
					projectRoot: '/test',
				}),
			).not.toThrow()
		})

		test('应该支持 loadTranscriptFromFile', async () => {
			const result = await runtime.loadTranscriptFromFile('/test/path.jsonl')
			expect(result).toEqual({messages: []})
		})

		test('应该支持自定义 transcript 结果', async () => {
			const customMessages = [{type: 'test'}]
			const customRuntime = createMockCCRuntime({
				transcriptResult: {messages: customMessages},
			})
			const result = await customRuntime.loadTranscriptFromFile('/test/path.jsonl')
			expect(result.messages).toEqual(customMessages)
		})

		test('应该支持 getMemoryPath（默认 undefined）', () => {
			const memoryPath = runtime.getMemoryPath()
			expect(memoryPath).toBeUndefined()
		})

		test('应该支持自定义 memoryPath', () => {
			const customRuntime = createMockCCRuntime({memoryPath: '/test/memory'})
			const memoryPath = customRuntime.getMemoryPath()
			expect(memoryPath).toBe('/test/memory')
		})

		test('应该注入 MACRO defines', () => {
			runtime.injectMacroDefines()
			expect(globalThis.MACRO).toBeDefined()
			expect((globalThis.MACRO as any).VERSION).toBe('mock-2.1.888')
		})

		test('应该跟踪初始化状态', () => {
			expect(runtime.isInitialized()).toBe(false)

			runtime.markInitialized()
			expect(runtime.isInitialized()).toBe(true)
		})

		test('应该支持重置初始化状态', () => {
			runtime.markInitialized()
			expect(runtime.isInitialized()).toBe(true)

			if (runtime.resetForTesting) {
				runtime.resetForTesting()
				expect(runtime.isInitialized()).toBe(false)
			}
		})
	})

	describe('多 Workspace 支持', () => {
		let runtime: CCRuntime

		beforeEach(() => {
			runtime = createMockCCRuntime()
		})

		test('应该支持 runWithCwd', () => {
			const result = runtime.runWithCwd('/test/workspace', () => {
				return 'executed-in-context'
			})
			expect(result).toBe('executed-in-context')
		})

		test('应该支持 per-workspace 初始化跟踪', () => {
			const workspace1 = '/workspace1'
			const workspace2 = '/workspace2'

			expect(runtime.isWorkspaceInitialized(workspace1)).toBe(false)
			expect(runtime.isWorkspaceInitialized(workspace2)).toBe(false)

			runtime.markWorkspaceInitialized(workspace1)

			expect(runtime.isWorkspaceInitialized(workspace1)).toBe(true)
			expect(runtime.isWorkspaceInitialized(workspace2)).toBe(false)

			runtime.markWorkspaceInitialized(workspace2)

			expect(runtime.isWorkspaceInitialized(workspace1)).toBe(true)
			expect(runtime.isWorkspaceInitialized(workspace2)).toBe(true)
		})

		test('应该在重置时清空 workspace 初始化状态', () => {
			const workspace1 = '/workspace1'

			runtime.markWorkspaceInitialized(workspace1)
			expect(runtime.isWorkspaceInitialized(workspace1)).toBe(true)

			if (runtime.resetForTesting) {
				runtime.resetForTesting()
				expect(runtime.isWorkspaceInitialized(workspace1)).toBe(false)
			}
		})
	})
})
