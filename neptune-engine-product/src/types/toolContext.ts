/**
 * ToolContext 类型定义 — CoreToolContext + UIToolContext 分离
 *
 * 将 ToolUseContext 拆分为核心上下文和 UI 上下文，
 * 支持 non-CLI 环境的工具执行。
 *
 * 关键决策：保持与 Tool.ts 中 ToolUseContext 的字段一致，确保向后兼容。
 *
 * 注意：此文件中的 SetToolJSXFn 使用 unknown 替代 ReactNode，
 * 以避免 engine/ 目录依赖 React。
 */

import type {SystemMessage, SystemLocalCommandMessage, Message} from './message.js'
import type {AppState} from '../state/AppStateStore.js'
import type {FileStateCache} from '../utils/fileStateCache.js'
import type {CanUseToolFn} from './permissions.js'
import type {Command} from '../commands.js'
import type {ThinkingConfig} from '../utils/thinking.js'
import type {MCPServerConnection, ServerResource} from '../services/mcp/types.js'
import type {AgentDefinitionsResult} from '@neptune/builtin-tools/tools/AgentTool/loadAgentsDir.js'
import type {McpResourceRuntime} from '@neptune/builtin-tools/tools/MCPResourceRuntime.js'
import type {QuerySource} from '../constants/querySource.js'
import type {Tools} from './toolTypes.js'
import type {ElicitRequestURLParams, ElicitResult} from '@modelcontextprotocol/sdk/types.js'
import type {FileHistoryState} from '../utils/fileHistory.js'
import type {AttributionState} from '../utils/commitAttribution.js'
import type {AgentId} from './ids.js'
import type {QueryChainTracking, SetToolJSXFn, CompactProgressEvent} from '../Tool.js'
import type {DenialTrackingState} from '../utils/permissions/denialTracking.js'
import type {ContentReplacementState} from '../utils/toolResultStorage.js'
import type {Notification} from './notification.js'
import type {SpinnerMode} from './spinner.js'
import type {SDKStatus} from '../entrypoints/agentSdkTypes.js'
import type {UUID} from 'crypto'
import type {PromptRequest, PromptResponse} from './hooks.js'
import type {LangfuseSpan} from '../services/langfuse/index.js'
import type {SystemPrompt} from '../utils/systemPromptType.js'

// ============================================================
// CoreToolContext — 核心上下文
// ============================================================

/**
 * CoreToolContext — 核心工具上下文
 *
 * 包含工具执行所需的核心上下文，无 UI 依赖。
 * 可在 non-CLI 环境使用。
 */
export interface CoreToolContext {
	// ========== 工具选项 ==========
	options: {
		commands: Command[]
		debug: boolean
		mainLoopModel: string
		tools: Tools
		verbose: boolean
		thinkingConfig: ThinkingConfig
		mcpClients: MCPServerConnection[]
		mcpResources: Record<string, ServerResource[]>
		mcpResourceRuntime: McpResourceRuntime
		isNonInteractiveSession: boolean
		agentDefinitions: AgentDefinitionsResult
		maxBudgetUsd?: number
		customSystemPrompt?: string
		appendSystemPrompt?: string
		querySource?: QuerySource
		refreshTools?: () => Tools
	}

	// ========== 核心状态 ==========
	abortController: AbortController
	readFileState: FileStateCache

	getAppState(): AppState

	setAppState(f: (prev: AppState) => AppState): void

	setAppStateForTasks?: (f: (prev: AppState) => AppState) => void

	// ========== MCP Elicitation ==========
	handleElicitation?: (
		serverName: string,
		params: ElicitRequestURLParams,
		signal: AbortSignal,
	) => Promise<ElicitResult>

	// ========== 消息 ==========
	messages: Message[]

	// ========== 状态更新 ==========
	setInProgressToolUseIDs: (f: (prev: Set<string>) => Set<string>) => void
	setResponseLength: (f: (prev: number) => number) => void
	updateFileHistoryState: (
		updater: (prev: FileHistoryState) => FileHistoryState,
	) => void
	updateAttributionState: (
		updater: (prev: AttributionState) => AttributionState,
	) => void

	// ========== 工具执行状态 ==========
	toolUseId?: string

	// ========== Agent 相关 ==========
	agentId?: AgentId
	agentType?: string
	requireCanUseTool?: boolean

	// ========== 追踪 ==========
	queryTracking?: QueryChainTracking
	localDenialTracking?: DenialTrackingState
	contentReplacementState?: ContentReplacementState
}

