/**
 * shared/types/contracts/AuditEvent.ts — AuditEvent 稳定契约
 *
 * Append-only 审计事件。设计原则：无 update 字段（只追加，不修改）。
 */

import {z} from 'zod'

export const AuditEventSchema = z
	.object({
		id: z.string().uuid(),
		timestamp: z.string().datetime(),
		actor: z.string().min(1),
		action: z.string().min(1),
		target: z.string().min(1),
		runId: z.string().uuid().optional(),
		toolInvocationId: z.string().uuid().optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
	})
	.passthrough()

export type AuditEvent = z.infer<typeof AuditEventSchema>
