/**
 * RunStore.test.ts — InMemoryRunStore + FileRunStore 单测
 */

import {describe, it, expect, beforeEach, afterEach} from 'bun:test'
import {randomUUID} from 'crypto'
import {mkdtemp, rm, readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {InMemoryRunStore, FileRunStore, rebuildSnapshotFromEvents} from '../index.js'
import type {LoopEvent} from '../../agent-loop/loop/loopEvents.js'
import type {AssistantMessage} from '../../types/message.js'

function fakeAssistantMessage(text: string, stopReason: string | null = 'end_turn'): AssistantMessage {
	return {
		type: 'assistant',
		uuid: randomUUID() as unknown as AssistantMessage['uuid'],
		message: {
			role: 'assistant',
			content: [{type: 'text', text}] as unknown as AssistantMessage['message']['content'],
			stop_reason: stopReason,
		},
	}
}

function describeRunStore(label: string, makeStore: () => Promise<{store: InMemoryRunStore | FileRunStore; cleanup: () => Promise<void>}>): void {
	describe(`${label} — RunStore 协议`, () => {
		let store: InMemoryRunStore | FileRunStore
		let cleanup: () => Promise<void>

		beforeEach(async () => {
			const made = await makeStore()
			store = made.store
			cleanup = made.cleanup
		})

		afterEach(async () => {
			await cleanup()
		})

		it('create + load round-trip', async () => {
			const r = await store.create({metadata: {label: 'demo'}})
			expect(r.status).toBe('pending')
			expect(r.id).toBeDefined()
			expect(r.metadata).toEqual({label: 'demo'})

			const loaded = await store.load(r.id)
			expect(loaded?.id).toBe(r.id)
			expect(loaded?.metadata).toEqual({label: 'demo'})
		})

		it('create with custom id', async () => {
			const r = await store.create({id: 'custom-id-1'})
			expect(r.id).toBe('custom-id-1')
		})

		it('load 不存在 → null', async () => {
			expect(await store.load('nope')).toBeNull()
		})

		it('updateStatus 改 lifecycle', async () => {
			const r = await store.create()
			await store.updateStatus(r.id, 'running')
			expect((await store.load(r.id))?.status).toBe('running')
			await store.updateStatus(r.id, 'completed')
			expect((await store.load(r.id))?.status).toBe('completed')
		})

		it('appendEvent + loadEvents 顺序保留', async () => {
			const r = await store.create()
			const events: LoopEvent[] = [
				{type: 'stream_request_start', turn: 1},
				{type: 'assistant_message', message: fakeAssistantMessage('hi')},
				{
					type: 'usage_update',
					usage: {input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0},
					cumulative: {input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0},
				},
			]
			for (const e of events) await store.appendEvent(r.id, e)
			const loaded = await store.loadEvents(r.id)
			expect(loaded).toHaveLength(3)
			expect(loaded[0]?.type).toBe('stream_request_start')
			expect(loaded[1]?.type).toBe('assistant_message')
			expect(loaded[2]?.type).toBe('usage_update')
		})

		it('appendEvent 到不存在的 runId 抛错', async () => {
			await expect(
				store.appendEvent('nope', {type: 'stream_request_start', turn: 1}),
			).rejects.toThrow(/Run not found/)
		})

		it('loadSnapshot 重建 messages（含 assistant + tool_results）', async () => {
			const r = await store.create()
			const events: LoopEvent[] = [
				{type: 'stream_request_start', turn: 1},
				{
					type: 'assistant_message',
					message: fakeAssistantMessage('thinking', 'tool_use'),
				},
				{
					type: 'tool_update',
					update: {
						kind: 'result',
						toolUseId: 'tu_1',
						toolName: 'Echo',
						toolResultBlock: {type: 'tool_result', tool_use_id: 'tu_1', content: 'echoed'},
					},
				},
				{type: 'stream_request_start', turn: 2},
				{type: 'assistant_message', message: fakeAssistantMessage('done', 'end_turn')},
			]
			for (const e of events) await store.appendEvent(r.id, e)
			const snap = await store.loadSnapshot(r.id)
			expect(snap).not.toBeNull()
			// messages: assistant(turn1) + user(tool_results) + assistant(turn2)
			expect(snap?.messages).toHaveLength(3)
			expect(snap?.messages[0]?.type).toBe('assistant')
			expect(snap?.messages[1]?.type).toBe('user')
			expect(snap?.messages[2]?.type).toBe('assistant')
			expect(snap?.lastTurnNumber).toBe(2)
			expect(snap?.lastApiStopReason).toBe('end_turn')
		})

		it('loadSnapshot 累计 usage', async () => {
			const r = await store.create()
			await store.appendEvent(r.id, {
				type: 'usage_update',
				usage: {input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0},
				cumulative: {input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0},
			})
			const snap = await store.loadSnapshot(r.id)
			expect(snap?.cumulativeUsage.input_tokens).toBe(100)
			expect(snap?.cumulativeUsage.output_tokens).toBe(50)
		})

		it('loadSnapshot governance 计数', async () => {
			const r = await store.create()
			await store.appendEvent(r.id, {
				type: 'governance_decision',
				event: {
					phase: 'pre_tool',
					toolUseId: 'tu_1',
					toolName: 'X',
					decision: {id: '1', decisionAt: new Date().toISOString(), behavior: 'allow'},
				},
			})
			await store.appendEvent(r.id, {
				type: 'governance_decision',
				event: {
					phase: 'eval_complete',
					runId: r.id,
					result: {ok: true},
				},
			})
			const snap = await store.loadSnapshot(r.id)
			expect(snap?.governanceSnapshot?.policyDecisionsCount).toBe(1)
			expect(snap?.governanceSnapshot?.evalRunsCount).toBe(1)
		})

		it('delete 后 load 返 null', async () => {
			const r = await store.create()
			await store.delete(r.id)
			expect(await store.load(r.id)).toBeNull()
		})

		it('delete 不存在不报错', async () => {
			await expect(store.delete('nope')).resolves.toBeUndefined()
		})

		it('error event 序列化保留 message + name', async () => {
			const r = await store.create()
			const err = new TypeError('Bad type')
			await store.appendEvent(r.id, {type: 'error', error: err, phase: 'stream'})
			const events = await store.loadEvents(r.id)
			expect(events[0]?.type).toBe('error')
			if (events[0]?.type === 'error') {
				expect(events[0].error.message).toBe('Bad type')
				expect(events[0].error.name).toBe('TypeError')
			}
		})

		it('loadEvents fromIndex 切片', async () => {
			const r = await store.create()
			for (let i = 0; i < 5; i++) {
				await store.appendEvent(r.id, {type: 'stream_request_start', turn: i + 1})
			}
			const all = await store.loadEvents(r.id)
			expect(all).toHaveLength(5)
			const tail = await store.loadEvents(r.id, {fromIndex: 2})
			expect(tail).toHaveLength(3)
			if (tail[0]?.type === 'stream_request_start') {
				expect(tail[0].turn).toBe(3)
			}
		})
	})
}

describeRunStore('InMemoryRunStore', async () => {
	const store = new InMemoryRunStore()
	return {store, cleanup: async () => store.dispose()}
})

describeRunStore('FileRunStore', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'nep-runstore-'))
	const store = new FileRunStore(dir)
	return {
		store,
		cleanup: async () => {
			await rm(dir, {recursive: true, force: true})
		},
	}
})

