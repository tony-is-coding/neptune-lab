import {describe, expect, test} from 'bun:test'
import {createHeadlessCCRuntime} from '../DefaultCCRuntime.js'

describe('createHeadlessCCRuntime', () => {
	test('uses SDK tool registry without falling back to tools.ts', () => {
		const runtime = createHeadlessCCRuntime()
		const tools = runtime.getAllBaseTools()
		const toolNames = tools.map(tool => tool.name)

		expect(toolNames).toContain('Read')
		expect(toolNames).toContain('Write')
		expect(toolNames).toContain('Edit')
		expect(toolNames).toContain('Grep')
		expect(toolNames).toContain('TaskCreate')
		expect(toolNames).not.toContain('Config')
		expect(toolNames).not.toContain('EnterPlanMode')
	})

	test('installs a ToolRegistry adapter on the runtime', () => {
		const runtime = createHeadlessCCRuntime()

		expect(runtime.getToolRegistry?.()).toBeDefined()
		expect(runtime.getToolRegistry?.()?.getCoreToolCount()).toBeGreaterThan(0)
	})

	// 注：原 'runs a headless query without loading CLI QueryEngine or UI modules' 测试
	// 走 AgentEngine.query → HeadlessQueryEngine 集成路径，v6.0 P0.2.A 已将 AgentEngine 切到 substrate
	// 路径，HeadlessQueryEngine 文件本身保留（0.2.B 删除），此处不再测试 AgentEngine 集成。
	// runtime-level 工具注册功能由上面两个测试覆盖。
})

