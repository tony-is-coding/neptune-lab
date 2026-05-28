/**
 * ToolUseContext 单测
 */

import {describe, expect, it} from 'bun:test'
import {createToolUseContext, allowAllCanUseTool} from '../ToolUseContext.js'

describe('createToolUseContext', () => {
	it('默认值：空 tools / 非交互 / allow-all canUseTool / 自建 abortController', () => {
		const ctx = createToolUseContext()
		expect(ctx.options.tools).toEqual([])
		expect(ctx.options.isNonInteractiveSession).toBe(false)
		expect(ctx.canUseTool).toBe(allowAllCanUseTool)
		expect(ctx.abortController).toBeInstanceOf(AbortController)
	})

	it('注入自定义 abortController', async () => {
		const ctrl = new AbortController()
		const ctx = createToolUseContext({abortController: ctrl})
		expect(ctx.abortController).toBe(ctrl)
	})

	it('注入 kernel protocols', () => {
		const fakeSkill = {} as never
		const ctx = createToolUseContext({kernel: {skillRegistry: fakeSkill}})
		expect(ctx.kernel?.skillRegistry).toBe(fakeSkill)
	})

	it('注入 extra 字段合并到顶层', () => {
		const ctx = createToolUseContext({extra: {langfuseTrace: 'xyz'}})
		expect(ctx.langfuseTrace).toBe('xyz')
	})

	it('注入 optionsExtra 合并到 options', () => {
		const ctx = createToolUseContext({optionsExtra: {thinkingConfig: {type: 'enabled'}}})
		expect(ctx.options.thinkingConfig).toEqual({type: 'enabled'})
	})

	it('agentId 透传', () => {
		const ctx = createToolUseContext({agentId: 'sub-1'})
		expect(ctx.agentId).toBe('sub-1')
	})

	it('allowAllCanUseTool 总是返回 allow', async () => {
		const result = await allowAllCanUseTool(
			{name: 'X'} as never,
			{},
			{} as never,
			'tu_1',
		)
		expect(result).toEqual({behavior: 'allow'})
	})
})