// ============================================================
// FileRunStore-specific：跨实例 resume 是 stateless 的核心证明
// ============================================================

describe('FileRunStore — 跨实例 resume', () => {
	let dir: string

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'nep-runstore-cross-'))
	})

	afterEach(async () => {
		await rm(dir, {recursive: true, force: true})
	})

	it('engine A 写 + engine B（独立实例）读 → 完整 events + snapshot', async () => {
		const storeA = new FileRunStore(dir)
		const r = await storeA.create({metadata: {note: 'demo'}})
		const events: LoopEvent[] = [
			{type: 'stream_request_start', turn: 1},
			{type: 'assistant_message', message: fakeAssistantMessage('hello', 'end_turn')},
			{
				type: 'usage_update',
				usage: {input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0},
				cumulative: {input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0},
			},
		]
		for (const e of events) await storeA.appendEvent(r.id, e)

		// engine B：完全独立的实例
		const storeB = new FileRunStore(dir)
		const eventsB = await storeB.loadEvents(r.id)
		expect(eventsB).toHaveLength(3)
		const snapB = await storeB.loadSnapshot(r.id)
		expect(snapB?.run.id).toBe(r.id)
		expect(snapB?.run.metadata).toEqual({note: 'demo'})
		expect(snapB?.messages).toHaveLength(1)
		expect(snapB?.lastApiStopReason).toBe('end_turn')
		expect(snapB?.cumulativeUsage.input_tokens).toBe(10)
	})

	it('engine A 写到一半 + engine B 续写 → events 全部保留 + 顺序正确', async () => {
		const storeA = new FileRunStore(dir)
		const r = await storeA.create()
		await storeA.appendEvent(r.id, {type: 'stream_request_start', turn: 1})
		await storeA.appendEvent(r.id, {type: 'assistant_message', message: fakeAssistantMessage('A1')})

		const storeB = new FileRunStore(dir)
		await storeB.appendEvent(r.id, {type: 'stream_request_start', turn: 2})
		await storeB.appendEvent(r.id, {type: 'assistant_message', message: fakeAssistantMessage('B2')})

		const allEvents = await storeB.loadEvents(r.id)
		expect(allEvents).toHaveLength(4)
		const snap = await storeB.loadSnapshot(r.id)
		expect(snap?.messages).toHaveLength(2)
		expect(snap?.lastTurnNumber).toBe(2)
	})

	it('文件结构：rootDir/{runId}/{run.json + events.jsonl}', async () => {
		const store = new FileRunStore(dir)
		const r = await store.create()
		await store.appendEvent(r.id, {type: 'stream_request_start', turn: 1})

		const runJson = await readFile(join(dir, r.id, 'run.json'), 'utf8')
		const parsed = JSON.parse(runJson)
		expect(parsed.id).toBe(r.id)

		const eventsJsonl = await readFile(join(dir, r.id, 'events.jsonl'), 'utf8')
		expect(eventsJsonl.trim().split('\n')).toHaveLength(1)
	})
})

