/**
 * cc-shim/misc.ts — substrate-local 替代各种 cc 业务杂项
 *
 * 这些都是 builtin-tools 工具偶尔用到的 cc 业务接口，substrate 提供保守 stub。
 * Product 想要还原 cc 完整行为，自行替换 import。
 */

// ============================================================
// SandboxManager (sandbox-adapter)
// ============================================================

/** Substrate 默认无 sandbox。Product 可注入接口。 */
export class SandboxManager {
	static instance: SandboxManager | null = null
	static getInstance(): SandboxManager {
		if (!SandboxManager.instance) SandboxManager.instance = new SandboxManager()
		return SandboxManager.instance
	}
	/** No-op：substrate 不强制 sandbox 包裹。 */
	async wrap<T>(fn: () => Promise<T>): Promise<T> {
		return fn()
	}
	isAvailable(): boolean {
		return false
	}
}

export function shouldUseSandbox(_command: string, _ctx?: unknown): boolean {
	return false
}

// ============================================================
// Shell.ts — exec helper
// ============================================================

import {exec as nodeExec} from 'child_process'
import {promisify} from 'util'

const execAsync = promisify(nodeExec)

export interface ExecResult {
	code: number
	stdout: string
	stderr: string
	interrupted: boolean
}

/** 简单 exec（substrate 简化版；cc 含 sandbox / signal / cwd 注入）。 */
export async function exec(
	command: string,
	options?: {timeout?: number; cwd?: string; signal?: AbortSignal},
): Promise<ExecResult> {
	try {
		const {stdout, stderr} = await execAsync(command, {
			timeout: options?.timeout ?? 60_000,
			cwd: options?.cwd ?? process.cwd(),
			signal: options?.signal,
		})
		return {
			code: 0,
			stdout: typeof stdout === 'string' ? stdout : stdout.toString(),
			stderr: typeof stderr === 'string' ? stderr : stderr.toString(),
			interrupted: false,
		}
	} catch (err) {
		const e = err as {code?: number; stdout?: string; stderr?: string; signal?: string}
		return {
			code: typeof e.code === 'number' ? e.code : 1,
			stdout: typeof e.stdout === 'string' ? e.stdout : '',
			stderr: typeof e.stderr === 'string' ? e.stderr : (err as Error).message,
			interrupted: e.signal === 'SIGTERM' || e.signal === 'SIGKILL',
		}
	}
}

// ============================================================
// messages helpers (utils/messages.js)
// ============================================================

export function createUserMessage(content: unknown): {
	type: 'user'
	message: {role: 'user'; content: unknown}
} {
	return {type: 'user', message: {role: 'user', content}}
}

export function createSystemMessage(content: string): {
	type: 'system'
	message: {role: 'system'; content: string}
} {
	return {type: 'system', message: {role: 'system', content}}
}

export function normalizeContentFromAPI<T>(content: T): T {
	return content
}

// ============================================================
// model helpers (utils/model/model.js)
// ============================================================

export function getRuntimeMainLoopModel(opts?: {mainLoopModel?: string}): string {
	return opts?.mainLoopModel ?? 'claude-sonnet-4-20250514'
}

export function renderModelName(model: string): string {
	return model
}

// ============================================================
// systemPromptType (utils/systemPromptType.js)
// ============================================================

export type SystemPrompt = string | string[]

export function asSystemPrompt(s: string | string[]): SystemPrompt {
	return s
}

// ============================================================
// bootstrap/state.js stubs
// ============================================================

const stateMap = new Map<string, unknown>()

export function getKairosActive(): boolean {
	return false
}

export function getInlinePlugins(): unknown[] {
	return []
}

export function getSessionId(): string {
	return (stateMap.get('sessionId') as string) ?? 'substrate-default-session'
}

export function getMainLoopModelOverride(): string | undefined {
	return undefined
}

export function getChromeFlagOverride(): boolean {
	return false
}

export function getFlagSettingsPath(): string | undefined {
	return undefined
}

export function getSessionBypassPermissionsMode(): boolean {
	return false
}

export function clearInvokedSkillsForAgent(_agentId: string): void {
	// no-op
}

// ============================================================
// settings stubs
// ============================================================

export function getSetting<T>(_key: string, fallback: T): T {
	return fallback
}

export type SettingSource = 'user' | 'project' | 'plugin'

// ============================================================
// timeouts
// ============================================================

export const DEFAULT_TIMEOUT_MS = 60_000

// ============================================================
// imageResizer / pdfUtils stubs
// ============================================================

export async function resizeImage(buffer: Buffer): Promise<Buffer> {
	return buffer
}

