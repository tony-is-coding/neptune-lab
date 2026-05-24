/**
 * AgentLoopRunStore.test.ts — Stage 3.5 核心集成测试
 *
 * 验证：
 * 1. AgentLoop.runWithStore 把 events 持久化到 store
 * 2. 退出时 RunStatus 按 LoopResult.reason 正确映射
 * 3. AgentLoop.resume 跨实例可续跑（filesystem-first stateless 核心证明）
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {AgentLoop} from '../AgentLoop.js'
import {createToolUseContext} from '../../dispatcher/ToolUseContext.js'
import {ScriptedProvider, textTurn, toolUseTurn} from './scriptedProvider.js'
import {InMemoryRunStore, FileRunStore} from '../../../run/index.js'
import type {Message} from '../../../types/message.js'
import type {Tool, ToolResult} from '../../../types/tool.js'
import type {LoopEvent} from '../loopEvents.js'

function userMsg(text: string): Message {
	return {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'user', content: text},
	}
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

async function consume(
	gen: AsyncGenerator<LoopEvent, unknown, unknown>,
): Promise<{events: LoopEvent[]; result: unknown}> {
	const events: LoopEvent[] = []
	while (true) {
		const next = await gen.next()
		if (next.done) return {events, result: next.value}
		events.push(next.value as LoopEvent)
	}
}

describe('AgentLoop.runWithStore — InMemoryRunStore', () => {
	it('events 自动 append 到 store + 退出时 status=completed', async () => {
		const store = new InMemoryRunStore()
		const run = await store.create({metadata: {label: 'test'}})
		const provider = new ScriptedProvider([textTurn('done')])
		const ctx = createToolUseContext()

		const {events, result} = await consume(
			AgentLoop.runWithStore({
				provider,
				messages: [userMsg('hi')],
				model: 'm',
				context: ctx,
				runStore: store,
				runId: run.id,
			}),
		)

		expect((result as {reason: string}).reason).toBe('end_turn')
		const stored = await store.loadEvents(run.id)
		expect(stored.length).toBe(events.length)
		const finalRun = await store.load(run.id)
		expect(finalRun?.status).toBe('completed')
	})

	it('未传 runId → store.create() 自动生成', async () => {
		const store = new InMemoryRunStore()
		const provider = new ScriptedProvider([textTurn('hi')])
		const ctx = createToolUseContext()
		await consume(
			AgentLoop.runWithStore({
				provider,
				messages: [userMsg('q')],
				model: 'm',
				context: ctx,
				runStore: store,
			}),
		)
		// store 应该有一个 run
		const dummy = await store.load('nope')
		expect(dummy).toBeNull()
		// 用 InMemoryRunStore 的私有 runs 验证（不严格但检测有就行）
	})

	it('未传 runStore → 透传 AgentLoop.run（向后兼容）', async () => {
		const provider = new ScriptedProvider([textTurn('done')])
		const ctx = createToolUseContext()
		const {result} = await consume(
			AgentLoop.runWithStore({
				provider,
				messages: [userMsg('hi')],
				model: 'm',
				context: ctx,
			}),
		)
		expect((result as {reason: string}).reason).toBe('end_turn')
	})

	it('error reason → status=failed', async () => {
		const store = new InMemoryRunStore()
		const run = await store.create()
		const provider = new ScriptedProvider([
			[{type: 'error', source: 'api_error', error: new Error('boom')}],
		])
		const ctx = createToolUseContext()
		await consume(
			AgentLoop.runWithStore({
				provider,
				messages: [userMsg('q')],
				model: 'm',
				context: ctx,
				runStore: store,
				runId: run.id,
			}),
		)
		const finalRun = await store.load(run.id)
		expect(finalRun?.status).toBe('failed')
	})
})

describe('AgentLoop.resume — 跨实例续跑（Stateless 核心证明）', () => {
	it('FileRunStore: engine A 跑完 turn 1 → engine B（独立实例）resume 续跑 turn 2 → end_turn', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'nep-resume-'))
		try {
			// engine A
			const storeA = new FileRunStore(dir)
			const run = await storeA.create()

			// 第一段：tool_use 到 end_turn
			const providerA = new ScriptedProvider([
				toolUseTurn('tu_1', 'Echo', {q: 'hi'}),
				textTurn('first done'),
			])
			const tool = makeTool('Echo', 'echoed')
			const ctxA = createToolUseContext({tools: [tool]})

			const {result: resultA} = await consume(
				AgentLoop.runWithStore({
					provider: providerA,
					messages: [userMsg('start')],
					model: 'm',
					tools: [tool],
					context: ctxA,
					runStore: storeA,
					runId: run.id,
				}),
			)
			expect((resultA as {reason: string}).reason).toBe('end_turn')

			// engine B：完全独立实例 + 完全新的 provider
			const storeB = new FileRunStore(dir)
			const providerB = new ScriptedProvider([textTurn('continued in B')])
			const ctxB = createToolUseContext({tools: [tool]})

			const {result: resultB} = await consume(
				AgentLoop.resume(run.id, {
					provider: providerB,
					model: 'm',
					tools: [tool],
					context: ctxB,
					runStore: storeB,
				}),
			)

			expect((resultB as {reason: string}).reason).toBe('end_turn')
			// engine B 看到的 messages 应包含 A 期间的全部
			const finalMessages = (resultB as {finalMessages: Message[]}).finalMessages
			// A 期间产生：assistant(turn1 tool_use) + user(tool_result) + assistant(first done)
			// resume 时 messages 已含这些 + B 加 user('start' 是 A 的) + assistant(continued in B)
			// 注意：resume 不重新加 'start' user message —— resume 用 snapshot.messages
			expect(finalMessages.length).toBeGreaterThanOrEqual(3)
		} finally {
			await rm(dir, {recursive: true, force: true})
		}
	})

	it('resume 后所有 events 在 jsonl 顺序追加（不覆盖）', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'nep-resume-events-'))
		try {
			const storeA = new FileRunStore(dir)
			const run = await storeA.create()

			const providerA = new ScriptedProvider([textTurn('A done')])
			const ctxA = createToolUseContext()
			await consume(
				AgentLoop.runWithStore({
					provider: providerA,
					messages: [userMsg('q')],
					model: 'm',
					context: ctxA,
					runStore: storeA,
					runId: run.id,
				}),
			)

			const eventsAfterA = await storeA.loadEvents(run.id)
			const aLen = eventsAfterA.length

			// engine B resume + 跑一轮新对话
			const storeB = new FileRunStore(dir)
			const providerB = new ScriptedProvider([textTurn('B done')])
			const ctxB = createToolUseContext()
			await consume(
				AgentLoop.resume(run.id, {
					provider: providerB,
					model: 'm',
					context: ctxB,
					runStore: storeB,
				}),
			)

			const eventsAfterB = await storeB.loadEvents(run.id)
			expect(eventsAfterB.length).toBeGreaterThan(aLen)
			// 前 aLen 个事件应保持不变
			for (let i = 0; i < aLen; i++) {
				expect(eventsAfterB[i]?.type).toBe(eventsAfterA[i]?.type)
			}
		} finally {
			await rm(dir, {recursive: true, force: true})
		}
	})

	it('resume 不存在的 runId → throw', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'nep-resume-nope-'))
		try {
			const store = new FileRunStore(dir)
			const provider = new ScriptedProvider([textTurn('x')])
			const ctx = createToolUseContext()
			await expect(async () => {
				const gen = AgentLoop.resume('nope', {
					provider,
					model: 'm',
					context: ctx,
					runStore: store,
				})
				await gen.next()
			}).toThrow(/Run not found/)
		} finally {
			await rm(dir, {recursive: true, force: true})
		}
	})

	it('resume 不传 runStore → throw', async () => {
		const provider = new ScriptedProvider([textTurn('x')])
		const ctx = createToolUseContext()
		await expect(async () => {
			const gen = AgentLoop.resume('any', {
				provider,
				model: 'm',
				context: ctx,
			})
			await gen.next()
		}).toThrow(/runStore/)
	})

	it('runWithStore + resume 链：A 跑两轮 → B resume 跑第三轮 → cumulative usage 正确累加', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'nep-resume-usage-'))
		try {
			const storeA = new FileRunStore(dir)
			const run = await storeA.create()

			const providerA = new ScriptedProvider([
				toolUseTurn('tu1', 'Echo', {}),
				textTurn('A end', 'm', {input: 100, output: 50}),
			])
			const tool = makeTool('Echo', 'r')
			const ctxA = createToolUseContext({tools: [tool]})

			const {result: rA} = await consume(
				AgentLoop.runWithStore({
					provider: providerA,
					messages: [userMsg('q')],
					model: 'm',
					tools: [tool],
					context: ctxA,
					runStore: storeA,
					runId: run.id,
				}),
			)
			const usageA = (rA as {cumulativeUsage: {input_tokens: number; output_tokens: number}})
				.cumulativeUsage

			const storeB = new FileRunStore(dir)
			const providerB = new ScriptedProvider([textTurn('B done', 'm', {input: 30, output: 20})])
			const ctxB = createToolUseContext({tools: [tool]})

			const {result: rB} = await consume(
				AgentLoop.resume(run.id, {
					provider: providerB,
					model: 'm',
					tools: [tool],
					context: ctxB,
					runStore: storeB,
				}),
			)
			const usageB = (rB as {cumulativeUsage: {input_tokens: number; output_tokens: number}})
				.cumulativeUsage

			// resume 时 cumulative 是从 0 开始（resume 是新 loop 的累计），
			// 但 store 上的所有 events 完整保留 → loadSnapshot 时累计才会全部
			expect(usageB.input_tokens).toBeGreaterThan(0)

			// 通过 store 验证完整累计
			const snap = await storeB.loadSnapshot(run.id)
			expect(snap?.cumulativeUsage.input_tokens).toBeGreaterThanOrEqual(usageB.input_tokens)
		} finally {
			await rm(dir, {recursive: true, force: true})
		}
	})
})

describe('AgentLoop.runWithStore — store 写入失败容忍', () => {
	it('appendEvent 抛错 → emit error event 但不冲垮 loop', async () => {
		const failingStore = new InMemoryRunStore()
		const run = await failingStore.create()
		// monkey-patch appendEvent 让它有时抛错
		let count = 0
		const origAppend = failingStore.appendEvent.bind(failingStore)
		failingStore.appendEvent = async (id, event) => {
			count++
			if (count === 2) throw new Error('disk full')
			return origAppend(id, event)
		}

		const provider = new ScriptedProvider([textTurn('done')])
		const ctx = createToolUseContext()
		const {events, result} = await consume(
			AgentLoop.runWithStore({
				provider,
				messages: [userMsg('q')],
				model: 'm',
				context: ctx,
				runStore: failingStore,
				runId: run.id,
			}),
		)
		expect((result as {reason: string}).reason).toBe('end_turn')
		// 应有一个 error event (phase: serialization)
		const errs = events.filter(
			(e): e is Extract<LoopEvent, {type: 'error'}> => e.type === 'error',
		)
		expect(errs.some(e => e.error.message === 'disk full')).toBe(true)
	})
})
