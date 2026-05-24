/**
 * shared/types/contracts/Artifact.ts — Artifact 稳定契约（基础）
 *
 * 通用产物。EvidenceArtifact 在此之上加 hash / source 字段（受审计）。
 */

import {z} from 'zod'

export const ArtifactSchema = z
	.object({
		id: z.string().uuid(),
		kind: z.string().min(1),
		mime: z.string().min(1),
		createdAt: z.string().datetime(),
		size: z.number().int().nonnegative().optional(),
		uri: z.string().optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
	})
	.passthrough()

export type Artifact = z.infer<typeof ArtifactSchema>
