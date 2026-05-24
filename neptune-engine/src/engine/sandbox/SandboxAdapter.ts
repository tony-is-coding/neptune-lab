/**
 * SandboxAdapter — Substrate 协议：让"危险"操作（exec / fs / fetch）经过统一护栏
 *
 * 设计目标：
 * - engine 不直接跑 child_process / fs.writeFile / fetch；让 BashTool /
 *   FileWriteTool / WebFetchTool 透过 ctx.sandbox 调用
 * - product 可注入更严格的实现（容器 / unshare / firecracker），
 *   但 engine 默认提供规则级 LocalSandbox（与 cc 实战对齐：bash prefix
 *   safety + path traversal + domain allowlist）
 *
 * 设计原则：
 * - deny 不抛错（包成 SandboxDeny），交给 caller 决定如何包成 ToolResult is_error
 * - abort signal 一路传到底；exec/fetch 在 100ms 内退出
 * - 所有 IO 操作 timeout 强制兜底
 */

/** Sandbox 拒绝结果 — 不抛错，让调用方包成 ToolResult is_error。 */
export interface SandboxDeny {
	behavior: 'deny'
	reason: string
}

/** exec 请求 */
export interface ExecRequest {
	/** 完整 shell 命令字符串。 */
	command: string
	/** 工作目录（绝对路径）。 */
	cwd: string
	/** 环境变量（默认继承）。 */
	env?: Record<string, string>
	/** 超时毫秒（默认 30_000）。 */
	timeoutMs?: number
	/** 取消信号。 */
	signal?: AbortSignal
}

/** exec 成功结果 */
export interface ExecResult {
	stdout: string
	stderr: string
	exitCode: number
	/** true 表示因 timeout 被 kill。 */
	killedByTimeout?: boolean
	behavior: 'allow'
}

/** readFile 请求选项 */
export interface ReadFileOptions {
	/** 'utf8' 或 'binary'（默认 utf8）。 */
	encoding?: 'utf8' | 'binary'
	/** 最大字节数（默认 10MB）。 */
	maxBytes?: number
	signal?: AbortSignal
}

/** readFile 成功结果 */
export interface ReadFileResult {
	behavior: 'allow'
	content: string | Uint8Array
	bytesRead: number
}

/** writeFile 请求选项 */
export interface WriteFileOptions {
	/** 创建模式（'overwrite' / 'create-only' / 'append'）。 */
	mode?: 'overwrite' | 'create-only' | 'append'
	signal?: AbortSignal
}

/** writeFile 成功结果 */
export interface WriteFileResult {
	behavior: 'allow'
	bytesWritten: number
}

/** fetch 请求 */
export interface FetchRequest {
	url: string
	method?: string
	headers?: Record<string, string>
	body?: string | Uint8Array
	timeoutMs?: number
	signal?: AbortSignal
}

/** fetch 成功结果 */
export interface FetchResult {
	behavior: 'allow'
	status: number
	headers: Record<string, string>
	body: string
}

/**
 * SandboxAdapter 接口。
 *
 * 所有方法返回 `Result | SandboxDeny`（不抛错）。
 * 真实异常（network down / disk full）才抛 native error。
 */
export interface SandboxAdapter {
	exec(req: ExecRequest): Promise<ExecResult | SandboxDeny>
	readFile(path: string, opts?: ReadFileOptions): Promise<ReadFileResult | SandboxDeny>
	writeFile(
		path: string,
		content: string | Uint8Array,
		opts?: WriteFileOptions,
	): Promise<WriteFileResult | SandboxDeny>
	fetch(req: FetchRequest): Promise<FetchResult | SandboxDeny>
}
