/**
 * Checkpoint.test.ts — Stage 4.3 任意 turn checkpoint
 */

import {describe, it, expect, beforeEach, afterEach} from 'bun:test'
import {randomUUID} from 'crypto'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {InMemoryRunStore, FileRunStore, rebuildCheckpointFromEvents} from '../index.js'
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

describe('rebuildCheckpointFromEvents — 纯函数边界', () => {
	it('turn 1 checkpoint：只含 turn 1 事件', () => {
		const events: LoopEvent[] = [
			{type: 'stream_request_start', turn: 1},
			{type: 'assistant_message', message: fakeAssistantMessage('A1', 'tool_use')},
			{
				type: 'tool_update',
				update: {
					kind: 'result',
					toolUseId: 'tu1',
					toolName: 'X',
					toolResultBlock: {type: 'tool_result', tool_use_id: 'tu1', content: 'r1'},
				},
			},
			{type: 'stream_request_start', turn: 2},
			{type: 'assistant_message', message: fakeAssistantMessage('A2', 'end_turn')},
		]
		const cp = rebuildCheckpointFromEvents(events, 1)
		expect(cp).not.toBeNull()
		// turn 1 末尾：assistant + user(tool_result)
		expect(cp?.messages.length).toBe(2)
		expect(cp?.messages[0]?.type).toBe('assistant')
		expect(cp?.messages[1]?.type).toBe('user')
	})

	it('turn 2 checkpoint：含 turn 1 + 2 全部', () => {
		const events: LoopEvent[] = [
			{type: 'stream_request_start', turn: 1},
			{type: 'assistant_message', message: fakeAssistantMessage('A1', 'end_turn')},
			{type: 'stream_request_start', turn: 2},
			{type: 'assistant_message', message: fakeAssistantMessage('A2', 'end_turn')},
		]
		const cp = rebuildCheckpointFromEvents(events, 2)
		expect(cp).not.toBeNull()
		expect(cp?.messages.length).toBe(2)
	})

	it('turn 不存在（超出实际跑过的轮数）→ null', () => {
		const events: LoopEvent[] = [
			{type: 'stream_request_start', turn: 1},
			{type: 'assistant_message', message: fakeAssistantMessage('A1', 'end_turn')},
		]
		const cp = rebuildCheckpointFromEvents(events, 5)
		expect(cp).toBeNull()
	})

	it('turn=0 → null（最小 1）', () => {
		expect(rebuildCheckpointFromEvents([], 0)).toBeNull()
	})

	it('累计 usage 截止到 checkpoint', () => {
		const events: LoopEvent[] = [
			{type: 'stream_request_start', turn: 1},
			{type: 'assistant_message', message: fakeAssistantMessage('A1', 'tool_use')},
			{
				type: 'usage_update',
				usage: {input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0},
				cumulative: {input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0},
			},
			{type: 'stream_request_start', turn: 2},
			{type: 'assistant_message', message: fakeAssistantMessage('A2', 'end_turn')},
			{
				type: 'usage_update',
				usage: {input_tokens: 5, output_tokens: 3, cache_creation_input_tokens: 0, cache_read_input_tokens: 0},
				cumulative: {input_tokens: 15, output_tokens: 8, cache_creation_input_tokens: 0, cache_read_input_tokens: 0},
			},
		]
		const cp1 = rebuildCheckpointFromEvents(events, 1)
		expect(cp1?.cumulativeUsage.input_tokens).toBe(10) // 只到 turn 1
		const cp2 = rebuildCheckpointFromEvents(events, 2)
		expect(cp2?.cumulativeUsage.input_tokens).toBe(15) // 到 turn 2
	})

	it('governanceSnapshot 截止到 checkpoint', () => {
		const events: LoopEvent[] = [
			{type: 'stream_request_start', turn: 1},
			{
				type: 'governance_decision',
				event: {
					phase: 'pre_tool',
					toolUseId: 't',
					toolName: 'X',
					decision: {id: '1', decisionAt: new Date().toISOString(), behavior: 'allow'},
				},
			},
			{type: 'assistant_message', message: fakeAssistantMessage('A1', 'end_turn')},
			{type: 'stream_request_start', turn: 2},
			{
				type: 'governance_decision',
				event: {
					phase: 'pre_tool',
					toolUseId: 't2',
					toolName: 'X',
					decision: {id: '2', decisionAt: new Date().toISOString(), behavior: 'allow'},
				},
			},
			{type: 'assistant_message', message: fakeAssistantMessage('A2', 'end_turn')},
		]
		const cp1 = rebuildCheckpointFromEvents(events, 1)
		expect(cp1?.governanceSnapshot.policyDecisionsCount).toBe(1)
		const cp2 = rebuildCheckpointFromEvents(events, 2)
		expect(cp2?.governanceSnapshot.policyDecisionsCount).toBe(2)
	})
})

describe('InMemoryRunStore.loadCheckpoint', () => {
	it('loadCheckpoint(1) 返回 turn 1 末尾状态', async () => {
		const store = new InMemoryRunStore()
		const r = await store.create()
		const events: LoopEvent[] = [
			{type: 'stream_request_start', turn: 1},
			{type: 'assistant_message', message: fakeAssistantMessage('A1', 'end_turn')},
			{type: 'stream_request_start', turn: 2},
			{type: 'assistant_message', message: fakeAssistantMessage('A2', 'end_turn')},
		]
		for (const e of events) await store.appendEvent(r.id, e)
		const cp = await store.loadCheckpoint(r.id, 1)
		expect(cp).not.toBeNull()
		expect(cp?.runId).toBe(r.id)
		expect(cp?.turnNumber).toBe(1)
		expect(cp?.messages.length).toBe(1) // 只 turn 1 的 assistant
		expect(cp?.capturedAt).toBeDefined()
	})

	it('loadCheckpoint(unknown turn) → null', async () => {
		const store = new InMemoryRunStore()
		const r = await store.create()
		await store.appendEvent(r.id, {type: 'stream_request_start', turn: 1})
		await store.appendEvent(r.id, {
			type: 'assistant_message',
			message: fakeAssistantMessage('A', 'end_turn'),
		})
		expect(await store.loadCheckpoint(r.id, 5)).toBeNull()
	})

	it('loadCheckpoint(unknown runId) → null', async () => {
		const store = new InMemoryRunStore()
		expect(await store.loadCheckpoint('nope', 1)).toBeNull()
	})
})

describe('FileRunStore.loadCheckpoint + 跨实例', () => {
	let dir: string
	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'nep-cp-'))
	})
	afterEach(async () => {
		await rm(dir, {recursive: true, force: true})
	})

	it('engine A 写多 turn → engine B 同 store loadCheckpoint(turn 1)', async () => {
		const storeA = new FileRunStore(dir)
		const r = await storeA.create()
		const events: LoopEvent[] = [
			{type: 'stream_request_start', turn: 1},
			{type: 'assistant_message', message: fakeAssistantMessage('first', 'end_turn')},
			{type: 'stream_request_start', turn: 2},
			{type: 'assistant_message', message: fakeAssistantMessage('second', 'end_turn')},
			{type: 'stream_request_start', turn: 3},
			{type: 'assistant_message', message: fakeAssistantMessage('third', 'end_turn')},
		]
		for (const e of events) await storeA.appendEvent(r.id, e)

		// engine B 完全独立实例
		const storeB = new FileRunStore(dir)
		const cp = await storeB.loadCheckpoint(r.id, 2)
		expect(cp?.turnNumber).toBe(2)
		expect(cp?.messages.length).toBe(2)
	})
})
