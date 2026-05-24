/**
 * Stage 2.2 — 4 类治理 Hook 单测
 *
 * 验证 NoOp 实现行为符合预期：
 * - PolicyHook: 总返 allow
 * - HumanReviewHook: 总返 approved
 * - EvalHook: 总返 null
 * - ArtifactHook: 计算 sha256 + 返回合法 EvidenceArtifact
 */

import {describe, expect, it} from 'bun:test'
import {createHash} from 'crypto'
import {
	NoOpPolicyHook,
	NoOpHumanReviewHook,
	NoOpEvalHook,
	NoOpArtifactHook,
	type GovernanceHooks,
} from '../index.js'
import {EvidenceArtifactSchema, type ToolInvocation} from '@shared/contracts'

const NOW = '2026-05-23T10:00:00.000Z'
const UUID = '01234567-89ab-4def-9123-456789abcdef'

describe('NoOpPolicyHook', () => {
	it('beforeToolUse 总返 allow', async () => {
		const hook = new NoOpPolicyHook()
		const invocation: ToolInvocation = {
			id: UUID,
			runId: UUID,
			toolName: 'BashTool',
			inputSnapshot: {command: 'ls'},
			status: 'pending',
			startedAt: NOW,
		}
		const decision = await hook.beforeToolUse(invocation)
		expect(decision.behavior).toBe('allow')
		expect(decision.id).toBeDefined()
		expect(decision.decisionAt).toBeDefined()
	})

	it('每次返回新 id（不复用）', async () => {
		const hook = new NoOpPolicyHook()
		const inv: ToolInvocation = {
			id: UUID,
			runId: UUID,
			toolName: 'X',
			inputSnapshot: {},
			status: 'pending',
			startedAt: NOW,
		}
		const a = await hook.beforeToolUse(inv)
		const b = await hook.beforeToolUse(inv)
		expect(a.id).not.toBe(b.id)
	})
})

describe('NoOpHumanReviewHook', () => {
	it('requestReview 总返 approved', async () => {
		const hook = new NoOpHumanReviewHook()
		const review = await hook.requestReview({
			runId: UUID,
			findingId: 'finding-1',
			severity: 'high',
			evidence: ['art-1', 'art-2'],
		})
		expect(review.decision).toBe('approved')
		expect(review.runId).toBe(UUID)
		expect(review.findingId).toBe('finding-1')
		expect(review.reviewer).toBe('noop:auto-approver')
		expect(review.reviewedAt).toBeDefined()
	})
})

describe('NoOpEvalHook', () => {
	it('onRunComplete 总返 null', async () => {
		const hook = new NoOpEvalHook()
		const result = await hook.onRunComplete(UUID, {output: 'done'})
		expect(result).toBeNull()
	})
})

describe('NoOpArtifactHook', () => {
	it('persistArtifact 返回合法 EvidenceArtifact 含 sha256 hash', async () => {
		const hook = new NoOpArtifactHook()
		const result = await hook.persistArtifact({
			runId: UUID,
			toolInvocationId: UUID,
			source: {
				toolName: 'TestTool',
				agentTemplateVersion: '1.0.0',
			},
			content: 'hello world',
			mime: 'text/plain',
			hint: 'voucher',
		})
		expect(EvidenceArtifactSchema.parse(result)).toBeTruthy()
		expect(result.hash).toMatch(/^sha256:[0-9a-f]{64}$/)
		expect(result.kind).toBe('voucher')
		expect(result.mime).toBe('text/plain')
		expect(result.source.toolName).toBe('TestTool')
		expect(result.source.agentTemplateVersion).toBe('1.0.0')
	})

	it('hash 是稳定的（同输入 → 同 hash）', async () => {
		const hook = new NoOpArtifactHook()
		const make = () =>
			hook.persistArtifact({
				runId: UUID,
				toolInvocationId: UUID,
				source: {toolName: 'X', agentTemplateVersion: '1'},
				content: 'same content',
				mime: 'text/plain',
			})
		const a = await make()
		const b = await make()
		expect(a.hash).toBe(b.hash)
		// id 应该不同（每次 randomUUID）
		expect(a.id).not.toBe(b.id)
	})

	it('hash 与 crypto sha256 等价（确认实现正确）', async () => {
		const hook = new NoOpArtifactHook()
		const result = await hook.persistArtifact({
			runId: UUID,
			toolInvocationId: UUID,
			source: {toolName: 'X', agentTemplateVersion: '1'},
			content: 'verify hash',
			mime: 'text/plain',
		})
		const expected = createHash('sha256').update('verify hash').digest('hex')
		expect(result.hash).toBe(`sha256:${expected}`)
	})

	it('default kind = attachment 当无 hint', async () => {
		const hook = new NoOpArtifactHook()
		const result = await hook.persistArtifact({
			runId: UUID,
			toolInvocationId: UUID,
			source: {toolName: 'X', agentTemplateVersion: '1'},
			content: 'x',
			mime: 'text/plain',
		})
		expect(result.kind).toBe('attachment')
	})

	it('支持 Uint8Array content', async () => {
		const hook = new NoOpArtifactHook()
		const bytes = new Uint8Array([1, 2, 3, 4])
		const result = await hook.persistArtifact({
			runId: UUID,
			toolInvocationId: UUID,
			source: {toolName: 'X', agentTemplateVersion: '1'},
			content: bytes,
			mime: 'application/octet-stream',
		})
		expect(result.hash).toMatch(/^sha256:[0-9a-f]{64}$/)
	})
})

describe('GovernanceHooks bag', () => {
	it('部分注入：只有 policyHook，其他 undefined', () => {
		const bag: GovernanceHooks = {policyHook: new NoOpPolicyHook()}
		expect(bag.policyHook).toBeDefined()
		expect(bag.humanReviewHook).toBeUndefined()
		expect(bag.evalHook).toBeUndefined()
		expect(bag.artifactHook).toBeUndefined()
	})

	it('全注入', () => {
		const bag: GovernanceHooks = {
			policyHook: new NoOpPolicyHook(),
			humanReviewHook: new NoOpHumanReviewHook(),
			evalHook: new NoOpEvalHook(),
			artifactHook: new NoOpArtifactHook(),
		}
		expect(bag.policyHook).toBeDefined()
		expect(bag.humanReviewHook).toBeDefined()
		expect(bag.evalHook).toBeDefined()
		expect(bag.artifactHook).toBeDefined()
	})
})