describe('rebuildSnapshotFromEvents 纯函数', () => {
	it('空 events → 空 messages', () => {
		const r = rebuildSnapshotFromEvents([])
		expect(r.messages).toEqual([])
		expect(r.cumulativeUsage.input_tokens).toBe(0)
		expect(r.lastTurnNumber).toBe(0)
	})

	it('单 turn end_turn → 1 message', () => {
		const events: LoopEvent[] = [
			{type: 'stream_request_start', turn: 1},
			{type: 'assistant_message', message: fakeAssistantMessage('done', 'end_turn')},
		]
		const r = rebuildSnapshotFromEvents(events)
		expect(r.messages).toHaveLength(1)
		expect(r.lastApiStopReason).toBe('end_turn')
	})

	it('tool_use turn → 收集 tool_results 包成 user message', () => {
		const events: LoopEvent[] = [
			{type: 'stream_request_start', turn: 1},
			{type: 'assistant_message', message: fakeAssistantMessage('thinking', 'tool_use')},
			{
				type: 'tool_update',
				update: {
					kind: 'result',
					toolUseId: 'tu1',
					toolName: 'Echo',
					toolResultBlock: {type: 'tool_result', tool_use_id: 'tu1', content: 'r1'},
				},
			},
			{
				type: 'tool_update',
				update: {
					kind: 'result',
					toolUseId: 'tu2',
					toolName: 'Echo',
					toolResultBlock: {type: 'tool_result', tool_use_id: 'tu2', content: 'r2'},
				},
			},
			{type: 'stream_request_start', turn: 2},
		]
		const r = rebuildSnapshotFromEvents(events)
		// assistant + user(2 tool_results)
		expect(r.messages).toHaveLength(2)
		expect(r.messages[0]?.type).toBe('assistant')
		expect(r.messages[1]?.type).toBe('user')
	})

	it('末尾 pending tool_results 也 flush', () => {
		const events: LoopEvent[] = [
			{type: 'stream_request_start', turn: 1},
			{type: 'assistant_message', message: fakeAssistantMessage('x', 'tool_use')},
			{
				type: 'tool_update',
				update: {
					kind: 'result',
					toolUseId: 'tu1',
					toolName: 'X',
					toolResultBlock: {type: 'tool_result', tool_use_id: 'tu1', content: 'ok'},
				},
			},
			// engine 中断在这里：tool_result 已收集但还没下一个 stream_request_start
		]
		const r = rebuildSnapshotFromEvents(events)
		expect(r.messages).toHaveLength(2) // assistant + user(tool_result)
		expect(r.messages[1]?.type).toBe('user')
	})
})
