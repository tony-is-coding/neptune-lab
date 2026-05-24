/**
 * sanitizePath — 把任意字符串转为文件系统安全的路径组件。
 *
 * 借鉴 cc `sessionStoragePortable.ts` 实战经验：
 * - 替换非 alphanumeric 为 `-`
 * - 大于 200 字符时截断 + djb2 hash 后缀防冲突
 * - 200 留余量给 hash 后缀和分隔符（多数 fs 单 component ≤ 255 byte）
 */

import {djb2Hash} from './djb2Hash.js'

export const MAX_SANITIZED_LENGTH = 200

/**
 * 把字符串转为 fs-safe 名称。
 *
 * @example
 *   sanitizePath('/Users/foo/my-project') → '-Users-foo-my-project'
 *   sanitizePath('plugin:name:server')    → 'plugin-name-server'
 *   sanitizePath('a'.repeat(300))         → 'aaa...aaa-{hash}'
 */
export function sanitizePath(name: string): string {
	const sanitized = name.replace(/[^a-zA-Z0-9]/g, '-')
	if (sanitized.length <= MAX_SANITIZED_LENGTH) {
		return sanitized
	}
	const hash = Math.abs(djb2Hash(name)).toString(36)
	return `${sanitized.slice(0, MAX_SANITIZED_LENGTH)}-${hash}`
}