export async function extractTextFromPdf(_buffer: Buffer): Promise<string> {
	return ''
}

// ============================================================
// services/api/claude.js stubs (主 LLM 调用 — substrate 不该有，Phase B 已用 ScriptedProvider)
// ============================================================

/** 占位（仅让 import 通过）；运行时若真被调用应抛错让用户接 substrate AgentLoop。 */
export async function queryHaiku(): Promise<{content: string}> {
	throw new Error(
		'queryHaiku is a cc product LLM call. Substrate doesn\'t support direct LLM calls in tool internals. Use AgentLoop / Provider injection instead.',
	)
}

// ============================================================
// services/lsp/manager.js + LSPDiagnosticRegistry stubs
// ============================================================

export function getInitializationStatus(): {status: 'pending' | 'ready' | 'not-started'} {
	return {status: 'not-started'}
}

export class LSPDiagnosticRegistry {
	static instance: LSPDiagnosticRegistry | null = null
	static getInstance(): LSPDiagnosticRegistry {
		if (!LSPDiagnosticRegistry.instance)
			LSPDiagnosticRegistry.instance = new LSPDiagnosticRegistry()
		return LSPDiagnosticRegistry.instance
	}
	getDiagnostics(_uri: string): unknown[] {
		return []
	}
}

// ============================================================
// services/mcp/vscodeSdkMcp stubs
// ============================================================

export function notifyVscodeFileUpdated(_path: string): void {
	// no-op
}

// ============================================================
// services/diagnosticTracking stubs
// ============================================================

export function trackDiagnostic(_kind: string, _data?: unknown): void {
	// no-op
}

// ============================================================
// teamMemorySync stubs
// ============================================================

export function teamMemSecretGuard(content: string): string {
	return content
}

// ============================================================
// utils/toolResultStorage stubs
// ============================================================

export function getReplacementById(_id: string): unknown {
	return null
}

// ============================================================
// utils/windowsPaths
// ============================================================

export {posixPathToWindowsPath} from './path.js'

// ============================================================
// types/tools (cc 内部 BashProgress / ShellProgress / AgentToolProgress)
// ============================================================

export type BashProgress = {
	type: string
	output?: string
	fullOutput?: string
	elapsedTimeSeconds?: number
	totalLines?: number
	totalBytes?: number
	timeoutMs?: number
	taskId?: string
	[key: string]: unknown
}

export type ShellProgress = BashProgress

export type AgentToolProgress = {
	type: string
	[key: string]: unknown
}


// ============================================================
// constants/prompts (cc 业务字符串，stub 让 import 通过)
// ============================================================

export function prependBullets(items: string[], prefix = '- '): string {
	return items.map(s => `${prefix}${s}`).join('\n')
}

// ============================================================
// constants/files / apiLimits
// ============================================================

const BINARY_EXTENSIONS = new Set([
	'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
	'.pdf', '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
	'.exe', '.dll', '.so', '.dylib', '.bin', '.wasm',
	'.mp3', '.mp4', '.avi', '.mov', '.flv', '.wmv',
])

export function hasBinaryExtension(path: string): boolean {
	const lower = path.toLowerCase()
	for (const ext of BINARY_EXTENSIONS) {
		if (lower.endsWith(ext)) return true
	}
	return false
}

export const MAX_FILE_SIZE_BYTES = 256 * 1024 // 256KB
export const MAX_RESULT_TOKENS = 25_000

// ============================================================
// utils/git stubs
// ============================================================

export function isCurrentDirectoryBareGitRepo(): boolean {
	return false
}

// ============================================================
// utils/shell/outputLimits / readOnlyCommandValidation
// ============================================================

export function getMaxOutputLength(): number {
	return 30_000 // chars
}

const READ_ONLY_BASH_COMMANDS = new Set([
	'cat', 'less', 'more', 'head', 'tail', 'pwd', 'echo', 'whoami', 'date',
	'ls', 'find', 'tree', 'wc', 'sort', 'uniq', 'grep', 'awk', 'sed', 'cut',
	'env', 'printenv', 'which', 'type', 'help', 'man', 'info',
	'git', // git read-only subcommands handled by deeper validation in cc; substrate 简化为允许
	'node', 'python', 'python3', 'ruby', 'go', 'cargo', 'npm', 'bun',
])

export function isReadOnlyShellCommand(command: string): boolean {
	const first = command.trim().split(/\s+/)[0] ?? ''
	return READ_ONLY_BASH_COMMANDS.has(first)
}

// ============================================================
// state/AppState stub (cc UI app state)
// ============================================================

