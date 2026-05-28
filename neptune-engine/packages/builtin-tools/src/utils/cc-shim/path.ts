/**
 * cc-shim/path.ts — substrate-local 替代 src/utils/path.js
 *
 * 提供 expandPath / getDirectoryForPath / posixPathToWindowsPath 等。
 * 不依赖 cc bootstrap state；getCwd() 走 substrate 自己的 cwd shim。
 */

import {homedir} from 'os'
import {dirname, isAbsolute, normalize, posix, resolve, sep} from 'path'
import {getCwd} from './cwd.js'
import {isWindows} from './platform.js'

/** 把 POSIX 风格路径转成 Windows 路径（仅在 Windows 上）。 */
export function posixPathToWindowsPath(p: string): string {
	if (!isWindows()) return p
	// /c/Users/... → C:\Users\...
	const m = p.match(/^\/([a-zA-Z])\/(.*)$/)
	if (m) {
		return `${m[1]!.toUpperCase()}:\\${m[2]!.split('/').join('\\')}`
	}
	return p.split('/').join('\\')
}

/**
 * Expand a path — handles ~, ~/path, absolute, and relative.
 * 默认 baseDir 用 substrate 的 getCwd()。
 */
export function expandPath(path: string, baseDir?: string): string {
	if (typeof path !== 'string') {
		throw new TypeError(`Path must be a string, received ${typeof path}`)
	}
	const actualBaseDir = baseDir ?? getCwd()
	if (typeof actualBaseDir !== 'string') {
		throw new TypeError(
			`Base directory must be a string, received ${typeof actualBaseDir}`,
		)
	}
	if (path.includes('\0') || actualBaseDir.includes('\0')) {
		throw new Error('Path contains null bytes')
	}

	let expanded = path

	// ~ / ~/ 处理
	if (expanded === '~' || expanded.startsWith('~/') || expanded.startsWith('~\\')) {
		const home = homedir()
		expanded =
			expanded === '~' ? home : `${home}${sep}${expanded.slice(2)}`
	}

	// POSIX → Windows 转换（在 Windows 上）
	if (isWindows() && expanded.startsWith('/')) {
		expanded = posixPathToWindowsPath(expanded)
	}

	if (!isAbsolute(expanded)) {
		expanded = resolve(actualBaseDir, expanded)
	}

	return normalize(expanded)
}

/** 拿到目录路径（如果 path 是目录则原样；否则取 dirname）。 */
export function getDirectoryForPath(path: string): string {
	if (path.endsWith(sep) || path.endsWith('/')) return path
	return dirname(path)
}

/** POSIX-only path join（用于跨平台路径标准化）。 */
export function joinPosix(...segments: string[]): string {
	return posix.join(...segments)
}
