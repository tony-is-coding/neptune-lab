/**
 * governance/ArtifactHook.ts — Tool 输出落 EvidenceArtifact 边界
 *
 * Substrate 触发 hook；engine 不持久化 artifact，product 写入 store + 计算 hash 后回传 EvidenceArtifact。
 * 默认 NoOp 返 stub EvidenceArtifact（hash 用 placeholder）。
 */

import {randomUUID, createHash} from 'crypto'
import type {EvidenceArtifact} from '@shared/contracts'

export interface ArtifactInput {
	runId: string
	toolInvocationId: string
	source: {
		toolName: string
		agentTemplateVersion: string
		connectorVersion?: string
	}
	content: string | Uint8Array | ArrayBuffer
	mime: string
	hint?: 'voucher' | 'balance' | 'invoice' | 'bank_receipt' | 'attachment' | string
}

export interface ArtifactHook {
	persistArtifact(input: ArtifactInput): Promise<EvidenceArtifact>
}

/**
 * NoOpArtifactHook — 计算简单 sha256（substrate 也算合理默认），返回内存 EvidenceArtifact。
 *
 * Product 真实实现应：写入 artifact store、（可选）digital sign、回传 uri。
 */
export class NoOpArtifactHook implements ArtifactHook {
	async persistArtifact(input: ArtifactInput): Promise<EvidenceArtifact> {
		const hash = `sha256:${this.computeHash(input.content)}`
		return {
			id: randomUUID(),
			kind: input.hint ?? 'attachment',
			mime: input.mime,
			createdAt: new Date().toISOString(),
			hash,
			source: {
				toolName: input.source.toolName,
				agentTemplateVersion: input.source.agentTemplateVersion,
				connectorVersion: input.source.connectorVersion,
			},
		}
	}

	private computeHash(content: string | Uint8Array | ArrayBuffer): string {
		const h = createHash('sha256')
		if (typeof content === 'string') {
			h.update(content)
		} else if (content instanceof Uint8Array) {
			h.update(content)
		} else {
			h.update(new Uint8Array(content))
		}
		return h.digest('hex')
	}
}

export const noOpArtifactHook: ArtifactHook = new NoOpArtifactHook()