export type AppState = Record<string, unknown>

export function getAppState(): AppState {
	return {}
}

export function setAppState(_partial: Partial<AppState>): void {
	// no-op
}

export function useAppStateStore(): {getState: () => AppState} {
	return {getState: () => ({})}
}

export function useSetAppState(): (partial: Partial<AppState>) => void {
	return () => {}
}

// ============================================================
// tasks/LocalShellTask stub
// ============================================================

export function backgroundAll(_getState: () => AppState, _setAppState: unknown): void {
	// no-op (substrate 不维护 cc 后台任务)
}

// ============================================================
// types/ids stub
// ============================================================

export type AgentId = string

// ============================================================
// types/message stub (用 engine re-export 更好但避免循环)
// ============================================================

export type AssistantMessage = {
	type: 'assistant'
	uuid: string
	message: unknown
	[key: string]: unknown
}

export type ProgressMessage<T = unknown> = {
	type: 'progress'
	data: T
	[key: string]: unknown
}

// ============================================================
// utils/claudeCodeHints / codeIndexing / stringUtils 等杂项
// ============================================================

export function extractClaudeCodeHints(_command: string): string[] {
	return []
}

export function detectCodeIndexingFromCommand(_command: string): boolean {
	return false
}

export class EndTruncatingAccumulator {
	private buffer = ''
	private readonly limit: number
	constructor(limit = 30_000) {
		this.limit = limit
	}
	append(chunk: string): void {
		this.buffer += chunk
		if (this.buffer.length > this.limit) {
			this.buffer = this.buffer.slice(-this.limit)
		}
	}
	getValue(): string {
		return this.buffer
	}
}

// ============================================================
// utils/plugins / utils/task / utils/notebook / utils/pdf 等
// ============================================================

export function maybeRecordPluginHint(_command: string): void {
	// no-op
}

export interface ExecResultExt extends ExecResult {
	[key: string]: unknown
}

export function getTaskOutputPath(_taskId: string): string {
	return ''
}

export class TaskOutput {
	taskId = ''
	output = ''
	completed = false
	constructor(_taskId?: string) {}
	append(_chunk: string): void {}
	finalize(): void {}
}

export async function readNotebook(_path: string): Promise<{cells: unknown[]; nbformat: number}> {
	return {cells: [], nbformat: 4}
}

export async function readPDF(_path: string): Promise<string> {
	return ''
}

export async function getPDFPageCount(_path: string): Promise<number> {
	return 0
}

export async function extractPDFPages(_path: string, _pages: number[]): Promise<string> {
	return ''
}

// ============================================================
// utils/memoryFileDetection / memdir/memoryAge
// ============================================================

export function isAutoMemFile(_path: string): boolean {
	return false
}

export function memoryFreshnessNote(_path: string): string {
	return ''
}

// ============================================================
// services/tokenEstimation
// ============================================================

export function estimateTokens(text: string): number {
	// 粗略估计：1 token ≈ 4 chars (OpenAI rule of thumb)
	return Math.ceil(text.length / 4)
}

export function estimateTokensFromMessages(_messages: unknown[]): number {
	return 0
}

// ============================================================
// utils/readFileInRange
// ============================================================

export function readFileInRange(
	path: string,
	startLine: number,
	endLine: number,
	encoding: BufferEncoding = 'utf8',
): string {
	const content = readFileSyncStub(path, encoding)
	const lines = content.split('\n')
	return lines.slice(startLine - 1, endLine).join('\n')
}

// 局部 readFileSync 兜底（避免循环 import）
function readFileSyncStub(path: string, encoding: BufferEncoding): string {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const fs = require('fs') as typeof import('fs')
		return fs.readFileSync(path, encoding)
	} catch {
		return ''
	}
}

// ============================================================
// utils/glob
// ============================================================

import {readdirSync as fsReaddirSync, statSync as fsStatSync} from 'fs'
import {join as pathJoin, sep as pathSep} from 'path'

export interface GlobOptions {
	cwd?: string
	limit?: number
	absolute?: boolean
}

