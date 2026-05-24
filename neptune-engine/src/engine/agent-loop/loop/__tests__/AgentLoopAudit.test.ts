/**
 * AgentLoopAudit.test.ts — Stage 4.1 集成测试
 *
 * 验证：
 * 1. AgentLoop.runWithStore 注入 auditStore → 关键事件自动 append + verify 通过
 * 2. governance_decision / tool_update / assistant_message 都被 audit
 * 3. 跨实例 verify 完整 chain
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
import {FilesystemAuditStore, NoopAuditStore} from '../../../audit/index.js'
import type {Message} from '../../../types/message.js'
import type {Tool, ToolResult} from '../../../types/tool.js'
import type {LoopEvent} from '../loopEvents.js'
import type {GovernanceHooks} from '../../../governance/index.js'

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

describe('AgentLoop + AuditStore 集成', () => {
	it('runWithStore + auditStore：assistant_message 自动 append + verify 通过', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'nep-audit-int-'))
		try {
			const runStore = new FileRunStore(dir)
			const auditStore = new FilesystemAuditStore(dir)
			const run = await runStore.create()

			const provider = new ScriptedProvider([textTurn('done')])
			const ctx = createToolUseContext()

			await consume(
				AgentLoop.runWithStore({
					provider,
					messages: [userMsg('hi')],
					model: 'm',
					context: ctx,
					runStore,
					runId: run.id,
					auditStore,
				}),
			)

			const auditEvents = await auditStore.load(run.id)
			expect(auditEvents.length).toBeGreaterThan(0)
			// 至少有一个 assistant_message audit
			const assistantAudits = auditEvents.filter(
				e => (e.payload as {kind?: string}).kind === 'assistant_message',
			)
			expect(assistantAudits.length).toBeGreaterThan(0)

			// verify chain
			const r = await auditStore.verify(run.id)
			expect(r.valid).toBe(true)
		} finally {
			await rm(dir, {recursive: true, force: true})
		}
	})

	it('tool_update result + governance_decision 自动 audit', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'nep-audit-tool-'))
		try {
			const runStore = new FileRunStore(dir)
			const auditStore = new FilesystemAuditStore(dir)
			const run = await runStore.create()

			const tool = makeTool('Echo', 'r')
			const provider = new ScriptedProvider([
				toolUseTurn('tu_1', 'Echo', {q: 'hi'}),
				textTurn('done'),
			])
			const ctx = createToolUseContext({tools: [tool]})

			// 加 PolicyHook 让 governance event 也 emit
			const governance: GovernanceHooks = {
				policyHook: {
					async beforeToolUse(invocation) {
						return {
							id: randomUUID(),
							decisionAt: new Date().toISOString(),
							behavior: 'allow',
							rule: 'test-allow-all',
							toolInvocationId: invocation.id,
						}
					},
				},
			}

			await consume(
				AgentLoop.runWithStore({
					provider,
					messages: [userMsg('hi')],
					model: 'm',
					tools: [tool],
					context: ctx,
					runStore,
					runId: run.id,
					auditStore,
					governance,
				}),
			)

			const auditEvents = await auditStore.load(run.id)
			const kinds = auditEvents.map(e => (e.payload as {kind: string}).kind)
			expect(kinds).toContain('assistant_message')
			expect(kinds).toContain('tool_result')
			expect(kinds).toContain('governance_decision')

			// 验证 governance audit payload 含决策内容
			const govAudits = auditEvents.filter(
				e => (e.payload as {kind?: string}).kind === 'governance_decision',
			)
			expect(govAudits.length).toBeGreaterThan(0)
			const preToolAudit = govAudits.find(
				e => (e.payload as {phase?: string}).phase === 'pre_tool',
			)
			expect(preToolAudit).toBeDefined()
			expect((preToolAudit?.payload as {decision?: string}).decision).toBe('allow')

			// chain valid
			const r = await auditStore.verify(run.id)
			expect(r.valid).toBe(true)
		} finally {
			await rm(dir, {recursive: true, force: true})
		}
	})

	it('error event 也自动 audit', async () => {
		const runStore = new InMemoryRunStore()
		const dir = await mkdtemp(join(tmpdir(), 'nep-audit-err-'))
		try {
			const auditStore = new FilesystemAuditStore(dir)
			const run = await runStore.create()
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
					runStore,
					runId: run.id,
					auditStore,
				}),
			)

			const auditEvents = await auditStore.load(run.id)
			const errorAudits = auditEvents.filter(
				e => (e.payload as {kind?: string}).kind === 'error',
			)
			expect(errorAudits.length).toBeGreaterThan(0)
			expect((errorAudits[0]?.payload as {message: string}).message).toBe('boom')
		} finally {
			await rm(dir, {recursive: true, force: true})
		}
	})

	it('不注入 auditStore → 不影响 runWithStore 行为', async () => {
		const runStore = new InMemoryRunStore()
		const run = await runStore.create()
		const provider = new ScriptedProvider([textTurn('done')])
		const ctx = createToolUseContext()
		const {result} = await consume(
			AgentLoop.runWithStore({
				provider,
				messages: [userMsg('q')],
				model: 'm',
				context: ctx,
				runStore,
				runId: run.id,
			}),
		)
		expect((result as {reason: string}).reason).toBe('end_turn')
	})

	it('NoopAuditStore：不实际持久化但不报错', async () => {
		const runStore = new InMemoryRunStore()
		const auditStore = new NoopAuditStore()
		const run = await runStore.create()
		const provider = new ScriptedProvider([textTurn('done')])
		const ctx = createToolUseContext()
		await consume(
			AgentLoop.runWithStore({
				provider,
				messages: [userMsg('q')],
				model: 'm',
				context: ctx,
				runStore,
				runId: run.id,
				auditStore,
			}),
		)
		// Noop store load 总返 []
		expect(await auditStore.load(run.id)).toEqual([])
	})

	it('跨实例 verify：engine A 跑完 → engine B 加载 audit chain → verify 通过', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'nep-audit-cross-'))
		try {
			const runStoreA = new FileRunStore(dir)
			const auditStoreA = new FilesystemAuditStore(dir)
			const run = await runStoreA.create()

			const provider = new ScriptedProvider([
				toolUseTurn('tu_1', 'Echo', {}),
				textTurn('end'),
			])
			const tool = makeTool('Echo', 'r')
			const ctx = createToolUseContext({tools: [tool]})

			await consume(
				AgentLoop.runWithStore({
					provider,
					messages: [userMsg('go')],
					model: 'm',
					tools: [tool],
					context: ctx,
					runStore: runStoreA,
					runId: run.id,
					auditStore: auditStoreA,
				}),
			)

			// engine B：完全独立实例
			const auditStoreB = new FilesystemAuditStore(dir)
			const events = await auditStoreB.load(run.id)
			expect(events.length).toBeGreaterThan(0)
			const r = await auditStoreB.verify(run.id)
			expect(r.valid).toBe(true)
		} finally {
			await rm(dir, {recursive: true, force: true})
		}
	})
})
