/**
 * atomicWrite — write file atomically by writing to tmp file then rename.
 *
 * 防止崩溃中间留下 partial 文件。用 `os.tmpdir()` 同分区不行（rename 跨分区会失败），
 * 必须把 tmp 放在目标文件同目录下。
 *
 * NFS 友好：rename 在 NFS v3+ 是 atomic（同一 mount）。
 */

import {writeFile, rename, mkdir} from 'node:fs/promises'
import {dirname, join, basename} from 'node:path'
import {randomBytes} from 'node:crypto'

/**
 * 原子写文件。
 *
 * @param path 目标路径
 * @param data 内容（string 或 Uint8Array）
 */
export async function atomicWrite(
	path: string,
	data: string | Uint8Array,
): Promise<void> {
	const dir = dirname(path)
	const name = basename(path)
	await mkdir(dir, {recursive: true})
	const tmpName = `.${name}.tmp.${process.pid}.${randomBytes(4).toString('hex')}`
	const tmpPath = join(dir, tmpName)
	try {
		await writeFile(tmpPath, data)
		await rename(tmpPath, path)
	} catch (err) {
		// 清理 tmp（best-effort）
		try {
			const {unlink} = await import('node:fs/promises')
			await unlink(tmpPath)
		} catch {
			// ignore
		}
		throw err
	}
}
