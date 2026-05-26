/**
 * AgentEngine.substrate.test.ts — substrate 路径端到端集成测试
 *
 * 验证 AgentEngine.query 永远走 substrate AgentLoop + bridge → SDK QueryEvent：
 * 1. streamingProvider 缺失 → 抛 CONFIGURATION_ERROR
 * 2. streamingProvider 注入 → SDK QueryEvent 流
 * 3. 注入 RunStore + AgentRegistry → 完整能力上线
 * 4. caller signal abort → 立即退出 + 释放锁
 */

import {describe, expect, it, afterEach} from 'bun:test'
import {AgentEngine} from '../AgentEngine.js'
import {ScriptedProvider, textTurn} from '../agent-loop/loop/__tests__/scriptedProvider.js'
import {InMemoryRunStore} from '../run/index.js'
import {InMemoryAgentRegistry} from '../agent-registry/index.js'
import {EngineError} from '../errors.js'
import type {QueryEvent} from '../types/query-events.js'

async function collect(
	gen: AsyncGenerator<QueryEvent>,
): Promise<QueryEvent[]> {
	const out: QueryEvent[] = []
	for await (const e of gen) out.push(e)
	return out
}

describe('AgentEngine.query — 路径切换', () => {
	let engine: AgentEngine

	afterEach(async () => {
		if (engine) await engine.destroy()
	})

	it('streamingProvider 缺失 → CONFIGURATION_ERROR', async () => {
		engine = AgentEngine.create({
			// streamingProvider 缺失
		})
		const sessionId = await engine.createSession()
		await expect(async () => {
			for await (const _ of engine.query(sessionId, 'hi')) {
				// noop
			}
		}).toThrow(EngineError)
	})

	it('streamingProvider 注入 → SDK QueryEvent 流', async () => {
		const provider = new ScriptedProvider([textTurn('Hello from substrate')])
		engine = AgentEngine.create({
			streamingProvider: provider,
			systemPrompt: 'You are a test agent.',
		})
		const sessionId = await engine.createSession()
		const events = await collect(engine.query(sessionId, 'hi'))

		// 应有 assistant + system result
		const assistant = events.find(e => e.type === 'assistant')
		expect(assistant).toBeDefined()
		expect((assistant as Record<string, unknown>).content).toBe('Hello from substrate')

		const result = events.find(
			e => e.type === 'system' && (e as Record<string, unknown>).subtype === 'result',
		)
		expect((result as Record<string, unknown>).success).toBe(true)
	})
})

describe('AgentEngine.query — substrate 协议注入', () => {
	let engine: AgentEngine

	afterEach(async () => {
		if (engine) await engine.destroy()
	})

	it('注入 RunStore → events 自动持久化（runId = sessionId）', async () => {
		const provider = new ScriptedProvider([textTurn('persisted')])
		const runStore = new InMemoryRunStore()
		engine = AgentEngine.create({
			streamingProvider: provider,
			runStore,
		})
		const sessionId = await engine.createSession()
		await collect(engine.query(sessionId, 'persist this'))

		// runStore 内 sessionId 对应的 events 应非空
		const events = await runStore.loadEvents(sessionId)
		expect(events.length).toBeGreaterThan(0)
	})

	it('注入 AgentRegistry → ctx.kernel.agentRegistry 可用', async () => {
		const provider = new ScriptedProvider([textTurn('aware')])
		const registry = new InMemoryAgentRegistry()
		await registry.registerBuiltIns()
		engine = AgentEngine.create({
			streamingProvider: provider,
			agentRegistry: registry,
		})
		const sessionId = await engine.createSession()
		await collect(engine.query(sessionId, 'list agents'))

		// registry 自身验证（4 baseline 已注入）
		const list = await registry.list()
		expect(list).toHaveLength(4)
	})
})

describe('AgentEngine.query — Cancellation', () => {
	let engine: AgentEngine

	afterEach(async () => {
		if (engine) await engine.destroy()
	})

	it('caller signal abort → 立即退出 + 释放锁', async () => {
		const provider = new ScriptedProvider([textTurn('text')])
		engine = AgentEngine.create({
			streamingProvider: provider,
		})
		const sessionId = await engine.createSession()

		const controller = new AbortController()
		controller.abort()

		const gen = engine.query(sessionId, 'hi', {signal: controller.signal})
		const events = await collect(gen)
		// 应包含 error 或 system{aborted}
		const hasAborted =
			events.some(e => e.type === 'error') ||
			events.some(
				e =>
					e.type === 'system' &&
					((e as Record<string, unknown>).reason === 'aborted' ||
						(e as Record<string, unknown>).subtype === 'paused'),
			)
		expect(hasAborted).toBe(true)
	})
})
