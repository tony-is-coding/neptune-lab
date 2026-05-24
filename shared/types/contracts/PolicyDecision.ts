/**
 * shared/types/contracts/PolicyDecision.ts — PolicyDecision 稳定契约
 *
 * 策略引擎决策记录。三种 behavior：allow / deny / require_review。
 */

import {z} from 'zod'

export const PolicyDecisionSchema = z
	.object({
		id: z.string(),
		decisionAt: z.string().datetime(),
		behavior: z.enum(['allow', 'deny', 'require_review']),
		rule: z.string().optional(),
		reason: z.string().optional(),
		toolInvocationId: z.string().uuid().optional(),
	})
	.passthrough()

export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>
