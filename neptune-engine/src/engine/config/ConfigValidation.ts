/**
 * engine/config/ConfigValidation.ts
 *
 * 引擎配置验证模块
 *
 * 从 initializeEngine.ts 提取的配置验证逻辑，提供：
 * - EngineConfig 类型定义（CLI 启动配置）
 * - validateEngineConfig 函数（配置验证）
 *
 * @module engine/config/ConfigValidation
 */

import type {PermissionMode} from '@neptune/engine-product/types/permissions.js'
import type {FeatureOverride} from '../compat/featureCompat.js'

/**
 * 引擎初始化配置接口
 *
 * @deprecated 使用 AgentEngineConfig 和 UnifiedConfig 替代。将在 V22 移除。
 *
 * 纯数据配置对象，不包含任何 CLI 特定类型
 */
export interface EngineConfig {
	// ===== 基础配置 =====
	/** 当前工作目录 */
	cwd: string
	/** 会话 ID（可选，用于恢复会话） */
	sessionId?: string
	/** 是否启用 bare 模式（最小化模式） */
	bare?: boolean

	// ===== 权限配置 =====
	/** 权限模式 */
	permissionMode?: PermissionMode
	/** 是否允许跳过权限检查（危险操作） */
	allowDangerouslySkipPermissions?: boolean
	/** 是否启用 debug 模式 */
	debug?: boolean
	/** debug 输出到 stderr */
	debugToStderr?: boolean

	// ===== 模型配置 =====
	/** 用户指定的模型 */
	model?: string
	/** 备用模型 */
	fallbackModel?: string
	/** API beta 功能标志 */
	betas?: string[]

	// ===== 工具配置 =====
	/** 基础工具列表 */
	baseTools?: string[]
	/** 允许的工具列表（白名单） */
	allowedTools?: string[]
	/** 禁止的工具列表（黑名单） */
	disallowedTools?: string[]

	// ===== MCP 配置 =====
	/** MCP 服务器配置 */
	mcpConfig?: McpServerConfig[]

	// ===== Agent 配置 =====
	/** 主线程 agent 类型 */
	agent?: string
	/** Agent ID（用于 teammate 模式） */
	agentId?: string
	/** CLI agents JSON（用于 --agents 标志） */
	agentsJson?: string

	// ===== 文件配置 =====
	/** 额外的跟踪目录 */
	addDir?: string[]
	/** 启动时下载的文件 */
	fileSpecs?: string[]

	// ===== 高级配置 =====
	/** 系统提示（用于非交互模式） */
	systemPrompt?: string
	/** 输入提示 */
	inputPrompt?: string | AsyncIterable<string>
	/** 输出格式 */
	outputFormat?: 'text' | 'stream-json'
	/** 输入格式 */
	inputFormat?: 'text' | 'stream-json'
	/** 是否启用 verbose */
	verbose?: boolean
	/** 是否禁用斜杠命令 */
	disableSlashCommands?: boolean
	/** 是否初始化模式（仅初始化，不启动） */
	init?: boolean
	/** 是否仅初始化模式 */
	initOnly?: boolean
	/** 是否维护模式 */
	maintenance?: boolean

	// ===== Worktree 配置 =====
	/** 是否启用 worktree */
	worktreeEnabled?: boolean
	/** worktree 名称 */
	worktreeName?: string
	/** worktree PR 编号 */
	worktreePRNumber?: number
	/** 是否启用 tmux */
	tmuxEnabled?: boolean

	// ===== Assistant/Kairos 配置 =====
	/** 是否启用 assistant 模式 */
	assistant?: boolean
	/** 是否启用 brief 模式 */
	brief?: boolean
	/** 是否启用 proactive 模式 */
	proactive?: boolean

	// ===== 任务模式配置 =====
	/** 任务列表 ID（Ant-only） */
	taskListId?: string

	// ===== Feature Flag 配置 =====
	/** 是否启用特定功能（用于测试或非 Bun 环境） */
	features?: FeatureOverride

	// ===== 依赖注入（解耦 CLI 特定逻辑） =====
	/** 工具注册表函数（替代直接导入 getTools） */
	toolRegistry?: (permissionContext: unknown) => unknown[]
	/** 工具注册表实例（ToolRegistry 接口） */
	toolRegistryInstance?: unknown
	/** 默认模型获取函数（替代直接导入 getDefaultMainLoopModel） */
	defaultModelProvider?: () => string
}

/**
 * MCP 服务器配置类型（简化版）
 */
export type McpServerConfig = {
	/** 服务器名称 */
	name: string
	/** 服务器类型 */
	type?: 'stdio' | 'sdk' | 'sse'
	/** 命令（stdio 类型） */
	command?: string
	/** 参数（stdio 类型） */
	args?: string[]
	/** 环境（stdio 类型） */
	env?: Record<string, string>
	/** URL（sse/nanolens 类型） */
	url?: string
	/** 作用域 */
	scope?: string
}

/**
 * 验证引擎配置
 *
 * @param config - 引擎配置
 * @returns 验证结果
 */
export function validateEngineConfig(config: EngineConfig): {
	valid: boolean
	errors: string[]
} {
	const errors: string[] = []

	if (!config.cwd) {
		errors.push('cwd is required')
	}

	// 验证权限模式
	if (config.permissionMode && !['auto', 'always', 'never'].includes(config.permissionMode)) {
		errors.push(`Invalid permissionMode: ${config.permissionMode}`)
	}

	// 验证 worktree 配置
	if (config.worktreeName && !config.worktreeEnabled) {
		errors.push('worktreeName requires worktreeEnabled to be true')
	}

	// 验证 tmux 配置
	if (config.tmuxEnabled && !config.worktreeEnabled) {
		errors.push('tmuxEnabled requires worktreeEnabled to be true')
	}

	return {
		valid: errors.length === 0,
		errors,
	}
}
