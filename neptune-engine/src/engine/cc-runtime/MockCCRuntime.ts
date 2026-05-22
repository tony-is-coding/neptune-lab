/**
 * MockCCRuntime — Claude Code 运行时测试桩实现
 *
 * 用途：在测试环境中替换真实的 CCRuntime，避免依赖 CC 内部模块。
 */

import type {
	BootstrapState,
	CCRuntime,
	CwdContextFn,
	QueryEngineConfig,
	QueryEngineWrapper,
	TranscriptLoadResult,
	FileStateCache,
	FileStateValue,
} from './CCRuntime.js'
import type {Tools} from '../types/tool.js'
import type {ToolRegistry} from '../types/tool.js'

// ============================================================
// Mock QueryEngine
// ============================================================

/** Mock QueryEngine — 空实现，满足类型要求 */
class MockQueryEngine implements QueryEngineWrapper {
	async* submitMessage(..._args: unknown[]): AsyncGenerator<unknown, void, unknown> {
		// 空实现：返回空消息流
		yield {type: 'mock_message'}
	}
}

// ============================================================
// MockCCRuntime 实现
// ============================================================

/** 配置选项 */
export interface MockCCRuntimeOptions {
	/** 工具列表（默认空） */
	tools?: Tools
	/** ToolRegistry（用于 SDK 模式） */
	toolRegistry?: ToolRegistry
	/** transcript 加载结果（默认空消息） */
	transcriptResult?: TranscriptLoadResult
	/** memoryPath（默认 undefined） */
	memoryPath?: string
	/** QueryEngine 工厂（默认使用 MockQueryEngine） */
	queryEngineFactory?: (config: QueryEngineConfig) => QueryEngineWrapper
}

/** Mock 实现：提供测试桩 */
export class MockCCRuntime implements CCRuntime {
	private initialized = false
	private readonly tools: Tools
	private readonly toolRegistry?: ToolRegistry
	private readonly transcriptResult: TranscriptLoadResult
	private readonly memoryPathValue: string | undefined
	private readonly queryEngineFactory: (config: QueryEngineConfig) => QueryEngineWrapper
	/** per-workspace 初始化状态跟踪 */
	private workspaceInitialized = new Set<string>()
	/** Mock FileStateCache 实例 */
	private mockFileStateCache: MockFileStateCache | null = null

	constructor(options: MockCCRuntimeOptions = {}) {
		this.tools = options.tools ?? []
		this.toolRegistry = options.toolRegistry
		this.transcriptResult = options.transcriptResult ?? {messages: []}
		this.memoryPathValue = options.memoryPath
		this.queryEngineFactory = options.queryEngineFactory ?? ((config) => new MockQueryEngine())
	}

	// ========== 工具相关 ==========

	getAllBaseTools(): Tools {
		// 如果设置了 ToolRegistry，使用它获取工具
		if (this.toolRegistry) {
			return this.toolRegistry.getTools({} as any)
		}
		return this.tools
	}

	/** 设置 ToolRegistry（用于 SDK 模式按需加载工具） */
	setToolRegistry(registry: ToolRegistry): void {
		// Mock 实现：记录但不存储（实际工具由构造函数的 tools 参数控制）
	}

	/** 获取当前 ToolRegistry */
	getToolRegistry(): ToolRegistry | undefined {
		return this.toolRegistry
	}

	// ========== 运行时初始化 ==========

	enableConfigs(): void {
		// Mock：空实现
	}

	setupBootstrap(_state: BootstrapState): void {
		// Mock：空实现
	}

	// ========== QueryEngine 相关 ==========

	createQueryEngine(config: QueryEngineConfig): QueryEngineWrapper {
		return this.queryEngineFactory(config)
	}

	// ========== Transcript 相关 ==========

	async loadTranscriptFromFile(_path: string): Promise<TranscriptLoadResult> {
		return this.transcriptResult
	}

	// ========== SessionContext 相关 ==========

	getMemoryPath(): string | undefined {
		return this.memoryPathValue
	}

	// ========== MACRO Defines ==========

	injectMacroDefines(): void {
		const g = globalThis as Record<string, unknown>
		if (typeof g.MACRO === 'undefined') {
			g.MACRO = {
				VERSION: 'mock-2.1.888',
				BUILD_TIME: new Date().toISOString(),
				FEEDBACK_CHANNEL: '',
				ISSUES_EXPLAINER: '',
				NATIVE_PACKAGE_URL: '',
				PACKAGE_URL: '',
				VERSION_CHANGELOG: '',
			}
		}
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
	 * 在指定的 cwd 上下文中执行函数（Mock 实现）
	 */
	runWithCwd<T>(_cwd: string, fn: CwdContextFn<T>): T {
		// Mock 实现中不需要真正的 AsyncLocalStorage，直接执行函数
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

	createFileStateCache(): FileStateCache {
		if (!this.mockFileStateCache) {
			this.mockFileStateCache = new MockFileStateCache()
		}
		return this.mockFileStateCache
	}

	// ========== 权限相关 ==========

	async hasPermissionsToUseTool(
		_tool: unknown,
		_input: unknown,
		_context: unknown,
		_message: unknown,
		_toolUseId: string,
	): Promise<unknown> {
		// Mock 实现：允许所有工具使用
		return {behavior: 'allow'}
	}
}

// ============================================================
// Mock FileStateCache
// ============================================================

/** Mock FileStateCache 实现 */
class MockFileStateCache implements FileStateCache {
	private cache = new Map<string, FileStateValue>()

	get(key: string): FileStateValue | undefined {
		return this.cache.get(key)
	}

	set(key: string, value: FileStateValue): void {
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
// 工厂函数
// ============================================================

/** 创建 Mock CCRuntime 实例 */
export function createMockCCRuntime(options?: MockCCRuntimeOptions): CCRuntime {
	return new MockCCRuntime(options)
}
