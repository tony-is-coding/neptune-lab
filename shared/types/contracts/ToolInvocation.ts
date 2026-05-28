/**
 * shared/types/contracts/ToolInvocation.ts — ToolInvocation 稳定契约
 *
 * 单次工具调用记录。runId / toolName / inputSnapshot / status 等。
 */

import {z} from 'zod'

export const ToolInvocationSchema = z
	.object({
		id: z.string().uuid(),
		runId: z.string().uuid(),
		toolName: z.string().min(1),
		inputSnapshot: z.unknown(),
		outputSnapshot: z.unknown().optional(),
		status: z.enum([
			'pending',
			'running',
			'completed',
			'failed',
			'aborted',
			'denied',
		]),
		startedAt: z.string().datetime(),
		endedAt: z.string().datetime().optional(),
		artifactIds: z.array(z.string()).optional(),
		error: z.string().optional(),
	})
	.passthrough()

export type ToolInvocation = z.infer<typeof ToolInvocationSchema>
