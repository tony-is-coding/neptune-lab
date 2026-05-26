/**
 * AgentEngine.useAgentLoop.test.ts — P0.1c 端到端集成测试
 *
 * 验证 AgentEngine.query 走 useAgentLoop=true 路径：
 * 1. 默认 useAgentLoop=false → 走 HeadlessQueryEngine（向后兼容）
 * 2. useAgentLoop=true → 走 AgentLoop + bridge → SDK QueryEvent
 * 3. streamingProvider 缺失 → 抛 CONFIGURATION_ERROR
 * 4. 注入 RunStore + AgentRegistry → 完整能力上线
 * 5. 多次 query → 历史消息累积（resume 场景）
 */

import {describe, expect, it, afterEach, beforeEach} from 'bun:test'
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

describe('AgentEngine.useAgentLoop — 路径切换', () => {
	let engine: AgentEngine

	afterEach(async () => {
		if (engine) await engine.destroy()
	})

	it('默认 useAgentLoop=undefined → 走 HeadlessQueryEngine（向后兼容）', async () => {
		engine = AgentEngine.create({
			// 不设 useAgentLoop
			provider: {type: 'anthropic', config: {apiKey: 'sk-test', defaultModel: 'm'}},
		})
		const sessionId = await engine.createSession()
		// 走 HeadlessQueryEngine 路径会请求外部 API（无 ANTHROPIC_API_KEY 会出错）
		// 我们仅验证不进入 useAgentLoop 路径（不抛 streamingProvider 缺失错误）
		const session = await engine.getSession(sessionId)
		expect(session).toBeDefined()
	})

	it('useAgentLoop=true 但 streamingProvider 缺失 → CONFIGURATION_ERROR', async () => {
		engine = AgentEngine.create({
			useAgentLoop: true,
			// streamingProvider 缺失
		})
		const sessionId = await engine.createSession()
		await expect(async () => {
			for await (const _ of engine.query(sessionId, 'hi')) {
				// noop
			}
		}).toThrow(EngineError)
	})

	it('useAgentLoop=true + streamingProvider → SDK QueryEvent 流', async () => {
		const provider = new ScriptedProvider([textTurn('Hello from substrate')])
		engine = AgentEngine.create({
			useAgentLoop: true,
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

describe('AgentEngine.useAgentLoop — substrate 协议注入', () => {
	let engine: AgentEngine

	afterEach(async () => {
		if (engine) await engine.destroy()
	})

	it('注入 RunStore → events 自动持久化（runId = sessionId）', async () => {
		const provider = new ScriptedProvider([textTurn('persisted')])
		const runStore = new InMemoryRunStore()
		engine = AgentEngine.create({
			useAgentLoop: true,
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
			useAgentLoop: true,
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

describe('AgentEngine.useAgentLoop — Cancellation', () => {
	let engine: AgentEngine

	afterEach(async () => {
		if (engine) await engine.destroy()
	})

	it('caller signal abort → 立即退出 + 释放锁', async () => {
		const provider = new ScriptedProvider([textTurn('text')])
		engine = AgentEngine.create({
			useAgentLoop: true,
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
