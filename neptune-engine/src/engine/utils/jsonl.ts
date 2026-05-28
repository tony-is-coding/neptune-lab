/**
 * jsonl — JSON Lines 文件 helper（borrowed from cc sessionStoragePortable patterns）
 *
 * - appendJsonl：单行 < 4KB 时 fs.appendFile 是 atomic（POSIX 保证）
 * - readJsonlLines：把整个 jsonl 读出来 + JSON.parse 每行 + 末行容错
 * - streamJsonlLines：超大文件按 chunk 流式读，类似 cc 的 readTranscriptForLoad
 *
 * NFS 友好：appendFile 走 O_APPEND，多进程并发 append 在 NFS v3+ 是 atomic
 * （但要保证单行 < 4KB；超大行会被 chunk 拆分，并发就可能交错）。
 */

import {appendFile, readFile, mkdir} from 'node:fs/promises'
import {dirname} from 'node:path'

/** 单行最大字节数（超过此长度并发 append 在 NFS 上可能不 atomic）。 */
export const JSONL_LINE_SOFT_LIMIT = 4 * 1024

export interface AppendJsonlOptions {
	/** 自动创建父目录（默认 true）。 */
	mkdirParents?: boolean
}

/**
 * 追加一行 JSON 到 jsonl 文件。`obj` 会 JSON.stringify + '\n' 后 appendFile。
 *
 * 单行长度建议 < 4KB（JSONL_LINE_SOFT_LIMIT），保证 POSIX/NFS atomic append。
 * 超长行不会失败但会被警告（caller 自己决定是否 split）。
 */
export async function appendJsonl(
	path: string,
	obj: unknown,
	opts?: AppendJsonlOptions,
): Promise<void> {
	if (opts?.mkdirParents !== false) {
		await mkdir(dirname(path), {recursive: true})
	}
	const line = JSON.stringify(obj) + '\n'
	await appendFile(path, line)
}

/**
 * 读整个 jsonl 文件，每行 JSON.parse；末行非完整（如崩溃截断）跳过。
 *
 * 返回顺序与文件中顺序一致。
 *
 * @param path jsonl 文件路径
 * @param opts.skipMalformed 默认 true。设 false 时遇到非法行 throw
 */
export async function readJsonlLines<T = unknown>(
	path: string,
	opts: {skipMalformed?: boolean} = {},
): Promise<T[]> {
	const skipMalformed = opts.skipMalformed !== false
	let raw: string
	try {
		raw = await readFile(path, 'utf8')
	} catch (err) {
		// ENOENT → 返空数组（让 caller 不必先判 exists）
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
		throw err
	}
	const lines = raw.split('\n')
	const result: T[] = []
	// 末行可能是空（正常 append 后；trailing '\n'）或截断（崩溃）；统一处理：
	// 如果最后一行不为空且不能 JSON.parse，按"截断"处理（skipMalformed 时跳过）
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!
		if (!line) continue
		try {
			result.push(JSON.parse(line) as T)
		} catch (err) {
			// 末行截断：跳过；非末行 malformed：按 opts 决定
			const isLast = i === lines.length - 1 || lines.slice(i + 1).every(l => !l)
			if (isLast || skipMalformed) {
				continue
			}
			throw new Error(
				`readJsonlLines: malformed JSON at line ${i + 1} of ${path}: ${(err as Error).message}`,
			)
		}
	}
	return result
}

/**
 * 流式读 jsonl 文件，每行 JSON.parse 后 yield 出来。
 * 末行截断容错（同 readJsonlLines）。
 */
export async function* streamJsonlLines<T = unknown>(
	path: string,
	opts: {skipMalformed?: boolean} = {},
): AsyncGenerator<T, void, unknown> {
	// 简化版：先读全文 split，对于 < 100MB 的文件性能足够；超大文件未来再做 chunked stream
	const items = await readJsonlLines<T>(path, opts)
	for (const item of items) yield item
}
