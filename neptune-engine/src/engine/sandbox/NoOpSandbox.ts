/**
 * NoOpSandbox — Pass-through 实现（**不安全**，仅供显式 opt-in dangerous 模式）
 *
 * 用法：当用户/product 明确接受所有风险（如 sandboxed CI 环境、内部 dev tool）时。
 * 默认 engine 推荐 LocalSandbox（secure-by-default）。
 */

import {exec as nodeExec} from 'node:child_process'
import {promisify} from 'node:util'
import {readFile, writeFile, appendFile, stat} from 'node:fs/promises'
import type {
	SandboxAdapter,
	SandboxDeny,
	ExecRequest,
	ExecResult,
	ReadFileOptions,
	ReadFileResult,
	WriteFileOptions,
	WriteFileResult,
	FetchRequest,
	FetchResult,
} from './SandboxAdapter.js'

const execAsync = promisify(nodeExec)

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024

export class NoOpSandbox implements SandboxAdapter {
	async exec(req: ExecRequest): Promise<ExecResult | SandboxDeny> {
		try {
			const result = await execAsync(req.command, {
				cwd: req.cwd,
				env: req.env ?? process.env,
				timeout: req.timeoutMs ?? DEFAULT_TIMEOUT_MS,
				signal: req.signal,
			})
			const stdout = result.stdout as unknown as string | Buffer
			const stderr = result.stderr as unknown as string | Buffer
			return {
				behavior: 'allow',
				stdout: typeof stdout === 'string' ? stdout : stdout.toString(),
				stderr: typeof stderr === 'string' ? stderr : stderr.toString(),
				exitCode: 0,
			}
		} catch (err) {
			const e = err as NodeJS.ErrnoException & {
				code?: string | number
				stdout?: string | Buffer
				stderr?: string | Buffer
				killed?: boolean
			}
			return {
				behavior: 'allow',
				stdout: typeof e.stdout === 'string' ? e.stdout : (e.stdout?.toString() ?? ''),
				stderr: typeof e.stderr === 'string' ? e.stderr : (e.stderr?.toString() ?? String(err)),
				exitCode: typeof e.code === 'number' ? e.code : 1,
				killedByTimeout: e.killed === true,
			}
		}
	}

	async readFile(
		path: string,
		opts: ReadFileOptions = {},
	): Promise<ReadFileResult | SandboxDeny> {
		const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
		const s = await stat(path)
		if (s.size > maxBytes) {
			return {behavior: 'deny', reason: `File too large: ${s.size} > ${maxBytes}`}
		}
		const encoding = opts.encoding ?? 'utf8'
		if (encoding === 'binary') {
			const buf = await readFile(path)
			return {behavior: 'allow', content: new Uint8Array(buf), bytesRead: buf.length}
		}
		const content = await readFile(path, 'utf8')
		return {behavior: 'allow', content, bytesRead: Buffer.byteLength(content, 'utf8')}
	}

	async writeFile(
		path: string,
		content: string | Uint8Array,
		opts: WriteFileOptions = {},
	): Promise<WriteFileResult | SandboxDeny> {
		const mode = opts.mode ?? 'overwrite'
		const bytes =
			typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : content.byteLength
		if (mode === 'append') {
			await appendFile(path, content)
		} else {
			await writeFile(path, content)
		}
		return {behavior: 'allow', bytesWritten: bytes}
	}

	async fetch(req: FetchRequest): Promise<FetchResult | SandboxDeny> {
		const ctrl = new AbortController()
		const timer =
			req.timeoutMs !== undefined ? setTimeout(() => ctrl.abort(), req.timeoutMs) : undefined
		const composedSignal = req.signal
			? mergeSignals(req.signal, ctrl.signal)
			: ctrl.signal
		try {
			const response = await fetch(req.url, {
				method: req.method,
				headers: req.headers,
				body: req.body as BodyInit | undefined,
				signal: composedSignal,
			})
			const headers: Record<string, string> = {}
			response.headers.forEach((v, k) => {
				headers[k] = v
			})
			return {
				behavior: 'allow',
				status: response.status,
				headers,
				body: await response.text(),
			}
		} finally {
			if (timer) clearTimeout(timer)
		}
	}
}

/** 合并两个 AbortSignal —— 任一 abort 就 abort 总信号。 */
function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
	if (a.aborted) return a
	if (b.aborted) return b
	const ctrl = new AbortController()
	const onAbort = () => ctrl.abort()
	a.addEventListener('abort', onAbort, {once: true})
	b.addEventListener('abort', onAbort, {once: true})
	return ctrl.signal
}
