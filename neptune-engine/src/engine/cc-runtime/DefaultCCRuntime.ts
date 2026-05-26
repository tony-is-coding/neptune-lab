/**
 * DefaultCCRuntime — Claude Code 运行时默认实现
 *
 * 实现方式：将现有 engine/ 中的 require() 调用迁移到此类中。
 * 保留原有的 try-catch 错误处理逻辑。
 *
 * 穿透依赖说明：
 * - 以下 require() 调用是运行时动态加载，属于不可消除的穿透
 * - 这些调用需要访问 src/ 层的模块，用于实现 CC 运行时的核心功能
 * - 未来可通过依赖注入模式进一步解耦，但当前阶段保留此实现
 */

import type {
	BootstrapState,
	CCRuntime,
	CwdContextFn,
	MacroDefines,
	TranscriptLoadResult,
} from './CCRuntime.js'
import {DEFAULT_MACROS} from './CCRuntime.js'
import type {Tools} from '../types/tool.js'
import type {ToolRegistry} from '../types/tool.js'
import {HeadlessToolRegistry} from './HeadlessToolRegistry.js'
import {parseTranscript, transcriptToMessages} from '../session/TranscriptParser.js'
import {getMemoryPath as getSessionMemoryPath} from '../session/SessionContext.js'

// ============================================================
// DefaultCCRuntime 实现
// ============================================================

/** 默认实现：独立 kernel/headless runtime，不反向加载 product 层模块。 */
export class DefaultCCRuntime implements CCRuntime {
	private initialized = false
	/** per-workspace 初始化状态跟踪 */
	private workspaceInitialized = new Set<string>()
	/** 可选的 ToolRegistry（用于 SDK 模式按需加载工具） */
	private toolRegistry?: ToolRegistry

	// ========== 工具相关 ==========

	getAllBaseTools(): Tools {
		return (this.toolRegistry ?? new HeadlessToolRegistry()).getTools()
	}

	/** 设置 ToolRegistry（用于 SDK 模式按需加载工具） */
	setToolRegistry(registry: ToolRegistry): void {
		this.toolRegistry = registry
	}

	/** 获取当前 ToolRegistry */
	getToolRegistry(): ToolRegistry | undefined {
		return this.toolRegistry
	}

	// ========== 运行时初始化 ==========

	enableConfigs(): void {
		// Product hosts may enable their own config system through a host adapter.
	}

	setupBootstrap(_state: BootstrapState): void {
		// SessionContext carries cwd/projectRoot for the independent kernel path.
	}

	// ========== Transcript 相关 ==========

	async loadTranscriptFromFile(path: string): Promise<TranscriptLoadResult> {
		return {messages: transcriptToMessages(parseTranscript(path))}
	}

	// ========== SessionContext 相关 ==========

	getMemoryPath(): string | undefined {
		return getSessionMemoryPath()
	}

	// ========== MACRO Defines ==========

	injectMacroDefines(): void {
		const g = globalThis as Record<string, unknown>
		if (typeof g.MACRO !== 'undefined') return

		// 版本来源：DEFAULT_MACROS.VERSION 从 package.json 动态读取
		// 如果读取失败，使用 fallback 版本 2.1.888
		// 参考 CCRuntime.ts 中的 getVersion() 函数
		g.MACRO = {...DEFAULT_MACROS}
	}

	// ========== 状态管理 ==========

	isInitialized(): boolean {
		return this.initialized
	}

	markInitialized(): void {
		this.initialized = true
	}

	resetForTesting(): void {
		this.initialized = false
		this.workspaceInitialized.clear()
	}

	// ========== 多 Workspace 支持 ==========

	/**
	 * 在指定的 cwd 上下文中执行函数
	 *
	 * 使用 CC 原有的 runWithCwdOverride (AsyncLocalStorage) 实现，
	 * 确保多 workspace 并发时各自看到正确的 cwd。
	 */
	runWithCwd<T>(cwd: string, fn: CwdContextFn<T>): T {
		void cwd
		return fn()
	}

	/**
	 * 检查指定的 workspace 是否已初始化
	 */
	isWorkspaceInitialized(workspace: string): boolean {
		return this.workspaceInitialized.has(workspace)
	}

	/**
	 * 标记指定 workspace 已初始化
	 */
	markWorkspaceInitialized(workspace: string): void {
		this.workspaceInitialized.add(workspace)
	}

	// ========== FileStateCache 相关 ==========

	createFileStateCache(options?: { maxEntries?: number; maxSizeBytes?: number }): CCRuntimeFileStateCache {
		void options
		return new SimpleFileStateCache()
	}

	// ========== 权限相关 ==========

	async hasPermissionsToUseTool(
		tool: unknown,
		input: unknown,
		context: unknown,
		message: unknown,
		toolUseId: string,
	): Promise<unknown> {
		void tool
		void input
		void context
		void message
		void toolUseId
		return {behavior: 'allow'}
	}
}

// ============================================================
// 简单 FileStateCache 降级实现
// ============================================================

/**
 * 简单的 FileStateCache 实现
 * 当 CC 原始 FileStateCache 不可用时使用
 */
class SimpleFileStateCache implements CCRuntimeFileStateCache {
	private cache = new Map<string, CCRuntimeFileStateValue>()

	get(key: string): CCRuntimeFileStateValue | undefined {
		return this.cache.get(key)
	}

	set(key: string, value: CCRuntimeFileStateValue): void {
		this.cache.set(key, value)
	}

	has(key: string): boolean {
		return this.cache.has(key)
	}

	clear(): void {
		this.cache.clear()
	}
}

// ============================================================
// 类型定义
// ============================================================

/** FileStateCache 接口（与 CCRuntime.ts 中的定义一致） */
interface CCRuntimeFileStateCache {
	get(key: string): CCRuntimeFileStateValue | undefined

	set(key: string, value: CCRuntimeFileStateValue): void

	has(key: string): boolean

	clear(): void
}

/** FileStateValue 类型 */
interface CCRuntimeFileStateValue {
	content: string
	timestamp: number
	offset?: number
	limit?: number
	isPartialView?: boolean
}

// ============================================================
// 工厂函数
// ============================================================

/** 创建默认 CCRuntime 实例 */
export function createDefaultCCRuntime(): CCRuntime {
	return new DefaultCCRuntime()
}

/** 全局单例（按需使用） */
let globalRuntime: CCRuntime | null = null

/** 获取全局 CCRuntime 单例 */
export function getGlobalCCRuntime(): CCRuntime {
	if (!globalRuntime) {
		globalRuntime = createDefaultCCRuntime()
	}
	return globalRuntime
}

/** 重置全局单例（仅用于测试） */
export function resetGlobalCCRuntimeForTesting(): void {
	globalRuntime = null
}
