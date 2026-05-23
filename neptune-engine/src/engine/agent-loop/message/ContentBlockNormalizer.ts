/**
 * ContentBlockNormalizer — 把 engine Message 里的 content block 规范化成 API 形态
 *
 * 算法纲要（参考 cc claude.ts:674-690 stripGeminiProviderMetadata + 周边 normalize 逻辑）：
 *
 * 1. 剥离 engine 内部痕迹字段（不是 Anthropic API 字段，不能发出去）：
 *    - `_geminiThoughtSignature`：Gemini 适配器内部痕迹（cc 同样剥离）
 *    - 任何以 `_` 开头的字段（约定：以 `_` 前缀的字段为内部使用）
 * 2. thinking block 必须保留 signature（API multi-turn 强制要求）
 * 3. tool_use block 必须保留 id / name / input
 * 4. tool_result block 必须保留 tool_use_id / content
 *
 * 与 cc 行为差异（详见 __tests__/oracle/README.md）：
 * - 不抄 connector_text 处理（feature gated 在 cc 上，product 关注点）
 * - 不抄 advisor_tool_result 特殊路径
 */

import type {ContentItem} from '../../types/message.js'

const INTERNAL_FIELD_PREFIX = '_'

/**
 * 剥离单个 content block 上的内部痕迹字段。
 *
 * 输入可能是 string（assistant 纯文本时），也可能是 ContentBlock 对象。
 * string 直接返回（不需要 normalize）。
 */
export function normalizeContentBlock<T extends ContentItem | string>(block: T): T {
	if (typeof block === 'string') return block
	if (block === null || typeof block !== 'object') return block

	const cleaned: Record<string, unknown> = {}
	for (const key of Object.keys(block as object)) {
		if (key.startsWith(INTERNAL_FIELD_PREFIX)) continue
		cleaned[key] = (block as unknown as Record<string, unknown>)[key]
	}
	return cleaned as unknown as T
}

/**
 * 批量规范化 content blocks。
 */
export function normalizeContentBlocks(
	blocks: readonly ContentItem[],
): ContentItem[] {
	return blocks.map(b => normalizeContentBlock(b))
}

/**
 * 验证 thinking block 是否带 signature（缺失会被 API 拒绝）。
 *
 * 用于序列化前的 sanity check。返回违例 block 的 index 列表（空数组 = 全部合规）。
 */
export function findThinkingBlocksMissingSignature(
	blocks: readonly ContentItem[],
): number[] {
	const violations: number[] = []
	for (let i = 0; i < blocks.length; i++) {
		const b = blocks[i]
		if (
			typeof b === 'object' &&
			b !== null &&
			'type' in b &&
			(b as {type: string}).type === 'thinking'
		) {
			const sig = (b as {signature?: string}).signature
			if (!sig || typeof sig !== 'string' || sig.length === 0) {
				violations.push(i)
			}
		}
	}
	return violations
}
