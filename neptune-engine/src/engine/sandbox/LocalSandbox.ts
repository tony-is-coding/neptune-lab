/**
 * LocalSandbox — secure-by-default 规则级护栏（与 cc 实战做法对齐）
 *
 * 不依赖容器/firecracker，仅靠：
 * 1. **bash prefix safety**: 命令不能以危险前缀开头（rm -rf /、curl|sh 等）
 * 2. **path allowlist**: cwd / readFile / writeFile 路径必须在 working dir
 *    allowlist 之内（防 path traversal）
 * 3. **fetch domain allowlist**: URL 必须在 host allowlist（默认 ['*'] 允许全部，
 *    product 应收紧）
 * 4. **size / timeout 兜底**: 防失控
 *
 * 与 cc 行为差异：
 * - cc 的 prefix 安全检查依赖 LLM 判断（advisor）+ 用户对话；这里降级为
 *   静态名单（更可预测，product 可注入更智能版本）
 * - cc 的 sandbox 实际是 macOS sandbox-exec / Linux nsjail；这里规则级
 *   更轻量、跨平台、可移植
 */

import {exec as nodeExec} from 'node:child_process'
import {promisify} from 'node:util'
import {readFile, writeFile, appendFile, stat} from 'node:fs/promises'
import {resolve, isAbsolute} from 'node:path'
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

