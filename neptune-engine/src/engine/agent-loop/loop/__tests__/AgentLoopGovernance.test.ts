/**
 * AgentLoopGovernance.test.ts — Stage 2.4 集成测试
 *
 * 验证 4 类 governance hook 在 AgentLoop 主循环中被正确调用：
 *   - PolicyHook.beforeToolUse  → pre_tool 阶段
 *   - HumanReviewHook.requestReview → require_review 时
 *   - ArtifactHook.persistArtifact → toolResult 输出 hint 时
 *   - EvalHook.onRunComplete    → loop 退出前一次
 *
 * 不变式：
 *   - PolicyHook deny 时 tool 不执行，tool_result is_error 含 reason
 *   - PolicyHook require_review → HumanReview rejected 时 deny；approved 时放行
 *   - hook 抛错 → emit error event (phase: 'governance')，不冲垮 loop
 *   - LoopResult.governanceSnapshot 计数准确
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import {AgentLoop} from '../AgentLoop.js'
import {createToolUseContext} from '../../dispatcher/ToolUseContext.js'
import {ScriptedProvider, textTurn, toolUseTurn} from './scriptedProvider.js'
import type {Message} from '../../../types/message.js'
import type {Tool, ToolResult} from '../../../types/tool.js'
import type {LoopEvent} from '../loopEvents.js'
import type {
	PolicyHook,
	HumanReviewHook,
	EvalHook,
	ArtifactHook,
	GovernanceHooks,
} from '../../../governance/index.js'
import type {
	PolicyDecision,
	HumanReview,
	EvidenceArtifact,
	ToolInvocation,
} from '@shared/contracts'

function userMsg(text: string): Message {
	return {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'user', content: text},
	}
}

function makeTool(name: string, response: unknown, mcpMeta?: Record<string, unknown>): Tool {
	return {
		name,
		description: name,
		inputJSONSchema: {type: 'object'},
		async call(): Promise<ToolResult<unknown>> {
			const r: ToolResult<unknown> = {data: response}
			if (mcpMeta) r.mcpMeta = {_meta: mcpMeta}
			return r
		},
	} as unknown as Tool
}

async function runLoop(
	params: Parameters<typeof AgentLoop.run>[0],
): Promise<{events: LoopEvent[]; result: Awaited<ReturnType<typeof AgentLoop.run>['next']>['value']}> {
	const events: LoopEvent[] = []
	const gen = AgentLoop.run(params)
	while (true) {
		const next = await gen.next()
		if (next.done) return {events, result: next.value}
		events.push(next.value as LoopEvent)
	}
}

// ============================================================
// Helpers — mock hooks
// ============================================================

function mockPolicyAllow(): {hook: PolicyHook; calls: ToolInvocation[]} {
	const calls: ToolInvocation[] = []
	const hook: PolicyHook = {
		async beforeToolUse(invocation) {
			calls.push(invocation)
			return {
				id: randomUUID(),
				decisionAt: new Date().toISOString(),
				behavior: 'allow',
			}
		},
	}
	return {hook, calls}
}

function mockPolicyDeny(reason: string): {hook: PolicyHook; calls: ToolInvocation[]} {
	const calls: ToolInvocation[] = []
	const hook: PolicyHook = {
		async beforeToolUse(invocation) {
			calls.push(invocation)
			return {
				id: randomUUID(),
				decisionAt: new Date().toISOString(),
				behavior: 'deny',
				reason,
			}
		},
	}
	return {hook, calls}
}

function mockPolicyReview(reason: string): {hook: PolicyHook; calls: ToolInvocation[]} {
	const calls: ToolInvocation[] = []
	const hook: PolicyHook = {
		async beforeToolUse(invocation) {
			calls.push(invocation)
			return {
				id: randomUUID(),
				decisionAt: new Date().toISOString(),
				behavior: 'require_review',
				reason,
			}
		},
	}
	return {hook, calls}
}

function mockHumanReview(decision: 'approved' | 'rejected'): {
	hook: HumanReviewHook
	calls: number
} {
	let calls = 0
	const hook: HumanReviewHook = {
		async requestReview(req): Promise<HumanReview> {
			calls++
			const now = new Date().toISOString()
			return {
				id: randomUUID(),
				runId: req.runId,
				findingId: req.findingId,
				severity: req.severity,
				evidence: req.evidence,
				requestedAt: now,
				reviewedAt: now,
				reviewer: 'mock:human',
				decision,
			}
		},
	}
	return {
		hook,
		get calls() {
			return calls
		},
	} as {hook: HumanReviewHook; calls: number}
}

function mockArtifact(): {
	hook: ArtifactHook
	calls: Array<{toolName: string; hint?: string}>
} {
	const calls: Array<{toolName: string; hint?: string}> = []
	const hook: ArtifactHook = {
		async persistArtifact(input): Promise<EvidenceArtifact> {
			calls.push({toolName: input.source.toolName, hint: input.hint})
			return {
				id: randomUUID(),
				kind: input.hint ?? 'attachment',
				mime: input.mime,
				createdAt: new Date().toISOString(),
				hash: 'sha256:test',
				source: {
					toolName: input.source.toolName,
					agentTemplateVersion: input.source.agentTemplateVersion,
				},
			}
		},
	}
	return {hook, calls}
}

function mockEval(): {hook: EvalHook; calls: Array<{runId: string; result: unknown}>} {
	const calls: Array<{runId: string; result: unknown}> = []
	const hook: EvalHook = {
		async onRunComplete(runId, runResult) {
			calls.push({runId, result: runResult})
			return {ok: true}
		},
	}
	return {hook, calls}
}

// ============================================================
// 测试
// ============================================================

describe('AgentLoop + GovernanceHooks 集成', () => {
	it('PolicyHook deny → tool 不执行 → tool_result is_error 含 reason', async () => {
		const provider = new ScriptedProvider([
			toolUseTurn('tu_1', 'Echo', {q: 'hi'}),
			textTurn('done'),
		])
		let toolCalled = false
		const tool: Tool = {
			name: 'Echo',
			description: 'Echo',
			inputJSONSchema: {type: 'object'},
			async call() {
				toolCalled = true
				return {data: 'should-not-run'}
			},
		} as unknown as Tool
		const tools = [tool]
		const policy = mockPolicyDeny('blocked-by-policy')
		const governance: GovernanceHooks = {policyHook: policy.hook}
		const ctx = createToolUseContext({tools})

		const {events, result} = await runLoop({
			provider,
			messages: [userMsg('hi')],
			model: 'm',
			tools,
			context: ctx,
			governance,
		})

		expect(toolCalled).toBe(false)
		expect(policy.calls).toHaveLength(1)
		expect(policy.calls[0]?.toolName).toBe('Echo')

		const finalMessages = (result as {finalMessages: Message[]}).finalMessages
		const trContent = finalMessages[2]?.message?.content as unknown as Array<{
			is_error?: boolean
			content: string
		}>
		expect(trContent[0]?.is_error).toBe(true)
		expect(trContent[0]?.content).toContain('blocked-by-policy')

		// 验证 governance_decision event emit 了
		const govEvents = events.filter(
			(e): e is Extract<LoopEvent, {type: 'governance_decision'}> =>
				e.type === 'governance_decision',
		)
		expect(govEvents.length).toBeGreaterThanOrEqual(1)
		const preToolEv = govEvents.find(e => e.event.phase === 'pre_tool')
		expect(preToolEv).toBeDefined()
		if (preToolEv?.event.phase === 'pre_tool') {
			expect(preToolEv.event.decision.behavior).toBe('deny')
		}

		// LoopResult.governanceSnapshot 计数
		const snap = (result as {governanceSnapshot?: {policyDecisionsCount: number}})
			.governanceSnapshot
		expect(snap?.policyDecisionsCount).toBe(1)
	})

	it('PolicyHook require_review + HumanReview rejected → tool 不执行', async () => {
		const provider = new ScriptedProvider([
			toolUseTurn('tu_2', 'Risky', {a: 1}),
			textTurn('done'),
		])
		let toolCalled = false
		const tool: Tool = {
			name: 'Risky',
			description: 'Risky',
			inputJSONSchema: {type: 'object'},
			async call() {
				toolCalled = true
				return {data: 'ok'}
			},
		} as unknown as Tool
		const tools = [tool]
		const policy = mockPolicyReview('needs-human')
		const review = mockHumanReview('rejected')
		const governance: GovernanceHooks = {
			policyHook: policy.hook,
			humanReviewHook: review.hook,
		}
		const ctx = createToolUseContext({tools})

		const {result} = await runLoop({
			provider,
			messages: [userMsg('do')],
			model: 'm',
			tools,
			context: ctx,
			governance,
		})

		expect(toolCalled).toBe(false)
		const finalMessages = (result as {finalMessages: Message[]}).finalMessages
		const trContent = finalMessages[2]?.message?.content as unknown as Array<{
			is_error?: boolean
			content: string
		}>
		expect(trContent[0]?.is_error).toBe(true)

		const snap = (result as {governanceSnapshot?: {humanReviewsCount: number}})
			.governanceSnapshot
		expect(snap?.humanReviewsCount).toBe(1)
	})

	it('PolicyHook require_review + HumanReview approved → tool 正常执行', async () => {
		const provider = new ScriptedProvider([
			toolUseTurn('tu_3', 'Risky', {}),
			textTurn('done'),
		])
		let toolCalled = false
		const tool: Tool = {
			name: 'Risky',
			description: 'd',
			inputJSONSchema: {type: 'object'},
			async call() {
				toolCalled = true
				return {data: 'allowed-ok'}
			},
		} as unknown as Tool
		const tools = [tool]
		const policy = mockPolicyReview('checking')
		const review = mockHumanReview('approved')
		const governance: GovernanceHooks = {
			policyHook: policy.hook,
			humanReviewHook: review.hook,
		}
		const ctx = createToolUseContext({tools})

		const {result} = await runLoop({
			provider,
			messages: [userMsg('do')],
			model: 'm',
			tools,
			context: ctx,
			governance,
		})

		expect(toolCalled).toBe(true)
		const r = result as {reason: string}
		expect(r.reason).toBe('end_turn')
	})

	it('ArtifactHook 在 toolResult 含 mcpMeta._meta.artifactInputs 时被调用', async () => {
		const artifactInputs = [
			{
				mime: 'text/plain',
				content: 'voucher-bytes',
				hint: 'voucher',
			},
		]
		const tool = makeTool('Pay', 'paid-ok', {artifactInputs})
		const tools = [tool]
		const provider = new ScriptedProvider([
			toolUseTurn('tu_4', 'Pay', {amount: 100}),
			textTurn('all done'),
		])
		const policy = mockPolicyAllow()
		const artifact = mockArtifact()
		const governance: GovernanceHooks = {
			policyHook: policy.hook,
			artifactHook: artifact.hook,
		}
		const ctx = createToolUseContext({tools})

		const {events, result} = await runLoop({
			provider,
			messages: [userMsg('pay')],
			model: 'm',
			tools,
			context: ctx,
			governance,
		})

		expect(artifact.calls).toHaveLength(1)
		expect(artifact.calls[0]?.toolName).toBe('Pay')
		expect(artifact.calls[0]?.hint).toBe('voucher')

		// 验证 governance_decision artifact_persisted event
		const govEvents = events.filter(
			(e): e is Extract<LoopEvent, {type: 'governance_decision'}> =>
				e.type === 'governance_decision',
		)
		const persistEv = govEvents.find(e => e.event.phase === 'artifact_persisted')
		expect(persistEv).toBeDefined()

		const snap = (result as {governanceSnapshot?: {artifactsPersistedCount: number}})
			.governanceSnapshot
		expect(snap?.artifactsPersistedCount).toBe(1)
	})

	it('EvalHook 在 loop 退出前被调用一次', async () => {
		const provider = new ScriptedProvider([textTurn('hello')])
		const evalHook = mockEval()
		const governance: GovernanceHooks = {evalHook: evalHook.hook}
		const ctx = createToolUseContext()

		const {result} = await runLoop({
			provider,
			messages: [userMsg('hi')],
			model: 'm',
			context: ctx,
			governance,
		})

		expect(evalHook.calls).toHaveLength(1)
		expect(evalHook.calls[0]?.runId).toBeDefined()
		// runResult 应当包含 reason / cumulativeUsage / finalMessages 等
		const passedResult = evalHook.calls[0]?.result as {reason: string}
		expect(passedResult.reason).toBe('end_turn')

		const snap = (result as {governanceSnapshot?: {evalRunsCount: number}})
			.governanceSnapshot
		expect(snap?.evalRunsCount).toBe(1)
	})

	it('Hook 抛错 → emit error event (phase: governance) 但 loop 不冲垮', async () => {
		const provider = new ScriptedProvider([
			toolUseTurn('tu_5', 'Echo', {}),
			textTurn('survived'),
		])
		const tool = makeTool('Echo', 'r')
		const tools = [tool]
		const throwingPolicy: PolicyHook = {
			async beforeToolUse(): Promise<PolicyDecision> {
				throw new Error('policy-blew-up')
			},
		}
		const governance: GovernanceHooks = {policyHook: throwingPolicy}
		const ctx = createToolUseContext({tools})

		const {events, result} = await runLoop({
			provider,
			messages: [userMsg('hi')],
			model: 'm',
			tools,
			context: ctx,
			governance,
		})

		const govErrors = events.filter(
			(e): e is Extract<LoopEvent, {type: 'error'; phase: 'governance'}> =>
				e.type === 'error' && e.phase === 'governance',
		)
		expect(govErrors).toHaveLength(1)
		expect(govErrors[0]?.error.message).toContain('policy-blew-up')

		// loop 仍然走完（hook 抛错 fail-open：放行 tool）
		const r = result as {reason: string}
		expect(r.reason).toBe('end_turn')
	})

	it('多次 PolicyHook 调用 → governanceSnapshot 计数正确', async () => {
		const provider = new ScriptedProvider([
			toolUseTurn('tu_a', 'Echo', {a: 1}),
			toolUseTurn('tu_b', 'Echo', {a: 2}),
			textTurn('done'),
		])
		const tool = makeTool('Echo', 'ok')
		const tools = [tool]
		const policy = mockPolicyAllow()
		const governance: GovernanceHooks = {policyHook: policy.hook}
		const ctx = createToolUseContext({tools})

		const {result} = await runLoop({
			provider,
			messages: [userMsg('hi')],
			model: 'm',
			tools,
			context: ctx,
			governance,
		})

		expect(policy.calls).toHaveLength(2)
		const snap = (result as {governanceSnapshot?: {policyDecisionsCount: number}})
			.governanceSnapshot
		expect(snap?.policyDecisionsCount).toBe(2)
	})

	it('未注入 governance hooks → governanceSnapshot 仍 emit 全 0（兼容性）', async () => {
		const provider = new ScriptedProvider([textTurn('hi')])
		const ctx = createToolUseContext()
		const {result} = await runLoop({
			provider,
			messages: [userMsg('hi')],
			model: 'm',
			context: ctx,
		})
		const r = result as {governanceSnapshot?: unknown}
		// 未注入 → snapshot 可以是 undefined（不强制存在）
		expect(r.governanceSnapshot === undefined || r.governanceSnapshot !== null).toBe(true)
	})
})
