/**
 * CCRuntime — Claude Code 运行时抽象接口
 *
 * 目的：统一管理 engine/ 对 CC 内部模块的访问，为测试提供 mock 入口。
 *
 * 设计原则：
 * - 最小抽象：只暴露当前需要的方法
 * - 接口隔离：按职责分组方法
 * - 测试友好：MockCCRuntime 可轻松替换实现
 */

import type {Tools} from '../types/tool.js'
import type {ToolRegistry} from '../types/tool.js'

// ============================================================
// CWD 上下文类型
// ============================================================

/** CWD 上下文执行函数签名 */
export type CwdContextFn<T> = () => T

// ============================================================
// 类型定义
// ============================================================

/** CC Bootstrap 状态（单例设置） */
export interface BootstrapState {
	cwd: string
	originalCwd: string
	projectRoot: string
}

/** MACRO Defines（编译时常量） */
export interface MacroDefines {
	VERSION: string
	BUILD_TIME: string
	FEEDBACK_CHANNEL: string
	ISSUES_EXPLAINER: string
	NATIVE_PACKAGE_URL: string
	PACKAGE_URL: string
	VERSION_CHANGELOG: string
}

/** Transcript 加载结果 */
export interface TranscriptLoadResult {
	messages: unknown[]

	[key: string]: unknown
}

/** FileStateCache 抽象（避免直接 import CC 模块） */
export interface FileStateCache {
	get(key: string): FileStateValue | undefined

	set(key: string, value: FileStateValue): void

	has(key: string): boolean

	clear(): void
}

/** FileStateValue 类型 */
export interface FileStateValue {
	content: string
	timestamp: number
	offset?: number
	limit?: number
	isPartialView?: boolean
}

/** hasPermissionsToUseTool 函数签名 */
export type HasPermissionsToUseToolFn = (
	tool: unknown,
	input: unknown,
	context: unknown,
	message: unknown,
	toolUseId: string,
) => Promise<unknown>

// ============================================================
// CCRuntime 接口
// ============================================================

/**
 * CCRuntime 接口
 *
 * 职责：
 * 1. 提供 CC 内置工具列表
 * 2. 初始化 CC 运行时（configs、bootstrap state）
 * 3. 加载 transcript 文件
 * 4. 管理 SessionContext 相关操作
 * 5. 注入 MACRO defines
 */
export interface CCRuntime {
	// ---------- 工具相关 ----------
	/** 获取 CC 内置工具列表 */
	getAllBaseTools(): Tools

	/** 设置 ToolRegistry（用于 SDK 模式按需加载工具） */
	setToolRegistry?(registry: ToolRegistry): void

	/** 获取当前 ToolRegistry */
	getToolRegistry?(): ToolRegistry | undefined

	// ---------- 运行时初始化 ----------
	/** 启用配置系统 */
	enableConfigs(): void

	/** 设置 bootstrap 单例（cwd/projectRoot） */
	setupBootstrap(state: BootstrapState): void

	// ---------- Transcript 相关 ----------
	/** 加载 transcript 文件 */
	loadTranscriptFromFile(path: string): Promise<TranscriptLoadResult>

	// ---------- SessionContext 相关 ----------
	/** 获取当前 Session 的记忆路径（从 AsyncLocalStorage 读取） */
	getMemoryPath(): string | undefined

	// ---------- MACRO Defines ----------
	/** 注入 MACRO defines 到 globalThis */
	injectMacroDefines(): void

	// ---------- 状态管理 ----------
	/** 检查运行时是否已初始化 */
	isInitialized(): boolean

	/** 标记运行时已初始化 */
	markInitialized(): void

	/** 重置初始化状态（仅用于测试） */
	resetForTesting?(): void

	// ---------- 多 Workspace 支持 ----------
	/**
	 * 在指定的 cwd 上下文中执行函数
	 *
	 * 利用 AsyncLocalStorage 确保所有对 getCwd/pwd() 的调用
	 * 都返回正确的 workspace 路径，支持多 workspace 并发。
	 *
	 * @param cwd 工作目录
	 * @param fn 要执行的函数
	 * @returns 函数执行结果
	 */
	runWithCwd<T>(cwd: string, fn: CwdContextFn<T>): T

	/**
	 * 检查指定的 workspace 是否已初始化
	 *
	 * @param workspace workspace 路径
	 * @returns 是否已初始化
	 */
	isWorkspaceInitialized(workspace: string): boolean

	/**
	 * 标记指定 workspace 已初始化
	 *
	 * @param workspace workspace 路径
	 */
	markWorkspaceInitialized(workspace: string): void

	// ---------- FileStateCache 相关 ----------
	/**
	 * 创建 FileStateCache 实例
	 *
	 * @param options 缓存配置
	 * @returns FileStateCache 实例
	 */
	createFileStateCache(options?: { maxEntries?: number; maxSizeBytes?: number }): FileStateCache

	// ---------- 权限相关 ----------
	/**
	 * 检查是否有权限使用指定工具
	 *
	 * @param tool 工具对象
	 * @param input 工具输入参数
	 * @param context 工具使用上下文
	 * @param message 助手消息
	 * @param toolUseId 工具调用 ID
	 * @returns 权限决策
	 */
	hasPermissionsToUseTool(
		tool: unknown,
		input: unknown,
		context: unknown,
		message: unknown,
		toolUseId: string,
	): Promise<unknown>
}

// ============================================================
// 默认 MACRO Defines
// ============================================================

/** 获取版本号（从 package.json 读取，如果失败则使用 fallback） */
function getVersion(): string {
	try {
		// 尝试从 package.json 读取版本
		const packageJson = require('../../../package.json')
		return packageJson.version || '2.1.888'
	} catch {
		// 如果读取失败，使用 fallback 版本
		return '2.1.888'
	}
}

/** 与 scripts/defines.ts 保持一致的默认值 */
export const DEFAULT_MACROS: MacroDefines = {
	VERSION: getVersion(),
	BUILD_TIME: new Date().toISOString(),
	FEEDBACK_CHANNEL: '',
	ISSUES_EXPLAINER: '',
	NATIVE_PACKAGE_URL: '',
	PACKAGE_URL: '',
	VERSION_CHANGELOG: '',
}
