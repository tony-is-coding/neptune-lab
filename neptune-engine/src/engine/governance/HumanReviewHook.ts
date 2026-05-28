/**
 * governance/HumanReviewHook.ts — Finding 后挂起等待人工复核
 *
 * Substrate 提供接口；engine 不持久化 review 状态（product 实现注入）。
 * 默认 NoOp 总返 approved（不阻塞 substrate）。
 */

import {randomUUID} from 'crypto'
import type {HumanReview} from '@shared/contracts'

export interface HumanReviewRequest {
	runId: string
	findingId?: string
	severity?: 'low' | 'medium' | 'high'
	evidence?: string[]
}

export interface HumanReviewHook {
	requestReview(request: HumanReviewRequest): Promise<HumanReview>
}

/**
 * NoOpHumanReviewHook — 默认实现，总返 approved。
 */
export class NoOpHumanReviewHook implements HumanReviewHook {
	async requestReview(request: HumanReviewRequest): Promise<HumanReview> {
		const now = new Date().toISOString()
		return {
			id: randomUUID(),
			runId: request.runId,
			findingId: request.findingId,
			severity: request.severity,
			evidence: request.evidence,
			requestedAt: now,
			reviewedAt: now,
			reviewer: 'noop:auto-approver',
			decision: 'approved',
		}
	}
}

export const noOpHumanReviewHook: HumanReviewHook = new NoOpHumanReviewHook()
