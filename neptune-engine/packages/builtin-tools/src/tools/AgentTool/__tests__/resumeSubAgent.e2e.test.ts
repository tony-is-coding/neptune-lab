/**
 * resumeSubAgent.e2e.test.ts — P0.3b 端到端测试
 *
 * 验证 sub-agent resume 协议化（cc resumeAgent.ts 等价能力）：
 * 1. 实例 A spawn → 完成 → 实例 B resume 续跑 → end_turn
 * 2. resume 不存在的 runId → throw
 * 3. RunStore 缺失 metadata.agentType → throw helpful
 * 4. AgentRegistry 中 agent type 不存在 → throw helpful
 * 5. 跨实例 events 在 jsonl 顺序追加（不覆盖）
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {FileRunStore, InMemoryRunStore} from '../../../../../../src/engine/run/index.js'
import {InMemoryAgentRegistry} from '../../../../../../src/engine/agent-registry/index.js'
import type {AgentManifest} from '../../../../../../src/engine/agent-registry/index.js'
import type {Tool} from '../../../../../../src/engine/types/tool.js'
import {createToolUseContext} from '../../../../../../src/engine/agent-loop/dispatcher/ToolUseContext.js'
import {ScriptedProvider, textTurn} from '@neptune/engine/testing'
import {launchSubAgentInBackground} from '../runSubAgentBackground.js'
import {resumeSubAgent} from '../resumeSubAgent.js'

function makeManifest(
	overrides: Partial<AgentManifest> & Pick<AgentManifest, 'type'>,
): AgentManifest {
	return {
		type: overrides.type,
		description: overrides.description ?? 'test',
		systemPrompt: overrides.systemPrompt ?? 'You are a test agent.',
		tools: overrides.tools,
		modelHint: overrides.modelHint,
		metadata: overrides.metadata,
	}
}

describe('resumeSubAgent — 跨实例 resume', () => {
	it('实例 A spawn 完成 → 实例 B resume 续跑 → end_turn', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'nep-resume-'))
		try {
			// 实例 A 部分
			const storeA = new FileRunStore(dir)
			const registryA = new InMemoryAgentRegistry()
			await registryA.register(makeManifest({type: 'reviewer'}))
			const providerA = new ScriptedProvider([textTurn('first turn done')])
			const ctxA = createToolUseContext()

			const launched = await launchSubAgentInBackground({
				manifest: makeManifest({type: 'reviewer'}),
				prompt: 'review',
				model: 'm',
				provider: providerA,
				tools: [] as unknown as Tool[],
				parentContext: ctxA,
				agentId: randomUUID(),
				startTime: Date.now(),
				runStore: storeA,
			})
			await launched.background

			// 实例 B 部分（独立 store / registry / provider）
			const storeB = new FileRunStore(dir)
			const registryB = new InMemoryAgentRegistry()
			await registryB.register(makeManifest({type: 'reviewer'}))
			const providerB = new ScriptedProvider([textTurn('continued in B')])
			const ctxB = createToolUseContext()

			const result = await resumeSubAgent({
				runStore: storeB,
				runId: launched.runId,
				agentRegistry: registryB,
				prompt: 'continue',
				model: 'm',
				provider: providerB,
				tools: [] as unknown as Tool[],
				parentContext: ctxB,
				startTime: Date.now(),
			})
			expect(result.reason).toBe('end_turn')
			expect(result.manifest.type).toBe('reviewer')
		} finally {
			await rm(dir, {recursive: true, force: true})
		}
	})

	it('resume 不存在的 runId → throw', async () => {
		const store = new InMemoryRunStore()
		const registry = new InMemoryAgentRegistry()
		const provider = new ScriptedProvider([textTurn('x')])
		const ctx = createToolUseContext()

		await expect(
			resumeSubAgent({
				runStore: store,
				runId: 'nope',
				agentRegistry: registry,
				prompt: 'x',
				model: 'm',
				provider,
				tools: [],
				parentContext: ctx,
				startTime: Date.now(),
			}),
		).rejects.toThrow(/Run not found/)
	})

	it('run.metadata.agentType 缺失 → throw helpful', async () => {
		const store = new InMemoryRunStore()
		const run = await store.create() // 没有 metadata.agentType
		const registry = new InMemoryAgentRegistry()
		const provider = new ScriptedProvider([textTurn('x')])
		const ctx = createToolUseContext()

		await expect(
			resumeSubAgent({
				runStore: store,
				runId: run.id,
				agentRegistry: registry,
				prompt: 'x',
				model: 'm',
				provider,
				tools: [],
				parentContext: ctx,
				startTime: Date.now(),
			}),
		).rejects.toThrow(/no agentType metadata/)
	})

	it('agentRegistry 中没有对应 agentType → throw helpful', async () => {
		const store = new InMemoryRunStore()
		const run = await store.create({metadata: {agentType: 'unknown'}})
		const registry = new InMemoryAgentRegistry()
		const provider = new ScriptedProvider([textTurn('x')])
		const ctx = createToolUseContext()

		await expect(
			resumeSubAgent({
				runStore: store,
				runId: run.id,
				agentRegistry: registry,
				prompt: 'x',
				model: 'm',
				provider,
				tools: [],
				parentContext: ctx,
				startTime: Date.now(),
			}),
		).rejects.toThrow(/Agent type 'unknown' not found/)
	})

	it('resume 后 events 在 jsonl 顺序追加（不覆盖）', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'nep-resume-events-'))
		try {
			const storeA = new FileRunStore(dir)
			const registry = new InMemoryAgentRegistry()
			await registry.register(makeManifest({type: 'a'}))
			const providerA = new ScriptedProvider([textTurn('A done')])
			const ctxA = createToolUseContext()

			const launched = await launchSubAgentInBackground({
				manifest: makeManifest({type: 'a'}),
				prompt: 'first',
				model: 'm',
				provider: providerA,
				tools: [] as unknown as Tool[],
				parentContext: ctxA,
				agentId: randomUUID(),
				startTime: Date.now(),
				runStore: storeA,
			})
			await launched.background

			const eventsAfterA = await storeA.loadEvents(launched.runId)
			const aLen = eventsAfterA.length

			// resume
			const storeB = new FileRunStore(dir)
			const providerB = new ScriptedProvider([textTurn('B done')])
			const ctxB = createToolUseContext()
			await resumeSubAgent({
				runStore: storeB,
				runId: launched.runId,
				agentRegistry: registry,
				prompt: 'second',
				model: 'm',
				provider: providerB,
				tools: [],
				parentContext: ctxB,
				startTime: Date.now(),
			})

			const eventsAfterB = await storeB.loadEvents(launched.runId)
			expect(eventsAfterB.length).toBeGreaterThan(aLen)
			// 前 aLen 个保留
			for (let i = 0; i < aLen; i++) {
				expect(eventsAfterB[i]?.type).toBe(eventsAfterA[i]?.type)
			}
		} finally {
			await rm(dir, {recursive: true, force: true})
		}
	})
})
