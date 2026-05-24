/**
 * canonicalJson — deterministic JSON serialization for hashing
 *
 * 标准化规则（最小集，避免引入第三方依赖）：
 * 1. Object keys 按字典序 sort（保证跨实例 hash 一致）
 * 2. Array / 原始类型保持原顺序
 * 3. undefined → 跳过（与 JSON.stringify 默认一致）
 * 4. 不支持循环引用（caller 责任，serialize 时会抛错）
 * 5. 不处理 BigInt / Symbol / Function（不在 audit payload 范围）
 */

export function canonicalJson(value: unknown): string {
	return JSON.stringify(canonicalize(value))
}

function canonicalize(value: unknown): unknown {
	if (value === null || typeof value !== 'object') {
		return value
	}
	if (Array.isArray(value)) {
		return value.map(canonicalize)
	}
	// Plain object
	const obj = value as Record<string, unknown>
	const sortedKeys = Object.keys(obj).sort()
	const result: Record<string, unknown> = {}
	for (const k of sortedKeys) {
		const v = obj[k]
		if (v === undefined) continue
		result[k] = canonicalize(v)
	}
	return result
}
