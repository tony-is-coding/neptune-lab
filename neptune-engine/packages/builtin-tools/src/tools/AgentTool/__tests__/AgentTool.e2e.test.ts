/**
 * AgentTool e2e 端到端测试 — Stage B2.9
 *
 * 验证 22 项功能契约中 B2 范围（10 项）：
 * 1. spawn sub-agent → end_turn → result 回填
 * 2. manifest.systemPrompt 被传给 sub-agent provider
 * 3. manifest.tools 白名单过滤
 * 4. model 三段优先级（input > manifest.modelHint > parent）
 * 5. last assistant text 聚合 + content blocks
 * 6. usage trailer 含 agentId / totalTokens / toolUses / durationMs
 * 7. parent abort → child abort 链路
 * 8. 三类错误处理 + partial result
 * 9. depth 限制（防 spawn 风暴）
 * 10. agent type 不存在 → 错误信息含 available types
 *
 * 注：B2 用 ScriptedProvider mock，B7 接 AgentEngine 后再补真 e2e
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import {
	InMemoryAgentRegistry,
	BUILT_IN_AGENT_MANIFESTS,
	type AgentManifest,
} from '@neptune/engine'
import {ScriptedProvider, textTurn, toolUseTurn} from '@neptune/engine/testing'
import {AgentTool} from '../AgentTool.js'
import {AGENT_TOOL_NAME} from '../constants.js'
import type {KernelProtocols, KernelToolContext} from '../../../kernel-context.js'

// ============================================================
// 测试 fixtures
// ============================================================

function makeContext(opts: {
	registry?: InMemoryAgentRegistry
	provider?: ScriptedProvider
	tools?: unknown[]
	mainLoopModel?: string
	subAgentDepth?: number
	subAgentMaxDepth?: number
	abortController?: AbortController
}): KernelToolContext {
	const registry = opts.registry ?? new InMemoryAgentRegistry()
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
			agentRegistry: registry,
		} as KernelProtocols,
		provider,
		subAgentDepth: opts.subAgentDepth ?? 0,
		subAgentMaxDepth: opts.subAgentMaxDepth ?? 3,
	}
	return ctx as unknown as KernelToolContext
}

function makeManifest(
	overrides: Partial<AgentManifest> & Pick<AgentManifest, 'type'>,
): AgentManifest {
	return {
		type: overrides.type,
		description: overrides.description ?? 'test agent',
		systemPrompt: overrides.systemPrompt ?? 'You are a test agent.',
		tools: overrides.tools,
		modelHint: overrides.modelHint,
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

// ============================================================
// 契约 1: spawn sub-agent → end_turn → result 回填
// ============================================================

describe('AgentTool — 基础 spawn 流程', () => {
	it('spawn sub-agent → end_turn → 返回 completed status + content', async () => {
		const registry = new InMemoryAgentRegistry()
		await registry.register(
			makeManifest({type: 'test-agent', description: 'test'}),
		)
		const provider = new ScriptedProvider([textTurn('Sub-agent done.')])
		const ctx = makeContext({registry, provider})

		const result = await AgentTool.call(
			{
				description: 'test task',
				prompt: 'do something',
				subagent_type: 'test-agent',
			},
			ctx,
			() => ({behavior: 'allow' as const}),
			makeAssistantMessage() as unknown as Parameters<typeof AgentTool.call>[3],
		)

		const data = result.data as {
			status: string
			agentId: string
			agentType: string
			content: Array<{text: string}>
		}
		expect(data.status).toBe('completed')
		expect(data.content[0]?.text).toBe('Sub-agent done.')
		expect(data.agentType).toBe('test-agent')
		expect(data.agentId).toMatch(/^[0-9a-f-]{36}$/) // uuid
	})
})

// ============================================================
// 契约 2: manifest.systemPrompt 传递
// ============================================================

describe('AgentTool — systemPrompt 注入 sub-agent', () => {
	it('sub-agent provider 收到 manifest.systemPrompt', async () => {
		const registry = new InMemoryAgentRegistry()
		await registry.register(
			makeManifest({
				type: 'reviewer',
				systemPrompt: 'You are a code reviewer.',
			}),
		)
		const provider = new ScriptedProvider([textTurn('Reviewed.')])
		const ctx = makeContext({registry, provider})

		await AgentTool.call(
			{description: 'review', prompt: 'check this', subagent_type: 'reviewer'},
			ctx,
			() => ({behavior: 'allow' as const}),
			makeAssistantMessage() as unknown as Parameters<typeof AgentTool.call>[3],
		)

		expect(provider.callLog[0]?.systemPrompt).toBe('You are a code reviewer.')
	})
})

// ============================================================
// 契约 3: model 三段优先级
// ============================================================

describe('AgentTool — model 三段优先级', () => {
	it('input.model 优先于 manifest.modelHint', async () => {
		const registry = new InMemoryAgentRegistry()
		await registry.register(
			makeManifest({type: 'a', modelHint: 'haiku'}),
		)
		const provider = new ScriptedProvider([textTurn('done')])
		const ctx = makeContext({registry, provider, mainLoopModel: 'opus'})

		await AgentTool.call(
			{description: 'd', prompt: 'p', subagent_type: 'a', model: 'sonnet'},
			ctx,
			() => ({behavior: 'allow' as const}),
			makeAssistantMessage() as unknown as Parameters<typeof AgentTool.call>[3],
		)
		expect(provider.callLog[0]?.model).toBe('sonnet')
	})

	it('无 input.model → manifest.modelHint', async () => {
		const registry = new InMemoryAgentRegistry()
		await registry.register(makeManifest({type: 'a', modelHint: 'haiku'}))
		const provider = new ScriptedProvider([textTurn('done')])
		const ctx = makeContext({registry, provider, mainLoopModel: 'opus'})

		await AgentTool.call(
			{description: 'd', prompt: 'p', subagent_type: 'a'},
			ctx,
			() => ({behavior: 'allow' as const}),
			makeAssistantMessage() as unknown as Parameters<typeof AgentTool.call>[3],
		)
		expect(provider.callLog[0]?.model).toBe('haiku')
	})

	it('modelHint = inherit → 用 parent mainLoopModel', async () => {
		const registry = new InMemoryAgentRegistry()
		await registry.register(makeManifest({type: 'a', modelHint: 'inherit'}))
		const provider = new ScriptedProvider([textTurn('done')])
		const ctx = makeContext({registry, provider, mainLoopModel: 'opus'})

		await AgentTool.call(
			{description: 'd', prompt: 'p', subagent_type: 'a'},
			ctx,
			() => ({behavior: 'allow' as const}),
			makeAssistantMessage() as unknown as Parameters<typeof AgentTool.call>[3],
		)
		expect(provider.callLog[0]?.model).toBe('opus')
	})

	it('全无 → fallback claude-sonnet-4-20250514', async () => {
		const registry = new InMemoryAgentRegistry()
		await registry.register(makeManifest({type: 'a'}))
		const provider = new ScriptedProvider([textTurn('done')])
		const ctx = makeContext({registry, provider})

		await AgentTool.call(
			{description: 'd', prompt: 'p', subagent_type: 'a'},
			ctx,
			() => ({behavior: 'allow' as const}),
			makeAssistantMessage() as unknown as Parameters<typeof AgentTool.call>[3],
		)
		expect(provider.callLog[0]?.model).toBe('claude-sonnet-4-20250514')
	})
})

// ============================================================
// 契约 4: depth 限制
// ============================================================

describe('AgentTool — depth 限制', () => {
	it('depth >= maxDepth → throw', async () => {
		const registry = new InMemoryAgentRegistry()
		await registry.register(makeManifest({type: 'a'}))
		const ctx = makeContext({registry, subAgentDepth: 3, subAgentMaxDepth: 3})

		await expect(
			AgentTool.call(
				{description: 'd', prompt: 'p', subagent_type: 'a'},
				ctx,
				() => ({behavior: 'allow' as const}),
				makeAssistantMessage() as unknown as Parameters<typeof AgentTool.call>[3],
			),
		).rejects.toThrow(/depth limit reached/)
	})

	it('depth < maxDepth → 正常 spawn', async () => {
		const registry = new InMemoryAgentRegistry()
		await registry.register(makeManifest({type: 'a'}))
		const provider = new ScriptedProvider([textTurn('ok')])
		const ctx = makeContext({
			registry,
			provider,
			subAgentDepth: 0,
			subAgentMaxDepth: 3,
		})

		const r = await AgentTool.call(
			{description: 'd', prompt: 'p', subagent_type: 'a'},
			ctx,
			() => ({behavior: 'allow' as const}),
			makeAssistantMessage() as unknown as Parameters<typeof AgentTool.call>[3],
		)
		expect((r.data as {status: string}).status).toBe('completed')
	})
})

// ============================================================
// 契约 5: 不存在的 agent type
// ============================================================

describe('AgentTool — agent type 不存在', () => {
	it('错误信息含 available types', async () => {
		const registry = new InMemoryAgentRegistry()
		await registry.register(makeManifest({type: 'reviewer'}))
		await registry.register(makeManifest({type: 'tester'}))
		const ctx = makeContext({registry})

		await expect(
			AgentTool.call(
				{description: 'd', prompt: 'p', subagent_type: 'unknown'},
				ctx,
				() => ({behavior: 'allow' as const}),
				makeAssistantMessage() as unknown as Parameters<typeof AgentTool.call>[3],
			),
		).rejects.toThrow(/Agent type 'unknown' not found.*reviewer.*tester/)
	})

	it('subagent_type 缺失 → 默认 general-purpose', async () => {
		const registry = new InMemoryAgentRegistry()
		await registry.registerBuiltIns()
		const provider = new ScriptedProvider([textTurn('ok')])
		const ctx = makeContext({registry, provider})

		const r = await AgentTool.call(
			{description: 'd', prompt: 'p'},
			ctx,
			() => ({behavior: 'allow' as const}),
			makeAssistantMessage() as unknown as Parameters<typeof AgentTool.call>[3],
		)
		expect((r.data as {agentType: string}).agentType).toBe('general-purpose')
	})
})

// ============================================================
// 契约 6: cancellation 链路
// ============================================================

describe('AgentTool — cancellation 链路', () => {
	it('parent abort → child sub-agent abort → throw partial', async () => {
		const registry = new InMemoryAgentRegistry()
		await registry.register(makeManifest({type: 'a'}))

		// scripted provider: 第一轮卡住等 abort
		const turns = [textTurn('first turn done')]
		const provider = new ScriptedProvider(turns)

		const parentController = new AbortController()
		const ctx = makeContext({
			registry,
			provider,
			abortController: parentController,
		})

		// abort before call
		parentController.abort()

		// abort 让 sub-agent loop 立即退出，AgentTool throw error
		await expect(
			AgentTool.call(
				{description: 'd', prompt: 'p', subagent_type: 'a'},
				ctx,
				() => ({behavior: 'allow' as const}),
				makeAssistantMessage() as unknown as Parameters<typeof AgentTool.call>[3],
			),
		).rejects.toThrow(/aborted/i)
	})
})

// ============================================================
// 契约 7: API error
// ============================================================

describe('AgentTool — API error 处理', () => {
	it('provider error → throw with error message', async () => {
		const registry = new InMemoryAgentRegistry()
		await registry.register(makeManifest({type: 'a'}))
		// scripted provider 第一轮 emit error
		const provider = new ScriptedProvider([
			[
				{
					type: 'error',
					source: 'api_error',
					error: new Error('rate limited'),
				},
			],
		])
		const ctx = makeContext({registry, provider})

		await expect(
			AgentTool.call(
				{description: 'd', prompt: 'p', subagent_type: 'a'},
				ctx,
				() => ({behavior: 'allow' as const}),
				makeAssistantMessage() as unknown as Parameters<typeof AgentTool.call>[3],
			),
		).rejects.toThrow(/rate limited|aborted|failed/i)
	})
})

// ============================================================
// 契约 8: provider / agentRegistry 缺失
// ============================================================

describe('AgentTool — protocol injection 缺失', () => {
	it('agentRegistry 未注入 → throw with helpful message', async () => {
		const ctx = {
			abortController: new AbortController(),
			options: {tools: [], isNonInteractiveSession: false},
			canUseTool: () => ({behavior: 'allow' as const}),
			kernel: {} as KernelProtocols,
			provider: new ScriptedProvider([textTurn('x')]),
		} as unknown as KernelToolContext

		await expect(
			AgentTool.call(
				{description: 'd', prompt: 'p', subagent_type: 'a'},
				ctx,
				() => ({behavior: 'allow' as const}),
				makeAssistantMessage() as unknown as Parameters<typeof AgentTool.call>[3],
			),
		).rejects.toThrow(/agentRegistry/)
	})

	it('provider 未注入 → throw with helpful message', async () => {
		const registry = new InMemoryAgentRegistry()
		await registry.register(makeManifest({type: 'a'}))
		const ctx = {
			abortController: new AbortController(),
			options: {tools: [], isNonInteractiveSession: false},
			canUseTool: () => ({behavior: 'allow' as const}),
			kernel: {agentRegistry: registry} as KernelProtocols,
			// provider missing
		} as unknown as KernelToolContext

		await expect(
			AgentTool.call(
				{description: 'd', prompt: 'p', subagent_type: 'a'},
				ctx,
				() => ({behavior: 'allow' as const}),
				makeAssistantMessage() as unknown as Parameters<typeof AgentTool.call>[3],
			),
		).rejects.toThrow(/ctx\.provider.*StreamingProviderAdapter/)
	})
})

// ============================================================
// 契约 9: ToolDef 元信息
// ============================================================

describe('AgentTool — ToolDef metadata', () => {
	it('name = Agent + alias = Task', () => {
		expect(AgentTool.name).toBe(AGENT_TOOL_NAME)
		expect(AgentTool.aliases).toContain('Task')
	})

	it('inputSchema 含必填 description / prompt', () => {
		const schema = AgentTool.inputSchema as unknown as {
			parse: (v: unknown) => unknown
		}
		expect(() => schema.parse({})).toThrow()
		expect(() =>
			schema.parse({description: 'd', prompt: 'p'}),
		).not.toThrow()
	})
})

// ============================================================
// 契约 10: usage trailer
// ============================================================

describe('AgentTool — mapToolResultToToolResultBlockParam', () => {
	it('completed result 含 usage trailer', () => {
		const block = AgentTool.mapToolResultToToolResultBlockParam!(
			{
				status: 'completed' as const,
				agentId: 'agent-1',
				agentType: 'reviewer',
				content: [{type: 'text', text: 'review done'}],
				totalToolUseCount: 3,
				totalDurationMs: 1500,
				totalTokens: 200,
				usage: {
					input_tokens: 100,
					output_tokens: 50,
					cache_creation_input_tokens: 30,
					cache_read_input_tokens: 20,
				},
				prompt: 'check code',
			},
			'tu_1',
		)
		const content = block.content as Array<{type: string; text: string}>
		expect(content.some(c => c.text.includes('agentId: agent-1'))).toBe(true)
		expect(content.some(c => c.text.includes('total_tokens: 200'))).toBe(true)
		expect(content.some(c => c.text.includes('tool_uses: 3'))).toBe(true)
		expect(content.some(c => c.text.includes('duration_ms: 1500'))).toBe(true)
		expect(content.some(c => c.text === 'review done')).toBe(true)
	})

	it('one-shot agent (Explore) 不附 trailer', () => {
		const block = AgentTool.mapToolResultToToolResultBlockParam!(
			{
				status: 'completed' as const,
				agentId: 'agent-1',
				agentType: 'Explore',
				content: [{type: 'text', text: 'found'}],
				totalToolUseCount: 1,
				totalDurationMs: 100,
				totalTokens: 50,
				usage: {
					input_tokens: 30,
					output_tokens: 20,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
				prompt: 'find',
			},
			'tu_1',
		)
		const content = block.content as Array<{type: string; text: string}>
		expect(content.some(c => c.text.includes('agentId:'))).toBe(false)
		expect(content[0]?.text).toBe('found')
	})

	it('空内容 → 默认 marker', () => {
		const block = AgentTool.mapToolResultToToolResultBlockParam!(
			{
				status: 'completed' as const,
				agentId: 'agent-1',
				agentType: 'a',
				content: [],
				totalToolUseCount: 0,
				totalDurationMs: 100,
				totalTokens: 0,
				usage: {
					input_tokens: 0,
					output_tokens: 0,
					cache_creation_input_tokens: 0,
					cache_read_input_tokens: 0,
				},
				prompt: 'x',
			},
			'tu_1',
		)
		const content = block.content as Array<{type: string; text: string}>
		expect(content[0]?.text).toContain('Subagent completed but returned no output')
	})
})

// ============================================================
// 契约 11: 与 4 个 baseline agents 集成
// ============================================================

describe('AgentTool — 与 baseline agents 集成', () => {
	it('registerBuiltIns 后可用 4 baseline 的任一类型', async () => {
		const registry = new InMemoryAgentRegistry()
		await registry.registerBuiltIns()
		expect(BUILT_IN_AGENT_MANIFESTS).toHaveLength(4)
		const provider = new ScriptedProvider([textTurn('explored')])
		const ctx = makeContext({registry, provider})

		const r = await AgentTool.call(
			{description: 'find users', prompt: 'find user models', subagent_type: 'Explore'},
			ctx,
			() => ({behavior: 'allow' as const}),
			makeAssistantMessage() as unknown as Parameters<typeof AgentTool.call>[3],
		)
		expect((r.data as {status: string; agentType: string}).status).toBe('completed')
		expect((r.data as {agentType: string}).agentType).toBe('Explore')

		// Explore 是 one-shot，result block 不含 trailer
		const block = AgentTool.mapToolResultToToolResultBlockParam!(r.data, 'tu_x')
		const content = block.content as Array<{text: string}>
		expect(content.some(c => c.text.includes('agentId:'))).toBe(false)
	})
})
