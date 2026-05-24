/**
 * cc-shim/file.ts — substrate-local 替代 src/utils/file.js + fsOperations.js + fileRead.js + diff.js + fileStateCache.js
 *
 * 设计：substrate 不感知 cc product 的 fs 抽象（getFsImplementation 含 worker thread / VFS 等）。
 * 直接走 Node fs API。Product 想要 sandboxed fs 自行注入 ctx.fs。
 *
 * 这里覆盖 builtin-tools 真实使用的 surface，纯函数为主。
 */

import {
	readFileSync,
	writeFileSync,
	existsSync,
	statSync,
	readdirSync,
	mkdirSync,
	unlinkSync,
	type Stats,
} from 'fs'
import {dirname} from 'path'
import {type StructuredPatchHunk, structuredPatch} from 'diff'

// ============================================================
// fsOperations — getFsImplementation
// ============================================================

interface FsImplementation {
	readFileSync: typeof readFileSync
	writeFileSync: typeof writeFileSync
	existsSync: typeof existsSync
	statSync: typeof statSync
	readdirSync: typeof readdirSync
	mkdirSync: typeof mkdirSync
	unlinkSync: typeof unlinkSync
	cwd: () => string
}

const defaultFs: FsImplementation = {
	readFileSync,
	writeFileSync,
	existsSync,
	statSync,
	readdirSync,
	mkdirSync,
	unlinkSync,
	cwd: () => process.cwd(),
}

/** Substrate 默认走 Node fs。Product 可注入替代实现（通过模块替换 / monkey patch）。 */
export function getFsImplementation(): FsImplementation {
	return defaultFs
}

// ============================================================
// file.ts — 文件读取 / 行号 / cache
// ============================================================

/** 简单 LRU 缓存：substrate 不需要复杂 invalidation，按 mtime + path key。 */
const readCache = new Map<string, {mtime: number; content: string}>()
const READ_CACHE_MAX = 200

export function readFileSyncCached(path: string, encoding: BufferEncoding = 'utf8'): string {
	try {
		const st = statSync(path)
		const key = `${path}::${encoding}`
		const cached = readCache.get(key)
		if (cached && cached.mtime === st.mtimeMs) return cached.content
		const content = readFileSync(path, encoding)
		readCache.set(key, {mtime: st.mtimeMs, content})
		// 简化的 LRU：到容量后清空一半（简单且足够）
		if (readCache.size > READ_CACHE_MAX) {
			const keys = Array.from(readCache.keys()).slice(0, READ_CACHE_MAX / 2)
			for (const k of keys) readCache.delete(k)
		}
		return content
	} catch {
		return ''
	}
}

/** 给文件内容加行号前缀（cat -n 风格）。 */
export function addLineNumbers({content, startLine}: {content: string; startLine: number}): string {
	const lines = content.split('\n')
	return lines
		.map((line, i) => {
			const lineNum = (startLine + i).toString().padStart(6, ' ')
			return `${lineNum}\t${line}`
		})
		.join('\n')
}

/** 把 leading tabs 转换成空格（兼容老 cc 行为）。 */
export function convertLeadingTabsToSpaces(content: string, tabSize = 4): string {
	return content
		.split('\n')
		.map(line => {
			let leadingTabs = 0
			while (leadingTabs < line.length && line[leadingTabs] === '\t') leadingTabs++
			return ' '.repeat(leadingTabs * tabSize) + line.slice(leadingTabs)
		})
		.join('\n')
}

/** 文件是否存在。 */
export function pathExists(path: string): boolean {
	return existsSync(path)
}

/** 显示路径（substrate 简化为绝对路径或带 ~ 的形式）。 */
export function getDisplayPath(p: string): string {
	const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
	if (home && p.startsWith(home)) return `~${p.slice(home.length)}`
	return p
}

/** Compact line prefix gating — substrate 总返 false（保守）。 */
export function isCompactLinePrefixEnabled(): boolean {
	return false
}

/** Stat 兼容 wrapper。 */
export function safeStatSync(path: string): Stats | null {
	try {
		return statSync(path)
	} catch {
		return null
	}
}

// ============================================================
// fileRead.ts — 文件读取兜底
// ============================================================

export function readFileWithFallback(path: string, encoding: BufferEncoding = 'utf8'): string {
	try {
		return readFileSync(path, encoding)
	} catch {
		return ''
	}
}

// ============================================================
// fileHistory.ts — substrate 无全局 fileHistory（cc 跨工具状态）
// ============================================================

/** Stub: substrate 不持有跨工具 file mutation 历史。Product 可注入接口。 */
export function recordFileMutation(_path: string, _kind: string, _meta?: unknown): void {
	// no-op
}

export function getFileHistorySnapshot(_path: string): unknown[] {
	return []
}

export function clearFileHistory(): void {
	// no-op
}

// ============================================================
// diff.ts re-exports
// ============================================================

export const DIFF_TIMEOUT_MS = 5000

export function getPatchForDisplay(
	oldContent: string,
	newContent: string,
	filename = 'file',
): string {
	const patch = structuredPatch(filename, filename, oldContent, newContent, '', '')
	return formatPatch(patch.hunks)
}

export function getPatchFromContents(
	oldContent: string,
	newContent: string,
	filename = 'file',
): {hunks: StructuredPatchHunk[]} {
	const patch = structuredPatch(filename, filename, oldContent, newContent, '', '')
	return {hunks: patch.hunks}
}

function formatPatch(hunks: StructuredPatchHunk[]): string {
	return hunks
		.flatMap(h => [
			`@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`,
			...h.lines,
		])
		.join('\n')
}

export function countLinesChanged(
	oldContent: string,
	newContent: string,
): {added: number; removed: number} {
	const patch = structuredPatch('a', 'a', oldContent, newContent, '', '')
	let added = 0
	let removed = 0
	for (const h of patch.hunks) {
		for (const line of h.lines) {
			if (line.startsWith('+') && !line.startsWith('+++')) added++
			if (line.startsWith('-') && !line.startsWith('---')) removed++
		}
	}
	return {added, removed}
}

// ============================================================
// fileStateCache.ts — substrate stub
// ============================================================

const fileStateCache = new Map<string, unknown>()

export function getFileState(path: string): unknown {
	return fileStateCache.get(path)
}

export function setFileState(path: string, state: unknown): void {
	fileStateCache.set(path, state)
}

export function clearFileStateCache(): void {
	fileStateCache.clear()
}

// 还有一个常见 export：mkdir helper
export function ensureDir(path: string): void {
	const dir = dirname(path)
	if (!existsSync(dir)) mkdirSync(dir, {recursive: true})
}
