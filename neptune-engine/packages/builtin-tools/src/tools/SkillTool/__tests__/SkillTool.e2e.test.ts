/**
 * SkillTool e2e — P0.2 端到端测试
 *
 * 验证 substrate skill 启动核心契约：
 * 1. invoke skill → spawn ad-hoc sub-agent → end_turn → result 回填
 * 2. skill.prompt 被注入 sub-agent system prompt
 * 3. skill.tools 白名单过滤工具
 * 4. skill.model = 'haiku' / 'inherit' / undefined → 三段优先级
 * 5. depth 限制（防递归 spawn）
 * 6. skill 不存在 → 错误信息含 available skills
 * 7. cancellation 链路
 * 8. SkillRegistry 缺失 → 友好错误
 * 9. provider 缺失 → 友好错误
 * 10. ToolDef metadata
 * 11. mapToolResult: completed 含 skill name + agentId + usage trailer
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import {InMemorySkillRegistry, type SkillManifest} from '@neptune/engine'
import {ScriptedProvider, textTurn} from '../../../../../../src/engine/agent-loop/loop/__tests__/scriptedProvider.js'
import {SkillTool} from '../SkillTool.js'
import {SKILL_TOOL_NAME} from '../constants.js'
import type {KernelProtocols, KernelToolContext} from '../../../kernel-context.js'

function makeContext(opts: {
	registry?: InMemorySkillRegistry
	provider?: ScriptedProvider
	tools?: unknown[]
	mainLoopModel?: string
	subAgentDepth?: number
	subAgentMaxDepth?: number
	abortController?: AbortController
}): KernelToolContext {
	const registry = opts.registry ?? new InMemorySkillRegistry()
	const provider = opts.provider ?? new ScriptedProvider([textTurn('default')])
	const ctx = {
		abortController: opts.abortController ?? new AbortController(),
		options: {
			tools: (opts.tools ?? []) as unknown[],
			mainLoopModel: opts.mainLoopModel,
			isNonInteractiveSession: false,
		},
		canUseTool: () => ({behavior: 'allow' as const}),
		kernel: {
			skillRegistry: registry,
		} as KernelProtocols,
		provider,
		subAgentDepth: opts.subAgentDepth ?? 0,
		subAgentMaxDepth: opts.subAgentMaxDepth ?? 3,
	}
	return ctx as unknown as KernelToolContext
}

function makeManifest(
	overrides: Partial<SkillManifest> & Pick<SkillManifest, 'name'>,
): SkillManifest {
	return {
		name: overrides.name,
		description: overrides.description ?? 'test skill',
		prompt: overrides.prompt ?? 'You are a test skill agent.',
		tools: overrides.tools,
		disallowedTools: overrides.disallowedTools,
		model: overrides.model,
		metadata: overrides.metadata,
	}
}

function makeAssistantMessage() {
	return {
		type: 'assistant' as const,
		uuid: randomUUID() as unknown as string,
		message: {role: 'assistant', content: [], id: 'msg_parent'},
		requestId: 'req_parent',
	}
}

async function registerSkill(
	registry: InMemorySkillRegistry,
	manifest: SkillManifest,
): Promise<void> {
	await registry.register(manifest, {
		kind: 'inline',
		origin: 'test',
		loadedAt: new Date().toISOString(),
	})
}

// ============================================================
// 契约 1: 基础 skill invoke
// ============================================================

describe('SkillTool — 基础 skill invoke', () => {
	it('invoke skill → spawn sub-agent → 返回 completed status + content', async () => {
		const registry = new InMemorySkillRegistry()
		await registerSkill(
			registry,
			makeManifest({name: 'commit-helper', prompt: 'Help generate git commit messages.'}),
		)
		const provider = new ScriptedProvider([textTurn('feat: add new feature')])
		const ctx = makeContext({registry, provider})

		const result = await SkillTool.call(
			{skill: 'commit-helper', args: 'I just added auth logic'},
			ctx,
			() => ({behavior: 'allow' as const}),
			makeAssistantMessage() as unknown as Parameters<typeof SkillTool.call>[3],
		)

		const data = result.data as {
			status: string
			success: boolean
			skillName: string
			agentId: string
			content: Array<{text: string}>
		}
		expect(data.status).toBe('completed')
		expect(data.success).toBe(true)
		expect(data.skillName).toBe('commit-helper')
		expect(data.content[0]?.text).toBe('feat: add new feature')
		expect(data.agentId).toMatch(/^[0-9a-f-]{36}$/)
	})

	it('skill.prompt 被传给 sub-agent provider 作 system prompt', async () => {
		const registry = new InMemorySkillRegistry()
		await registerSkill(
			registry,
			makeManifest({name: 'reviewer', prompt: 'You are a strict code reviewer.'}),
		)
		const provider = new ScriptedProvider([textTurn('reviewed')])
		const ctx = makeContext({registry, provider})

		await SkillTool.call(
			{skill: 'reviewer'},
			ctx,
			() => ({behavior: 'allow' as const}),
			makeAssistantMessage() as unknown as Parameters<typeof SkillTool.call>[3],
		)

		expect(provider.callLog[0]?.systemPrompt).toBe('You are a strict code reviewer.')
	})

	it('skill 名前导 / 自动 strip', async () => {
		const registry = new InMemorySkillRegistry()
		await registerSkill(registry, makeManifest({name: 'commit'}))
		const provider = new ScriptedProvider([textTurn('ok')])
		const ctx = makeContext({registry, provider})

		// 输入 '/commit' 也应命中 'commit'
		const r = await SkillTool.call(
			{skill: '/commit'},
			ctx,
			() => ({behavior: 'allow' as const}),
			makeAssistantMessage() as unknown as Parameters<typeof SkillTool.call>[3],
		)
		expect((r.data as {status: string}).status).toBe('completed')
	})
})

// ============================================================
// 契约 2: model 三段优先级
// ============================================================

describe('SkillTool — model 三段优先级', () => {
	it('skill.model = "haiku" → 用 haiku', async () => {
		const registry = new InMemorySkillRegistry()
		await registerSkill(registry, makeManifest({name: 's', model: 'haiku'}))
		const provider = new ScriptedProvider([textTurn('done')])
		const ctx = makeContext({registry, provider, mainLoopModel: 'opus'})

		await SkillTool.call(
			{skill: 's'},
			ctx,
			() => ({behavior: 'allow' as const}),
			makeAssistantMessage() as unknown as Parameters<typeof SkillTool.call>[3],
		)
		expect(provider.callLog[0]?.model).toBe('haiku')
	})

	it('skill.model = "inherit" → 用 parent mainLoopModel', async () => {
		const registry = new InMemorySkillRegistry()
		await registerSkill(registry, makeManifest({name: 's', model: 'inherit'}))
		const provider = new ScriptedProvider([textTurn('done')])
		const ctx = makeContext({registry, provider, mainLoopModel: 'opus'})

		await SkillTool.call(
			{skill: 's'},
			ctx,
			() => ({behavior: 'allow' as const}),
			makeAssistantMessage() as unknown as Parameters<typeof SkillTool.call>[3],
		)
		expect(provider.callLog[0]?.model).toBe('opus')
	})

	it('全无 → fallback claude-sonnet-4-20250514', async () => {
		const registry = new InMemorySkillRegistry()
		await registerSkill(registry, makeManifest({name: 's'}))
		const provider = new ScriptedProvider([textTurn('done')])
		const ctx = makeContext({registry, provider})

		await SkillTool.call(
			{skill: 's'},
			ctx,
			() => ({behavior: 'allow' as const}),
			makeAssistantMessage() as unknown as Parameters<typeof SkillTool.call>[3],
		)
		expect(provider.callLog[0]?.model).toBe('claude-sonnet-4-20250514')
	})
})

// ============================================================
// 契约 3: depth 限制
// ============================================================

describe('SkillTool — depth 限制', () => {
	it('depth >= maxDepth → throw', async () => {
		const registry = new InMemorySkillRegistry()
		await registerSkill(registry, makeManifest({name: 's'}))
		const ctx = makeContext({registry, subAgentDepth: 3, subAgentMaxDepth: 3})

		await expect(
			SkillTool.call(
				{skill: 's'},
				ctx,
				() => ({behavior: 'allow' as const}),
				makeAssistantMessage() as unknown as Parameters<typeof SkillTool.call>[3],
			),
		).rejects.toThrow(/depth limit reached/)
	})
})

// ============================================================
// 契约 4: skill 不存在 + protocol 缺失
// ============================================================

describe('SkillTool — skill 不存在 / 协议缺失', () => {
	it('skill 不存在 → 错误信息含 available skills', async () => {
		const registry = new InMemorySkillRegistry()
		await registerSkill(registry, makeManifest({name: 'a'}))
		await registerSkill(registry, makeManifest({name: 'b'}))
		const ctx = makeContext({registry})

		await expect(
			SkillTool.call(
				{skill: 'nonexistent'},
				ctx,
				() => ({behavior: 'allow' as const}),
				makeAssistantMessage() as unknown as Parameters<typeof SkillTool.call>[3],
			),
		).rejects.toThrow(/Skill 'nonexistent' not found.*a.*b/)
	})

	it('skillRegistry 未注入 → throw with helpful message', async () => {
		const ctx = {
			abortController: new AbortController(),
			options: {tools: [], isNonInteractiveSession: false},
			canUseTool: () => ({behavior: 'allow' as const}),
			kernel: {} as KernelProtocols,
			provider: new ScriptedProvider([textTurn('x')]),
		} as unknown as KernelToolContext

		await expect(
			SkillTool.call(
				{skill: 's'},
				ctx,
				() => ({behavior: 'allow' as const}),
				makeAssistantMessage() as unknown as Parameters<typeof SkillTool.call>[3],
			),
		).rejects.toThrow(/skillRegistry/)
	})

	it('provider 未注入 → throw with helpful message', async () => {
		const registry = new InMemorySkillRegistry()
		await registerSkill(registry, makeManifest({name: 's'}))
		const ctx = {
			abortController: new AbortController(),
			options: {tools: [], isNonInteractiveSession: false},
			canUseTool: () => ({behavior: 'allow' as const}),
			kernel: {skillRegistry: registry} as KernelProtocols,
		} as unknown as KernelToolContext

		await expect(
			SkillTool.call(
				{skill: 's'},
				ctx,
				() => ({behavior: 'allow' as const}),
				makeAssistantMessage() as unknown as Parameters<typeof SkillTool.call>[3],
			),
		).rejects.toThrow(/ctx\.provider/)
	})
})

// ============================================================
// 契约 5: cancellation 链路
// ============================================================

describe('SkillTool — cancellation 链路', () => {
	it('parent abort → child sub-agent abort → throw', async () => {
		const registry = new InMemorySkillRegistry()
		await registerSkill(registry, makeManifest({name: 's'}))
		const provider = new ScriptedProvider([textTurn('text')])
		const parentController = new AbortController()
		const ctx = makeContext({registry, provider, abortController: parentController})
		parentController.abort()

		await expect(
			SkillTool.call(
				{skill: 's'},
				ctx,
				() => ({behavior: 'allow' as const}),
				makeAssistantMessage() as unknown as Parameters<typeof SkillTool.call>[3],
			),
		).rejects.toThrow(/aborted/i)
	})
})

// ============================================================
// 契约 6: ToolDef metadata
// ============================================================

describe('SkillTool — ToolDef metadata', () => {
	it('name = Skill', () => {
		expect(SkillTool.name).toBe(SKILL_TOOL_NAME)
	})

	it('inputSchema 含必填 skill', () => {
		const schema = SkillTool.inputSchema as unknown as {
			parse: (v: unknown) => unknown
		}
		expect(() => schema.parse({})).toThrow()
		expect(() => schema.parse({skill: 'commit'})).not.toThrow()
	})
})

// ============================================================
// 契约 7: mapToolResult
// ============================================================

describe('SkillTool — mapToolResultToToolResultBlockParam', () => {
	it('completed result 含 skill name + agentId + usage trailer', () => {
		const block = SkillTool.mapToolResultToToolResultBlockParam!(
			{
				status: 'completed',
				success: true,
				skillName: 'commit-helper',
				agentId: 'agent-1',
				content: [{type: 'text', text: 'feat: x'}],
				totalToolUseCount: 0,
				totalDurationMs: 200,
				totalTokens: 50,
			},
			'tu_1',
		)
		const content = block.content as Array<{type: string; text: string}>
		expect(content.some(c => c.text === 'feat: x')).toBe(true)
		expect(content.some(c => c.text.includes('skill: commit-helper'))).toBe(true)
		expect(content.some(c => c.text.includes('agentId: agent-1'))).toBe(true)
		expect(content.some(c => c.text.includes('total_tokens: 50'))).toBe(true)
	})

	it('空内容 → 默认 marker', () => {
		const block = SkillTool.mapToolResultToToolResultBlockParam!(
			{
				status: 'completed',
				success: true,
				skillName: 's',
				agentId: 'a',
				content: [],
				totalToolUseCount: 0,
				totalDurationMs: 100,
				totalTokens: 0,
			},
			'tu_1',
		)
		const content = block.content as Array<{type: string; text: string}>
		expect(content.some(c => c.text.includes('Skill completed but returned no output'))).toBe(true)
	})
})