/** 简化 glob：支持 ** / * / ? 基础模式。 */
export async function glob(pattern: string, options: GlobOptions = {}): Promise<string[]> {
	const cwd = options.cwd ?? process.cwd()
	const limit = options.limit ?? 1000
	const results: string[] = []

	// 把 pattern 转成 RegExp（简化版，支持 *, **, ?）
	const regex = globPatternToRegex(pattern)

	function walk(dir: string, depth: number): void {
		if (depth > 20 || results.length >= limit) return
		let entries: string[]
		try {
			entries = fsReaddirSync(dir)
		} catch {
			return
		}
		for (const name of entries) {
			if (results.length >= limit) return
			if (name.startsWith('.')) continue
			if (name === 'node_modules') continue
			const full = pathJoin(dir, name)
			let stat
			try {
				stat = fsStatSync(full)
			} catch {
				continue
			}
			const rel = full.startsWith(cwd) ? full.slice(cwd.length + 1) : full
			if (regex.test(rel)) {
				results.push(options.absolute ? full : rel)
			}
			if (stat.isDirectory()) {
				walk(full, depth + 1)
			}
		}
	}

	walk(cwd, 0)
	return results
}

function globPatternToRegex(pattern: string): RegExp {
	let regex = ''
	for (let i = 0; i < pattern.length; i++) {
		const ch = pattern[i]!
		if (ch === '*') {
			if (pattern[i + 1] === '*') {
				regex += '.*'
				i++ // skip second *
				if (pattern[i + 1] === pathSep || pattern[i + 1] === '/') i++ // skip following sep
			} else {
				regex += '[^/]*'
			}
		} else if (ch === '?') {
			regex += '[^/]'
		} else if ('.+^$|()[]{}\\'.includes(ch)) {
			regex += `\\${ch}`
		} else {
			regex += ch
		}
	}
	return new RegExp(`^${regex}$`)
}

// ============================================================
// utils/settings/validateEditTool stub
// ============================================================

export function validateInputForSettingsFileEdit(_input: unknown): {valid: boolean; reason?: string} {
	return {valid: true}
}

// ============================================================
// utils/ShellCommand stub
// ============================================================

export type ShellCommandExecResult = ExecResult


// ============================================================
// constants/apiLimits.js
// ============================================================
export const MAX_FILE_BYTES = 256 * 1024
export const MAX_LINES_PER_FILE = 50_000
export const MAX_OUTPUT_BYTES = 1 * 1024 * 1024
export const TOOL_RESULT_BUDGET_BYTES = 25_000
export const MAX_NON_STREAMING_TOKENS = 64_000

// ============================================================
// constants/files.js
// ============================================================
export function hasBinaryExtension(p: string): boolean {
	return /\.(jpg|jpeg|png|gif|bmp|webp|ico|pdf|zip|tar|gz|exe|dll|so|dylib|class|jar|wasm|bin|dat|db)$/i.test(p)
}
export const BINARY_EXTENSIONS: readonly string[] = []

// ============================================================
// constants/prompts.js
// ============================================================
export function prependBullets(items: string[]): string {
	return items.map(i => `- ${i}`).join('\n')
}

// ============================================================
// memdir/memoryAge.js
// ============================================================
export function memoryFreshnessNote(_path: string): string | null {
	return null
}

// ============================================================
// services/tokenEstimation
// ============================================================
export function estimateTokenCount(text: string): number {
	return Math.ceil(text.length / 4)
}
export function estimateTokensForString(text: string): number {
	return estimateTokenCount(text)
}

// ============================================================
// state/AppState
// ============================================================
export type AppState = Record<string, unknown> & {
	toolPermissionContext: {mode: string}
	mcp?: unknown
	fastMode?: boolean
	effortValue?: string
	advisorModel?: string
}
export function useAppStateStore(): {getState(): AppState} {
	return {getState: () => ({toolPermissionContext: {mode: 'default'}}) as AppState}
}
export function useSetAppState(): (s: Partial<AppState>) => void {
	return () => {
		// no-op
	}
}

// ============================================================
// tasks/LocalShellTask
// ============================================================
export function backgroundAll(_getState?: () => AppState, _setState?: (s: AppState) => void, _toolUseId?: string): void {
	// no-op
}
export type LocalShellTask = {id: string; status: string}

// ============================================================
// types/ids
// ============================================================
export type AgentId = string
export function asAgentId(s: string): AgentId {
	return s as AgentId
}

// ============================================================
// types/message (Subset for builtin-tools)
// ============================================================
export type AssistantMessage = {
	type: 'assistant'
	uuid: string
	message: {role: 'assistant'; content: unknown}
}
export type ProgressMessage<T = unknown> = {data: T; [key: string]: unknown}
export type ContentItem = unknown
export type Message = AssistantMessage | ProgressMessage | {type: string; [key: string]: unknown}

// ============================================================
// utils/ShellCommand
// ============================================================
// Note: ExecResult already exported above

// ============================================================
// utils/claudeCodeHints
// ============================================================
export function extractClaudeCodeHints(_command: string): string[] {
	return []
}