/** 危险 bash 命令前缀名单（保守）。 */
const DEFAULT_BASH_DENY_PREFIXES = [
	/^\s*rm\s+(-rf?|--recursive|-r)\s+\/(?:\s|$)/i, // rm -rf /
	/^\s*rm\s+-rf?\s+~\s*$/i, // rm -rf ~
	/^\s*:\(\)\s*\{/, // fork bomb :(){
	/^\s*dd\s+if=\/dev\/(?:zero|random)/i, // dd 写硬盘
	/^\s*mkfs\b/i, // 格式化
	/^\s*chmod\s+-R\s+777\s+\//, // 全盘 777
	/curl\s+.*\|\s*(?:sh|bash|zsh|sudo)/i, // curl | sh
	/wget\s+.*\|\s*(?:sh|bash|zsh|sudo)/i, // wget | sh
	/eval\s+.*[`$]/, // eval 包动态字符串
]

export interface LocalSandboxConfig {
	/**
	 * 工作目录 allowlist（绝对路径前缀）。任何 cwd / readFile / writeFile
	 * 路径必须以 allowlist 中的某个前缀开头。
	 */
	workingDirAllowlist: string[]
	/** 是否启用 bash prefix 安全检查（默认 true）。 */
	bashPrefixSafety?: boolean
	/** Fetch 允许的 host 列表（默认 ['*'] 允许全部 host；product 应收紧）。 */
	fetchHostAllowlist?: string[]
	/** Fetch 拒绝的 host 列表（黑名单优先于白名单）。 */
	fetchHostDenylist?: string[]
	/** 单文件最大读取字节数。 */
	maxFileSize?: number
	/** exec 默认超时毫秒。 */
	defaultExecTimeoutMs?: number
	/** Fetch 默认超时毫秒。 */
	defaultFetchTimeoutMs?: number
	/** 自定义 bash deny prefix 列表（追加到默认）。 */
	additionalBashDenyPatterns?: RegExp[]
}

export class LocalSandbox implements SandboxAdapter {
	private readonly bashDenyPatterns: RegExp[]

	constructor(private readonly config: LocalSandboxConfig) {
		this.bashDenyPatterns = [
			...(config.bashPrefixSafety !== false ? DEFAULT_BASH_DENY_PREFIXES : []),
			...(config.additionalBashDenyPatterns ?? []),
		]
	}

	async exec(req: ExecRequest): Promise<ExecResult | SandboxDeny> {
		// 1. cwd 必须在 allowlist
		const cwdGuard = this.checkPathAllowed(req.cwd, 'cwd')
		if (cwdGuard) return cwdGuard

		// 2. 命令前缀安全
		const prefixGuard = this.checkBashPrefix(req.command)
		if (prefixGuard) return prefixGuard

		// 3. exec
		const timeout = req.timeoutMs ?? this.config.defaultExecTimeoutMs ?? DEFAULT_TIMEOUT_MS
		try {
			const result = await execAsync(req.command, {
				cwd: req.cwd,
				env: req.env ?? process.env,
				timeout,
				signal: req.signal,
				maxBuffer: 10 * 1024 * 1024,
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
		const guard = this.checkPathAllowed(path, 'readFile path')
		if (guard) return guard
		const maxBytes = opts.maxBytes ?? this.config.maxFileSize ?? DEFAULT_MAX_BYTES
		try {
			const s = await stat(path)
			if (s.size > maxBytes) {
				return {behavior: 'deny', reason: `File too large: ${s.size} bytes > ${maxBytes}`}
			}
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
				return {behavior: 'deny', reason: `File not found: ${path}`}
			}
			throw err
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
		const guard = this.checkPathAllowed(path, 'writeFile path')
		if (guard) return guard
		const mode = opts.mode ?? 'overwrite'
		const bytes =
			typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : content.byteLength
		const maxBytes = this.config.maxFileSize ?? DEFAULT_MAX_BYTES
		if (bytes > maxBytes) {
			return {behavior: 'deny', reason: `Write payload too large: ${bytes} > ${maxBytes}`}
		}
		if (mode === 'create-only') {
			try {
				await stat(path)
				return {behavior: 'deny', reason: `File already exists (create-only): ${path}`}
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
			}
		}
		if (mode === 'append') {
			await appendFile(path, content)
		} else {
			await writeFile(path, content)
		}
		return {behavior: 'allow', bytesWritten: bytes}
	}

	async fetch(req: FetchRequest): Promise<FetchResult | SandboxDeny> {
		// 1. URL 解析
		let parsed: URL
		try {
			parsed = new URL(req.url)
		} catch {
			return {behavior: 'deny', reason: `Invalid URL: ${req.url}`}
		}
		// 只允许 http(s)
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			return {behavior: 'deny', reason: `Disallowed protocol: ${parsed.protocol}`}
		}
		// 2. host allowlist / denylist
		const host = parsed.hostname.toLowerCase()
		const denylist = this.config.fetchHostDenylist ?? []
		if (denylist.some(d => matchHost(host, d))) {
			return {behavior: 'deny', reason: `Host on denylist: ${host}`}
		}
		const allowlist = this.config.fetchHostAllowlist ?? ['*']
		if (!allowlist.some(a => matchHost(host, a))) {
			return {behavior: 'deny', reason: `Host not on allowlist: ${host}`}
		}

		// 3. fetch with timeout
		const timeoutMs =
			req.timeoutMs ?? this.config.defaultFetchTimeoutMs ?? DEFAULT_TIMEOUT_MS
		const ctrl = new AbortController()
		const timer = setTimeout(() => ctrl.abort(), timeoutMs)
		const composedSignal = req.signal ? mergeSignals(req.signal, ctrl.signal) : ctrl.signal
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
			clearTimeout(timer)
		}
	}

	private checkPathAllowed(path: string, label: string): SandboxDeny | undefined {
		if (!isAbsolute(path)) {
			return {behavior: 'deny', reason: `${label} must be absolute path: ${path}`}
		}
		const resolved = resolve(path)
		// 防 path traversal: 任何 .. 解析后必须仍在 allowlist 内
		const allowed = this.config.workingDirAllowlist.some(prefix => {
			const resolvedPrefix = resolve(prefix)
			return (
				resolved === resolvedPrefix || resolved.startsWith(resolvedPrefix + '/')
			)
		})
		if (!allowed) {
			return {
				behavior: 'deny',
				reason: `${label} outside workingDirAllowlist: ${resolved}`,
			}
		}
		return undefined
	}

	private checkBashPrefix(command: string): SandboxDeny | undefined {
		for (const pattern of this.bashDenyPatterns) {
			if (pattern.test(command)) {
				return {
					behavior: 'deny',
					reason: `Command rejected by bash prefix safety: ${pattern.source}`,
				}
			}
		}
		return undefined
	}
}

function matchHost(host: string, pattern: string): boolean {
	if (pattern === '*') return true
	const p = pattern.toLowerCase()
	if (p.startsWith('*.')) {
		const suffix = p.slice(1) // ".example.com"
		return host === p.slice(2) || host.endsWith(suffix)
	}
	return host === p
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
	if (a.aborted) return a
	if (b.aborted) return b
	const ctrl = new AbortController()
	const onAbort = () => ctrl.abort()
	a.addEventListener('abort', onAbort, {once: true})
	b.addEventListener('abort', onAbort, {once: true})
	return ctrl.signal
}
