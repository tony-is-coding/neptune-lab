/**
 * shared/types/contracts/HumanReview.ts — HumanReview 稳定契约
 *
 * 人工复核记录。挂起 + 等待 + 决策。
 */

import {z} from 'zod'

export const HumanReviewSchema = z
	.object({
		id: z.string().uuid(),
		runId: z.string().uuid(),
		findingId: z.string().optional(),
		severity: z.enum(['low', 'medium', 'high']).optional(),
		evidence: z.array(z.string()).optional(),
		requestedAt: z.string().datetime(),
		reviewedAt: z.string().datetime().optional(),
		reviewer: z.string().optional(),
		decision: z.enum(['pending', 'approved', 'rejected']),
		reason: z.string().optional(),
	})
	.passthrough()

export type HumanReview = z.infer<typeof HumanReviewSchema>