// ============================================================
// UIToolContext — UI 上下文
// ============================================================

/**
 * UIToolContext — UI 工具上下文
 *
 * 扩展 CoreToolContext，添加 UI 相关的回调和方法。
 * 仅 CLI 环境需要。
 */
export interface UIToolContext extends CoreToolContext {
	// ========== UI 回调 ==========
	setToolJSX?: SetToolJSXFn
	addNotification?: (notif: Notification | Record<string, unknown>) => void
	appendSystemMessage?: (
		msg: Exclude<SystemMessage, SystemLocalCommandMessage>,
	) => void
	sendOSNotification?: (opts: {
		message: string
		notificationType: string
	}) => void

	// ========== 嵌套内存触发器 ==========
	nestedMemoryAttachmentTriggers?: Set<string>
	loadedNestedMemoryPaths?: Set<string>
	dynamicSkillDirTriggers?: Set<string>
	discoveredSkillNames?: Set<string>
	userModified?: boolean

	// ========== 进度控制 ==========
	setHasInterruptibleToolInProgress?: (v: boolean) => void
	pushApiMetricsEntry?: (ttftMs: number) => void
	setStreamMode?: (mode: SpinnerMode) => void
	onCompactProgress?: (event: CompactProgressEvent) => void
	setSDKStatus?: (status: SDKStatus) => void
	openMessageSelector?: () => void
	setConversationId?: (id: UUID) => void

	// ========== 限制配置 ==========
	fileReadingLimits?: {
		maxTokens?: number
		maxSizeBytes?: number
	}
	globLimits?: {
		maxResults?: number
	}

	// ========== 工具决策 ==========
	toolDecisions?: Map<
		string,
		{
			source: string
			decision: 'accept' | 'reject'
			timestamp: number
		}
	>

	// ========== 交互式提示 ==========
	requestPrompt?: (
		sourceName: string,
		toolInputSummary?: string | null,
	) => (request: PromptRequest) => Promise<PromptResponse>

	// ========== 实验性功能 ==========
	criticalSystemReminder_EXPERIMENTAL?: string

	// ========== Langfuse 追踪 ==========
	langfuseTrace?: LangfuseSpan | null
	langfuseBatchSpan?: LangfuseSpan | null

	// ========== 子 Agent 相关 ==========
	preserveToolUseResults?: boolean
	renderedSystemPrompt?: SystemPrompt
}

// ============================================================
// MessageSelectorOptions
// ============================================================

export interface MessageSelectorOptions {
	messages?: unknown[]
	onSelect?: (selected: unknown) => void
	onCancel?: () => void
	title?: string
}

// ============================================================
// 向后兼容类型别名
// ============================================================

/**
 * ToolUseContext — 向后兼容类型别名
 *
 * @deprecated 使用 UIToolContext 或 CoreToolContext 替代
 */
export type ToolUseContext = UIToolContext

// ============================================================
// 上下文创建辅助函数
// ============================================================

/**
 * 创建最小化的 CoreToolContext
 *
 * 用于 non-CLI 环境的工具执行。
 */
export function createCoreToolContext(options: {
	cwd: string
	signal?: AbortSignal
	readFileCache: FileStateCache
	getAppState: () => AppState
	setAppState: (fn: (prev: AppState) => AppState) => void
	canUseTool: CanUseToolFn
	toolOptions: CoreToolContext['options']
	messages: Message[]
}): CoreToolContext {
	const abortController = new globalThis.AbortController()
	if (options.signal) {
		options.signal.addEventListener('abort', () => abortController.abort())
	}

	return {
		options: options.toolOptions,
		abortController,
		readFileState: options.readFileCache,
		getAppState: options.getAppState,
		setAppState: options.setAppState,
		messages: options.messages,
		setInProgressToolUseIDs: () => {
		},
		setResponseLength: () => {
		},
		updateFileHistoryState: () => {
		},
		updateAttributionState: () => {
		},
	}
}

/**
 * 创建完整的 UIToolContext
 *
 * 用于 CLI 环境的工具执行。
 */
export function createUIToolContext(
	coreContext: CoreToolContext,
	uiOptions: {
		setToolJSX?: SetToolJSXFn
		appendSystemMessage?: (message: SystemMessage) => void
		sendOSNotification?: (opts: { message: string; notificationType: string }) => void
		verbose?: boolean
	},
): UIToolContext {
	return {
		...coreContext,
		...uiOptions,
	}
}
