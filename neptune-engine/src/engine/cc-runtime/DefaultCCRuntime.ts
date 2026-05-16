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

import {LogUtil} from '../log'
import type {
	BootstrapState,
	CCRuntime,
	CwdContextFn,
	MacroDefines,
	QueryEngineConfig,
	QueryEngineWrapper,
	TranscriptLoadResult,
} from './CCRuntime.js'
import {DEFAULT_MACROS} from './CCRuntime.js'
import type {Tools} from '../../Tool.js'
import type {ToolRegistry} from '../../ToolRegistry.js'

// ============================================================
// DefaultCCRuntime 实现
// ============================================================

/** 默认实现：使用真实的 CC 模块 require */
export class DefaultCCRuntime implements CCRuntime {
	private initialized = false
	/** per-workspace 初始化状态跟踪 */
	private workspaceInitialized = new Set<string>()
	/** 可选的 ToolRegistry（用于 SDK 模式按需加载工具） */
	private toolRegistry?: ToolRegistry

	// ========== 工具相关 ==========

	getAllBaseTools(): Tools {
		// 如果设置了 ToolRegistry，使用它获取工具（SDK 模式）
		if (this.toolRegistry) {
			return this.toolRegistry.getTools({} as any)
		}

		// 默认行为：加载所有工具（CLI 模式）
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const {getAllBaseTools} = require('../../tools.js') as typeof import('../../tools.js')
			return getAllBaseTools()
		} catch (e) {
			LogUtil.warn('[CCRuntime] getAllBaseTools() failed:', {detail: (e as Error).message})
			return []
		}
	}

	/** 设置 ToolRegistry（用于 SDK 模式按需加载工具） */
	setToolRegistry(registry: ToolRegistry): void {
		this.toolRegistry = registry
		LogUtil.debug('[CCRuntime] ToolRegistry set:', {
			coreToolCount: registry.getCoreToolCount(),
		})
	}

	/** 获取当前 ToolRegistry */
	getToolRegistry(): ToolRegistry | undefined {
		return this.toolRegistry
	}

	// ========== 运行时初始化 ==========

	enableConfigs(): void {
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const {enableConfigs} = require('../../utils/config.js') as typeof import('../../utils/config.js')
			enableConfigs()
		} catch (e) {
			// 配置系统初始化失败不阻塞，记录警告
			LogUtil.warn('[CCRuntime] enableConfigs() failed:', {detail: (e as Error).message})
		}
	}

	setupBootstrap(state: BootstrapState): void {
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const {setCwdState, setOriginalCwd, setProjectRoot} =
				require('../../bootstrap/state.js') as typeof import('../../bootstrap/state.js')
			setCwdState(state.cwd)
			setOriginalCwd(state.originalCwd)
			setProjectRoot(state.projectRoot)
		} catch (e) {
			LogUtil.warn('[CCRuntime] bootstrap state setup failed:', {detail: (e as Error).message})
		}
	}

	// ========== QueryEngine 相关 ==========

	createQueryEngine(config: QueryEngineConfig): QueryEngineWrapper {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const {QueryEngine} = require('../../QueryEngine.js') as typeof import('../../QueryEngine.js')
		// QueryEngine 的实际类型比 QueryEngineWrapper 复杂，但运行时行为正确
		// 使用双重断言绕过类型检查
		return new QueryEngine(config) as unknown as QueryEngineWrapper
	}

	// ========== Transcript 相关 ==========

	async loadTranscriptFromFile(path: string): Promise<TranscriptLoadResult> {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const {loadTranscriptFromFile} = require('../../utils/sessionStorage.js') as typeof import('../../utils/sessionStorage.js')
		return loadTranscriptFromFile(path)
	}

	// ========== SessionContext 相关 ==========

	getMemoryPath(): string | undefined {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const {getMemoryPath} = require('../session/SessionContext.js') as typeof import('../session/SessionContext.js')
		return getMemoryPath()
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
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const {runWithCwdOverride} = require('../../utils/cwd.js') as typeof import('../../utils/cwd.js')
		return runWithCwdOverride(cwd, fn)
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
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const {FileStateCache: CCFileStateCache} = require('../../utils/fileStateCache.js') as {
				FileStateCache: new (maxEntries: number, maxSizeBytes: number) => CCRuntimeFileStateCache
			}
			const maxEntries = options?.maxEntries ?? 100
			const maxSizeBytes = options?.maxSizeBytes ?? 25 * 1024 * 1024
			return new CCFileStateCache(maxEntries, maxSizeBytes)
		} catch (e) {
			LogUtil.warn('[CCRuntime] createFileStateCache() failed:', {detail: (e as Error).message})
			// 返回一个简单的内存缓存作为降级实现
			return new SimpleFileStateCache()
		}
	}

	// ========== 权限相关 ==========

	async hasPermissionsToUseTool(
		tool: unknown,
		input: unknown,
		context: unknown,
		message: unknown,
		toolUseId: string,
	): Promise<unknown> {
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const {hasPermissionsToUseTool: ccHasPermissionsToUseTool} = require('../../utils/permissions/permissions.js') as {
				hasPermissionsToUseTool: (
					tool: unknown,
					input: unknown,
					context: unknown,
					message: unknown,
					toolUseId: string,
				) => Promise<unknown>
			}
			return ccHasPermissionsToUseTool(tool, input, context, message, toolUseId)
		} catch (e) {
			LogUtil.warn('[CCRuntime] hasPermissionsToUseTool() failed:', {detail: (e as Error).message})
			// 降级：允许所有工具使用
			return {behavior: 'allow'}
		}
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