// ============================================================
// utils/codeIndexing
// ============================================================
export function detectCodeIndexingFromCommand(_cmd: string): {detected: boolean} {
	return {detected: false}
}

// ============================================================
// utils/execFileNoThrow
// ============================================================
export async function execFileNoThrow(
	_file: string,
	_args: string[],
	_options?: {timeout?: number; cwd?: string},
): Promise<{stdout: string; stderr: string; code: number}> {
	return {stdout: '', stderr: '', code: 0}
}

// ============================================================
// utils/git
// ============================================================
export function isCurrentDirectoryBareGitRepo(): boolean {
	return false
}

// ============================================================
// utils/glob
// ============================================================
export async function glob(_pattern: string, _options?: unknown): Promise<string[]> {
	return []
}

// ============================================================
// utils/http
// ============================================================
export async function httpGet(_url: string): Promise<{status: number; body: string}> {
	return {status: 0, body: ''}
}

// ============================================================
// utils/mcpOutputStorage
// ============================================================
export function storeMcpOutput(_id: string, _content: unknown): void {
	// no-op
}
export function getMcpOutput(_id: string): unknown {
	return null
}

// ============================================================
// utils/memoryFileDetection
// ============================================================
export function isAutoMemFile(_path: string): boolean {
	return false
}

// ============================================================
// utils/model/providers
// ============================================================
export function getAPIProvider(): string {
	return 'anthropic'
}
export function isFirstPartyAnthropicBaseUrl(): boolean {
	return true
}

// ============================================================
// utils/notebook
// ============================================================
export function readNotebook(_path: string): unknown {
	return null
}
export function writeNotebook(_path: string, _content: unknown): void {
	// no-op
}

// ============================================================
// utils/pdf
// ============================================================
export async function readPDF(_path: string): Promise<string> {
	return ''
}
export async function getPDFPageCount(_path: string): Promise<number> {
	return 0
}
export async function extractPDFPages(_path: string, _pages?: number[]): Promise<string> {
	return ''
}

// ============================================================
// utils/plugins/hintRecommendation
// ============================================================
export function maybeRecordPluginHint(_hint: unknown): void {
	// no-op
}

// ============================================================
// utils/plugins/orphanedPluginFilter
// ============================================================
export function filterOrphanedPlugins<T>(items: T[]): T[] {
	return items
}

// ============================================================
// utils/readFileInRange
// ============================================================
import {readFileSync as readFileSyncRaw} from 'fs'
export function readFileInRange(
	path: string,
	startLine: number,
	endLine: number,
): {content: string; totalLines: number} {
	try {
		const content = readFileSyncRaw(path, 'utf8')
		const lines = content.split('\n')
		const slice = lines.slice(startLine - 1, endLine).join('\n')
		return {content: slice, totalLines: lines.length}
	} catch {
		return {content: '', totalLines: 0}
	}
}

// ============================================================
// utils/ripgrep
// ============================================================
export const ripgrepCommand = 'rg'
export async function ripgrepSearch(_pattern: string, _options?: unknown): Promise<string[]> {
	return []
}

// ============================================================
// utils/settings/validateEditTool
// ============================================================
export function validateInputForSettingsFileEdit(_input: unknown): {valid: boolean; reason?: string} {
	return {valid: true}
}

// ============================================================
// utils/shell/outputLimits
// ============================================================
export function getMaxOutputLength(): number {
	return 1024 * 1024
}

// ============================================================
// utils/shell/readOnlyCommandValidation
// ============================================================
export function isReadOnlyCommand(_cmd: string): boolean {
	return false
}
export function getReadOnlyCommandsList(): readonly string[] {
	return []
}

// ============================================================
// utils/stringUtils
// ============================================================
export class EndTruncatingAccumulator {
	private buffer = ''
	private readonly maxLength: number
	constructor(maxLength = 100_000) {
		this.maxLength = maxLength
	}
	append(text: string): void {
		this.buffer += text
		if (this.buffer.length > this.maxLength) {
			this.buffer = this.buffer.slice(-this.maxLength)
		}
	}
	get value(): string {
		return this.buffer
	}
	clear(): void {
		this.buffer = ''
	}
}

export function countCharInString(s: string, ch: string): number {
	let count = 0
	for (const c of s) if (c === ch) count++
	return count
}

// ============================================================
// utils/task/TaskOutput + diskOutput
// ============================================================
export class TaskOutput {
	private content = ''
	append(s: string): void {
		this.content += s
	}
	get value(): string {
		return this.content
	}
}
export function getTaskOutputPath(_taskId: string): string {
	return ''
}
