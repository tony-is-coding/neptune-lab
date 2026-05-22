import {describe, test, expect} from 'bun:test'
import {
	coreToolToTool,
	toolToCoreTool,
	hasUIImplementation,
	filterToCoreTools,
} from '../ToolAdapter.js'
import type {CoreTool, Tool, UITool} from '@neptune/engine-product/types/toolTypes.js'
import {z} from 'zod/v4'

describe('ToolAdapter', () => {
	// 模拟 CoreTool
	const mockCoreTool: CoreTool = {
		name: 'TestTool',
		description: async () => 'test',
		inputSchema: z.object({input: z.string()}),
		isEnabled: () => true,
		isReadOnly: () => true,
		isConcurrencySafe: () => false,
		prompt: async () => 'test prompt',
		call: async () => ({type: 'result' as const, data: 'test'}),
		maxResultSizeChars: 10000,
		mapToolResultToToolResultBlockParam: () => ({
			type: 'tool_result',
			tool_use_id: 'test',
			content: 'test',
		}),
		checkPermissions: async () => ({behavior: 'allow' as const}),
	}

	// 模拟完整的 UITool
	const mockUITool: UITool = {
		userFacingName: () => 'Test Tool',
		renderToolUseMessage: () => null,
		toAutoClassifierInput: () => '',
	}

	test('coreToolToTool converts CoreTool to Tool', () => {
		const tool = coreToolToTool(mockCoreTool)
		expect(tool.name).toBe('TestTool')
		expect(tool.userFacingName).toBeDefined()
		expect(typeof tool.userFacingName).toBe('function')
	})

	test('toolToCoreTool extracts CoreTool from Tool', () => {
		const fullTool: Tool = {
			...mockCoreTool,
			userFacingName: () => 'Test Tool',
			renderToolUseMessage: () => null,
			toAutoClassifierInput: () => '',
		}
		const coreTool = toolToCoreTool(fullTool)
		expect(coreTool.name).toBe('TestTool')
		// 验证 UI 方法被移除
		expect(
			(coreTool as unknown as Record<string, unknown>).renderToolUseMessage,
		).toBeUndefined()
	})

	test('hasUIImplementation detects UI methods', () => {
		const toolWithUI: Tool = {
			...mockCoreTool,
			userFacingName: () => 'Test',
			renderToolUseMessage: () => null,
			toAutoClassifierInput: () => '',
		}
		expect(hasUIImplementation(toolWithUI)).toBe(true)
		// coreToolToTool 添加了默认的 renderToolUseMessage，所以也有 UI 实现
		expect(hasUIImplementation(coreToolToTool(mockCoreTool))).toBe(true)
	})

	test('coreToolToTool with uiDefaults', () => {
		const tool = coreToolToTool(mockCoreTool, {
			userFacingName: () => 'Custom Name',
		})
		expect((tool.userFacingName as () => string)()).toBe('Custom Name')
	})

	test('filterToCoreTools converts Tool array to CoreTool array', () => {
		const tools: Tool[] = [
			{
				...mockCoreTool,
				userFacingName: () => 'Tool 1',
				renderToolUseMessage: () => null,
				toAutoClassifierInput: () => '',
			},
			{
				...mockCoreTool,
				name: 'Tool2',
				userFacingName: () => 'Tool 2',
				renderToolUseMessage: () => null,
				toAutoClassifierInput: () => '',
			},
		]
		const coreTools = filterToCoreTools(tools)
		expect(coreTools).toHaveLength(2)
		expect(coreTools[0].name).toBe('TestTool')
		expect(coreTools[1].name).toBe('Tool2')
		// 验证 UI 方法被移除
		expect(
			(coreTools[0] as unknown as Record<string, unknown>).renderToolUseMessage,
		).toBeUndefined()
	})

	test('toolToCoreTool preserves all CoreTool methods', () => {
		const fullTool: Tool = {
			...mockCoreTool,
			aliases: ['test', 'alias'],
			searchHint: 'test search hint',
			isDestructive: () => false,
			interruptBehavior: () => 'block' as const,
			userFacingName: () => 'Test Tool',
			renderToolUseMessage: () => null,
			toAutoClassifierInput: () => '',
		}
		const coreTool = toolToCoreTool(fullTool)

		// 验证核心方法被保留
		expect(coreTool.name).toBe('TestTool')
		expect(coreTool.aliases).toEqual(['test', 'alias'])
		expect(coreTool.searchHint).toBe('test search hint')
		expect(coreTool.isDestructive?.({})).toBe(false)
		expect(coreTool.interruptBehavior?.()).toBe('block')

		// 验证 UI 方法被移除
		expect(
			(coreTool as unknown as Record<string, unknown>).userFacingName,
		).toBeUndefined()
		expect(
			(coreTool as unknown as Record<string, unknown>).renderToolUseMessage,
		).toBeUndefined()
	})

	test('coreToolToTool adds default UI implementations', () => {
		const tool = coreToolToTool(mockCoreTool)

		// 验证默认 UI 方法存在
		expect(tool.userFacingName).toBeDefined()
		expect(tool.toAutoClassifierInput).toBeDefined()
		expect(tool.renderToolUseMessage).toBeDefined()

		// 验证默认实现行为
		expect((tool.userFacingName as () => string)()).toBe('TestTool')
		expect((tool.toAutoClassifierInput as () => string)()).toBe('')
	})
})
