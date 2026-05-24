/**
 * Stage 2.1 — 7 个稳定契约 zod schema 测试
 *
 * 测试文件落在 engine workspace（zod 在 engine 可用），通过 @shared/contracts 路径
 * import shared/types/contracts/index.ts。
 *
 * 验证：
 * - 每个 schema 暴露 XxxSchema (zod) + Xxx (z.infer) 类型
 * - 合法输入 parse() 成功
 * - 非法输入 parse() 失败
 * - .passthrough() 接受未知字段（向前兼容）
 * - AuditEvent 是 append-only（无 update 字段）
 */

import {describe, expect, it} from 'bun:test'
import {
	RunSchema,
	ToolInvocationSchema,
	ArtifactSchema,
	EvidenceArtifactSchema,
	AuditEventSchema,
	HumanReviewSchema,
	PolicyDecisionSchema,
	type Run,
	type ToolInvocation,
	type Artifact,
	type EvidenceArtifact,
	type AuditEvent,
	type HumanReview,
	type PolicyDecision,
} from '@shared/contracts'

const NOW = '2026-05-23T10:00:00.000Z'
const UUID = '01234567-89ab-4def-9123-456789abcdef'

describe('RunSchema', () => {
	it('合法 Run 通过', () => {
		const valid: Run = {
			id: UUID,
			projectId: 'proj-1',
			agentTemplateVersion: '1.2.3',
			status: 'running',
			startedAt: NOW,
		}
		expect(() => RunSchema.parse(valid)).not.toThrow()
	})

	it('非法 status 拒绝', () => {
		expect(() =>
			RunSchema.parse({
				id: UUID,
				projectId: 'p',
				agentTemplateVersion: 'v',
				status: 'invalid_status',
				startedAt: NOW,
			}),
		).toThrow()
	})

	it('passthrough 接受未知字段', () => {
		const result = RunSchema.parse({
			id: UUID,
			projectId: 'p',
			agentTemplateVersion: 'v',
			status: 'pending',
			startedAt: NOW,
			extra_unknown_field: 'should pass through',
		})
		expect((result as Record<string, unknown>).extra_unknown_field).toBe('should pass through')
	})
})

describe('ToolInvocationSchema', () => {
	it('合法 ToolInvocation 通过', () => {
		const valid: ToolInvocation = {
			id: UUID,
			runId: UUID,
			toolName: 'BashTool',
			inputSnapshot: {command: 'ls'},
			status: 'completed',
			startedAt: NOW,
		}
		expect(() => ToolInvocationSchema.parse(valid)).not.toThrow()
	})

	it('非法 status 拒绝', () => {
		expect(() =>
			ToolInvocationSchema.parse({
				id: UUID,
				runId: UUID,
				toolName: 'X',
				inputSnapshot: {},
				status: 'unknown',
				startedAt: NOW,
			}),
		).toThrow()
	})
})

describe('ArtifactSchema', () => {
	it('合法 Artifact 通过', () => {
		const valid: Artifact = {
			id: UUID,
			kind: 'text',
			mime: 'text/plain',
			createdAt: NOW,
		}
		expect(() => ArtifactSchema.parse(valid)).not.toThrow()
	})

	it('缺失 kind 拒绝', () => {
		expect(() =>
			ArtifactSchema.parse({id: UUID, mime: 'text/plain', createdAt: NOW}),
		).toThrow()
	})
})

describe('EvidenceArtifactSchema', () => {
	it('合法 EvidenceArtifact 通过（带 hash + source）', () => {
		const valid: EvidenceArtifact = {
			id: UUID,
			kind: 'voucher',
			mime: 'application/pdf',
			createdAt: NOW,
			hash: 'sha256:deadbeef',
			source: {
				toolName: 'PdfGenTool',
				agentTemplateVersion: '1.0.0',
			},
		}
		expect(() => EvidenceArtifactSchema.parse(valid)).not.toThrow()
	})

	it('非法 hash 格式（空字符串）拒绝', () => {
		expect(() =>
			EvidenceArtifactSchema.parse({
				id: UUID,
				kind: 'k',
				mime: 'm',
				createdAt: NOW,
				hash: '',
				source: {toolName: 't', agentTemplateVersion: 'v'},
			}),
		).toThrow()
	})
})

describe('AuditEventSchema', () => {
	it('合法 AuditEvent 通过', () => {
		const valid: AuditEvent = {
			id: UUID,
			timestamp: NOW,
			actor: 'agent:main',
			action: 'tool_call',
			target: 'BashTool',
		}
		expect(() => AuditEventSchema.parse(valid)).not.toThrow()
	})

	it('append-only：schema 不含 update 类字段', () => {
		// AuditEvent 不应该有 updatedAt / modifiedAt 等字段
		const shape = AuditEventSchema.shape
		expect((shape as Record<string, unknown>).updatedAt).toBeUndefined()
		expect((shape as Record<string, unknown>).modifiedAt).toBeUndefined()
	})
})

describe('HumanReviewSchema', () => {
	it('合法 HumanReview（pending）通过', () => {
		const valid: HumanReview = {
			id: UUID,
			runId: UUID,
			requestedAt: NOW,
			decision: 'pending',
		}
		expect(() => HumanReviewSchema.parse(valid)).not.toThrow()
	})

	it('合法 HumanReview（approved 含 reviewer/reviewedAt）通过', () => {
		const valid: HumanReview = {
			id: UUID,
			runId: UUID,
			requestedAt: NOW,
			reviewedAt: NOW,
			reviewer: 'user:alice',
			decision: 'approved',
		}
		expect(() => HumanReviewSchema.parse(valid)).not.toThrow()
	})

	it('非法 decision 拒绝', () => {
		expect(() =>
			HumanReviewSchema.parse({
				id: UUID,
				runId: UUID,
				requestedAt: NOW,
				decision: 'maybe',
			}),
		).toThrow()
	})
})

describe('PolicyDecisionSchema', () => {
	it('合法 PolicyDecision（allow）通过', () => {
		const valid: PolicyDecision = {
			id: UUID,
			decisionAt: NOW,
			behavior: 'allow',
		}
		expect(() => PolicyDecisionSchema.parse(valid)).not.toThrow()
	})

	it('合法 PolicyDecision（deny + reason）通过', () => {
		const valid: PolicyDecision = {
			id: UUID,
			decisionAt: NOW,
			behavior: 'deny',
			reason: 'no bash on Friday',
		}
		expect(() => PolicyDecisionSchema.parse(valid)).not.toThrow()
	})

	it('合法 PolicyDecision（require_review）通过', () => {
		const valid: PolicyDecision = {
			id: UUID,
			decisionAt: NOW,
			behavior: 'require_review',
		}
		expect(() => PolicyDecisionSchema.parse(valid)).not.toThrow()
	})

	it('非法 behavior 拒绝', () => {
		expect(() =>
			PolicyDecisionSchema.parse({
				id: UUID,
				decisionAt: NOW,
				behavior: 'unknown',
			}),
		).toThrow()
	})
})
