/**
 * shared/types/contracts/Run.ts — Run 稳定契约
 *
 * Agent 执行的核心事实对象。跨 web/server/engine 三层共享。
 */

import {z} from 'zod'

export const RunSchema = z
	.object({
		id: z.string().uuid(),
		projectId: z.string().min(1),
		agentTemplateVersion: z.string().min(1),
		status: z.enum(['pending', 'running', 'succeeded', 'failed', 'cancelled']),
		startedAt: z.string().datetime(),
		endedAt: z.string().datetime().optional(),
	})
	.passthrough()

export type Run = z.infer<typeof RunSchema>
