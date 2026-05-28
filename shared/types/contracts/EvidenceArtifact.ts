/**
 * shared/types/contracts/EvidenceArtifact.ts — EvidenceArtifact 稳定契约
 *
 * Artifact 的子类型：受审计的证据。强制 hash + source 信息，便于追责。
 */

import {z} from 'zod'

import {ArtifactSchema} from './Artifact.js'

export const EvidenceArtifactSchema = ArtifactSchema.extend({
	hash: z.string().min(1),
	signedAt: z.string().datetime().optional(),
	signedBy: z.string().optional(),
	source: z.object({
		toolName: z.string().min(1),
		agentTemplateVersion: z.string().min(1),
		connectorVersion: z.string().optional(),
		inputSnapshotRef: z.string().optional(),
	}),
}).passthrough()

export type EvidenceArtifact = z.infer<typeof EvidenceArtifactSchema>
