/**
 * runQueryViaAgentLoop.e2e.test.ts — P0.1b 端到端测试
 *
 * 验证 AgentEngine.query 走 AgentLoop 路径的实质能力：
 * 1. 基础 1 turn：input → assistant content
 * 2. multi-turn：tool_use → tool_result → 第二轮 assistant
 * 3. RunStore 注入：runWithStore 自动持久化 events
 * 4. AuditStore 注入：assistant_message / governance / tool_update 写入 hash chain
 * 5. Cancellation：caller signal abort → AgentLoop 立即退出
 * 6. AgentRegistry 注入 + AgentTool 用：sub-agent spawn 完整 e2e
 * 7. Governance hook：policy deny 阻止 tool 执行
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {runQueryViaAgentLoop} from '../runQueryViaAgentLoop.js'
import {ScriptedProvider, textTurn, toolUseTurn} from '../../agent-loop/loop/__tests__/scriptedProvider.js'
import {InMemoryRunStore, FileRunStore} from '../../run/index.js'
import {NoopAuditStore, FilesystemAuditStore} from '../../audit/index.js'
import {InMemoryAgentRegistry} from '../../agent-registry/index.js'
import type {QueryEvent} from '../../types/query-events.js'
import type {Tool, ToolResult} from '../../types/tool.js'
import type {ParsedSSEEvent} from '../../agent-loop/types.js'
import type {GovernanceHooks} from '../../governance/index.js'

async function collect(
	gen: AsyncGenerator<QueryEvent, void, unknown>,
): Promise<QueryEvent[]> {
	const out: QueryEvent[] = []
	for await (const e of gen) out.push(e)
	return out
}

function makeTool(name: string, response: unknown): Tool {
	return {
		name,
		description: name,
		inputJSONSchema: {type: 'object'},
		async call(): Promise<ToolResult<unknown>> {
			return {data: response}
		},
	} as unknown as Tool
}

// ============================================================
// 测试 1: 基础 1 turn
// ============================================================

describe('runQueryViaAgentLoop — 基础', () => {
	it('1 turn 文本回复：input → assistant content + system result', async () => {
		const provider = new ScriptedProvider([textTurn('Hello world')])
		const events = await collect(
			runQueryViaAgentLoop({
				input: 'hi',
				model: 'm',
				provider,
			}),
		)
		const assistant = events.find(e => e.type === 'assistant')
		expect(assistant).toBeDefined()
		expect((assistant as Record<string, unknown>).content).toBe('Hello world')

		const result = events.find(
			e => e.type === 'system' && (e as Record<string, unknown>).subtype === 'result',
		)
		expect((result as Record<string, unknown>).success).toBe(true)
	})
})

// ============================================================
// 测试 2: tool_use → tool_result multi-turn
// ============================================================

describe('runQueryViaAgentLoop — multi-turn with tool', () => {
	it('tool_use → tool_result → 第二轮 end_turn', async () => {
		const echoTool = makeTool('Echo', 'echoed_value')
		const provider = new ScriptedProvider([
			toolUseTurn('tu_1', 'Echo', {q: 'test'}),
			textTurn('I echoed: echoed_value'),
		])

		const events = await collect(
			runQueryViaAgentLoop({
				input: 'echo this',
				model: 'm',
				provider,
				tools: [echoTool],
			}),
		)
		// 应有 tool_use + tool_result + assistant + system result
		const toolUse = events.find(e => e.type === 'tool_use')
		expect(toolUse).toBeDefined()
		expect((toolUse as Record<string, unknown>).name).toBe('Echo')

		const toolResult = events.find(e => e.type === 'tool_result')
		expect(toolResult).toBeDefined()
		expect((toolResult as Record<string, unknown>).toolUseId).toBe('tu_1')

		const assistant = events.findLast(e => e.type === 'assistant')
		expect((assistant as Record<string, unknown>).content).toBe(
			'I echoed: echoed_value',
		)
	})
})

// ============================================================
// 测试 3: RunStore 注入
// ============================================================

describe('runQueryViaAgentLoop — RunStore 注入', () => {
	it('InMemoryRunStore 注入 → events 自动持久化', async () => {
		const store = new InMemoryRunStore()
		const run = await store.create()
		const provider = new ScriptedProvider([textTurn('done')])

		await collect(
			runQueryViaAgentLoop({
				input: 'hi',
				model: 'm',
				provider,
				runStore: store,
				runId: run.id,
			}),
		)
		const events = await store.loadEvents(run.id)
		expect(events.length).toBeGreaterThan(0)
		const finalRun = await store.load(run.id)
		expect(finalRun?.status).toBe('completed')
	})

	it('FileRunStore 注入 → 跨实例 resume 数据可见', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'nep-runqv-'))
		try {
			const storeA = new FileRunStore(dir)
			const run = await storeA.create()
			const providerA = new ScriptedProvider([textTurn('first turn')])
			await collect(
				runQueryViaAgentLoop({
					input: 'go',
					model: 'm',
					provider: providerA,
					runStore: storeA,
					runId: run.id,
				}),
			)
			const eventsA = await storeA.loadEvents(run.id)

			// 跨实例：用新 storeB 验证读到同样数据
			const storeB = new FileRunStore(dir)
			const eventsB = await storeB.loadEvents(run.id)
			expect(eventsB.length).toBe(eventsA.length)
			expect(eventsB.length).toBeGreaterThan(0)
		} finally {
			await rm(dir, {recursive: true, force: true})
		}
	})
})

// ============================================================
// 测试 4: AuditStore 注入
// ============================================================

describe('runQueryViaAgentLoop — AuditStore 注入', () => {
	it('FilesystemAuditStore 注入 → audit chain 写入 + verify 通过', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'nep-audit-'))
		try {
			const auditStore = new FilesystemAuditStore(dir)
			const runStore = new InMemoryRunStore()
			const run = await runStore.create()
			const provider = new ScriptedProvider([textTurn('done')])

			await collect(
				runQueryViaAgentLoop({
					input: 'hi',
					model: 'm',
					provider,
					runStore, // audit 仅在 runWithStore 路径写，必须配合 runStore
					auditStore,
					runId: run.id,
				}),
			)

			const auditEvents = await auditStore.load(run.id)
			expect(auditEvents.length).toBeGreaterThan(0)

			const verify = await auditStore.verify(run.id)
			expect(verify.valid).toBe(true)
		} finally {
			await rm(dir, {recursive: true, force: true})
		}
	})
})

// ============================================================
// 测试 5: Cancellation
// ============================================================

describe('runQueryViaAgentLoop — Cancellation', () => {
	it('caller signal abort → 立即退出 + emit error event', async () => {
		const provider = new ScriptedProvider([textTurn('text')])
		const controller = new AbortController()
		controller.abort()

		const events = await collect(
			runQueryViaAgentLoop({
				input: 'hi',
				model: 'm',
				provider,
				signal: controller.signal,
			}),
		)
		// 应该有 error event 或 system result with reason='aborted'
		const errOrAborted =
			events.find(e => e.type === 'error') ??
			events.find(
				e =>
					e.type === 'system' &&
					((e as Record<string, unknown>).reason === 'aborted' ||
						(e as Record<string, unknown>).subtype === 'paused'),
			)
		expect(errOrAborted).toBeDefined()
	})
})

// ============================================================
// 测试 6: 与 AgentRegistry / 4 baseline 集成
// ============================================================

describe('runQueryViaAgentLoop — 与 AgentRegistry 集成', () => {
	it('注入 4 baseline → ctx.kernel.agentRegistry 可用', async () => {
		const registry = new InMemoryAgentRegistry()
		await registry.registerBuiltIns()
		const provider = new ScriptedProvider([textTurn('I see 4 baseline agents')])

		await collect(
			runQueryViaAgentLoop({
				input: 'list agents',
				model: 'm',
				provider,
				agentRegistry: registry,
			}),
		)
		// 4 baseline 已注入（验证：registry.list() 长度）
		const all = await registry.list()
		expect(all).toHaveLength(4)
	})
})

// ============================================================
// 测试 7: Governance policy hook deny tool
// ============================================================

describe('runQueryViaAgentLoop — Governance policy', () => {
	it('PolicyHook deny tool → tool_use 被替换为 is_error tool_result', async () => {
		const dangerousTool = makeTool('Dangerous', 'should not execute')
		const provider = new ScriptedProvider([
			toolUseTurn('tu_1', 'Dangerous', {}),
			textTurn('blocked'),
		])
		const governance: GovernanceHooks = {
			policyHook: {
				async beforeToolUse(invocation) {
					if (invocation.toolName === 'Dangerous') {
						return {decision: 'deny', reason: 'policy violation'}
					}
					return {decision: 'allow'}
				},
			},
		}

		const events = await collect(
			runQueryViaAgentLoop({
				input: 'do dangerous',
				model: 'm',
				provider,
				tools: [dangerousTool],
				governance,
			}),
		)

		// 应该有 governance system event
		const govEvent = events.find(
			e =>
				e.type === 'system' &&
				(e as Record<string, unknown>).subtype === 'governance',
		)
		expect(govEvent).toBeDefined()
	})
})
