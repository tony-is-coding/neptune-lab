/**
 * EngineState — 核心运行时状态
 *
 * 纯核心逻辑状态，零 React/Ink 依赖。
 * 从 AppState 的 A 类字段迁移而来。
 *
 * === 设计原则 ===
 * 1. 零 UI 依赖 - 不依赖任何 React/Ink 类型
 * 2. 发布/订阅机制 - 状态变更通过事件通知
 * 3. facade 模式 - AppState 作为 React Context facade 委托给 EngineState
 * 4. 向后兼容 - 不改变现有行为，只改变数据存放位置
 *
 * V18 优化：消除 value import 穿透，改为依赖注入。
 */

import type { TodoList } from '../utils/todo/types.js'
import type { Command } from './types/command.js'
import type {
  MCPServerConnection,
  ServerResource,
} from '../services/mcp/types.js'
import type { Tool, ToolPermissionContext } from '../Tool.js'
import { LogUtil } from './log/index.js'
import type { TaskState } from '../tasks/types.js'
import type { AgentDefinitionsResult } from '@claude-code-best/builtin-tools/tools/AgentTool/loadAgentsDir.js'
import type { AllowedPrompt } from '@claude-code-best/builtin-tools/tools/ExitPlanModeTool/ExitPlanModeV2Tool.js'
import type { AgentId } from './types/ids.js'
import type { Message, UserMessage } from './types/message.js'
import type { LoadedPlugin, PluginError } from './types/plugin.js'
import type { PermissionMode } from './types/permissions.js'
import type { AttributionState } from '../utils/commitAttribution.js'
import type { FileHistoryState } from '../utils/fileHistory.js'
import type { SessionHooksState } from '../utils/hooks/sessionHooks.js'
import { EventBus } from './events/EventBus.js'

/**
 * 创建空的 ToolPermissionContext 的函数类型
 */
export type GetEmptyToolPermissionContextFn = () => ToolPermissionContext

/**
 * 创建空的 AttributionState 的函数类型
 */
export type CreateEmptyAttributionStateFn = () => AttributionState

/**
 * EngineState 配置选项
 *
 * 通过依赖注入提供工厂函数，消除 value import 穿透。
 */
export interface EngineStateOptions {
	/**
	 * 创建空的 ToolPermissionContext 的函数
	 * 如果不提供，使用默认实现（动态导入）
	 */
	getEmptyToolPermissionContext?: GetEmptyToolPermissionContextFn
	/**
	 * 创建空的 AttributionState 的函数
	 * 如果不提供，使用默认实现（动态导入）
	 */
	createEmptyAttributionState?: CreateEmptyAttributionStateFn
}

/**
 * EngineState 核心字段（从 AppState A 类字段迁移）
 *
 * 包含 18 个纯核心字段，零 UI 依赖。
 */
export interface EngineStateData {
  /** 统一任务状态 */
  tasks: { [taskId: string]: TaskState }

  /** Agent 名称注册表（name -> AgentId） */
  agentNameRegistry: Map<string, AgentId>

  /** Agent 定义列表 */
  agentDefinitions: AgentDefinitionsResult

  /** MCP 连接和工具 */
  mcp: {
    clients: MCPServerConnection[]
    tools: Tool[]
    commands: Command[]
    resources: Record<string, ServerResource[]>
    /**
     * 插件重连键 - /reload-plugins 时递增，触发 MCP 效果重新运行
     */
    pluginReconnectKey: number
  }

  /** 插件状态 */
  plugins: {
    enabled: LoadedPlugin[]
    disabled: LoadedPlugin[]
    commands: Command[]
    /**
     * 插件加载和初始化期间收集的插件系统错误
     */
    errors: PluginError[]
    /** 后台插件/市场安装的安装状态 */
    installationStatus: {
      marketplaces: Array<{
        name: string
        status: 'pending' | 'installing' | 'installed' | 'failed'
        error?: string
      }>
      plugins: Array<{
        id: string
        name: string
        status: 'pending' | 'installing' | 'installed' | 'failed'
        error?: string
      }>
    }
    /**
     * 当磁盘上的插件状态更改时设置为 true
     * 交互模式下，用户运行 /reload-plugins 来消费
     * headless 模式下，通过 refreshActivePlugins() 自动消费
     */
    needsRefresh: boolean
  }

  /** 文件历史状态 */
  fileHistory: FileHistoryState

  /** 代码归属状态 */
  attribution: AttributionState

  /** Todo 列表（按 agentId 索引） */
  todos: { [agentId: string]: TodoList }

  /** 工具权限上下文 */
  toolPermissionContext: ToolPermissionContext

  /** Session hooks */
  sessionHooks: SessionHooksState

  /** 初始消息（来自 CLI 参数或 plan mode 退出） */
  initialMessage: {
    message: UserMessage
    clearContext?: boolean
    mode?: 'default' | 'plan'
    /** Session 范围的权限规则（例如 "运行测试"、"安装依赖"） */
    allowedPrompts?: AllowedPrompt[]
  } | null

  /** 待验证的计划状态（退出 plan mode 时设置） */
  pendingPlanVerification?: {
    plan: string
    verificationStarted: boolean
    verificationCompleted: boolean
  }

  /** 活动覆盖层（Select dialogs 等），用于 Escape 键协调 */
  activeOverlays: ReadonlySet<string>
}

/**
 * EngineState 事件类型
 */
export type EngineStateEvent =
  | { type: 'tasks:changed'; tasks: { [taskId: string]: TaskState } }
  | { type: 'mcp:changed'; mcp: EngineStateData['mcp'] }
  | { type: 'plugins:changed'; plugins: EngineStateData['plugins'] }
  | { type: 'toolPermission:changed'; context: ToolPermissionContext }
  | { type: 'initialMessage:changed'; message: EngineStateData['initialMessage'] }
  | { type: 'state:changed'; field: keyof EngineStateData | 'data' }

/**
 * EngineState 事件监听器
 */
type EngineStateListener = (event: EngineStateEvent) => void

/**
 * EngineState — 核心运行时状态管理器
 *
 * 零 React 依赖，提供纯核心状态管理。
 * 通过 EventBus 实现发布/订阅机制。
 *
 * V18 优化：工厂函数通过依赖注入传入，消除 value import 穿透。
 */
export class EngineState {
  private _data: EngineStateData
  private readonly _eventBus: EventBus
  private readonly _listeners: Set<EngineStateListener> = new Set()
  private readonly _options: EngineStateOptions

  constructor(initialData?: Partial<EngineStateData>, options?: EngineStateOptions) {
    this._eventBus = new EventBus()
    this._options = options ?? {}
    this._data = this._createDefaultState(initialData)
  }

  /**
   * 获取当前状态数据（只读）
   */
  get data(): Readonly<EngineStateData> {
    return this._data
  }

  /**
   * 获取 EventBus 实例（用于高级订阅）
   */
  get eventBus(): EventBus {
    return this._eventBus
  }

  // ============================================================
  // 核心 Getter 方法
  // ============================================================

  get tasks(): EngineStateData['tasks'] {
    return this._data.tasks
  }

  get agentNameRegistry(): EngineStateData['agentNameRegistry'] {
    return this._data.agentNameRegistry
  }

  get agentDefinitions(): EngineStateData['agentDefinitions'] {
    return this._data.agentDefinitions
  }

  get mcp(): EngineStateData['mcp'] {
    return this._data.mcp
  }

  get plugins(): EngineStateData['plugins'] {
    return this._data.plugins
  }

  get fileHistory(): EngineStateData['fileHistory'] {
    return this._data.fileHistory
  }

  get attribution(): EngineStateData['attribution'] {
    return this._data.attribution
  }

  get todos(): EngineStateData['todos'] {
    return this._data.todos
  }

  get toolPermissionContext(): EngineStateData['toolPermissionContext'] {
    return this._data.toolPermissionContext
  }

  get sessionHooks(): EngineStateData['sessionHooks'] {
    return this._data.sessionHooks
  }

  get initialMessage(): EngineStateData['initialMessage'] {
    return this._data.initialMessage
  }

  get pendingPlanVerification(): EngineStateData['pendingPlanVerification'] {
    return this._data.pendingPlanVerification
  }

  get activeOverlays(): EngineStateData['activeOverlays'] {
    return this._data.activeOverlays
  }

  // ============================================================
  // 核心 Setter 方法
  // ============================================================

  /**
   * 更新整个状态（用于批量更新）
   */
  update(updater: (prev: EngineStateData) => EngineStateData): void {
    const prev = this._data
    this._data = updater(prev)
    this._notifyStateChange()
  }

  setTasks(tasks: EngineStateData['tasks']): void {
    this._data.tasks = tasks
    this._emit({ type: 'tasks:changed', tasks })
  }

  setAgentNameRegistry(registry: EngineStateData['agentNameRegistry']): void {
    this._data.agentNameRegistry = registry
    this._emit({ type: 'state:changed', field: 'agentNameRegistry' })
  }

  setAgentDefinitions(definitions: EngineStateData['agentDefinitions']): void {
    this._data.agentDefinitions = definitions
    this._emit({ type: 'state:changed', field: 'agentDefinitions' })
  }

  setMcp(mcp: EngineStateData['mcp']): void {
    this._data.mcp = mcp
    this._emit({ type: 'mcp:changed', mcp })
  }

  setPlugins(plugins: EngineStateData['plugins']): void {
    this._data.plugins = plugins
    this._emit({ type: 'plugins:changed', plugins })
  }

  setFileHistory(fileHistory: EngineStateData['fileHistory']): void {
    this._data.fileHistory = fileHistory
    this._emit({ type: 'state:changed', field: 'fileHistory' })
  }

  setAttribution(attribution: EngineStateData['attribution']): void {
    this._data.attribution = attribution
    this._emit({ type: 'state:changed', field: 'attribution' })
  }

  setTodos(todos: EngineStateData['todos']): void {
    this._data.todos = todos
    this._emit({ type: 'state:changed', field: 'todos' })
  }

  setToolPermissionContext(context: EngineStateData['toolPermissionContext']): void {
    this._data.toolPermissionContext = context
    this._emit({ type: 'toolPermission:changed', context })
  }

  setSessionHooks(hooks: EngineStateData['sessionHooks']): void {
    this._data.sessionHooks = hooks
    this._emit({ type: 'state:changed', field: 'sessionHooks' })
  }

  setInitialMessage(message: EngineStateData['initialMessage']): void {
    this._data.initialMessage = message
    this._emit({ type: 'initialMessage:changed', message })
  }

  setPendingPlanVerification(
    pendingPlanVerification: EngineStateData['pendingPlanVerification'],
  ): void {
    this._data.pendingPlanVerification = pendingPlanVerification
    this._emit({ type: 'state:changed', field: 'pendingPlanVerification' })
  }

  setActiveOverlays(overlays: EngineStateData['activeOverlays']): void {
    this._data.activeOverlays = overlays
    this._emit({ type: 'state:changed', field: 'activeOverlays' })
  }

  // ============================================================
  // 事件系统
  // ============================================================

  /**
   * 订阅状态变更事件
   * @returns 取消订阅函数
   */
  subscribe(listener: EngineStateListener): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  /**
   * 内部事件发送
   */
  private _emit(event: EngineStateEvent): void {
    // 通过 EventBus 分发
    this._eventBus.emit(`engine:${event.type}`, event)

    // 直接通知监听器
    for (const listener of this._listeners) {
      try {
        listener(event)
      } catch (error) {
        LogUtil.error('[EngineState] Listener error:', { error })
      }
    }
  }

  /**
   * 通知整体状态变更
   */
  private _notifyStateChange(): void {
    this._emit({ type: 'state:changed', field: 'data' })
  }

  // ============================================================
  // 工厂方法
  // ============================================================

  /**
   * 获取工厂函数（延迟导入，消除 value import 穿透）
   */
  private _getFactoryFunctions(): {
    getEmptyToolPermissionContext: GetEmptyToolPermissionContextFn
    createEmptyAttributionState: CreateEmptyAttributionStateFn
  } {
    // 如果通过依赖注入提供了工厂函数，直接使用
    if (this._options.getEmptyToolPermissionContext && this._options.createEmptyAttributionState) {
      return {
        getEmptyToolPermissionContext: this._options.getEmptyToolPermissionContext,
        createEmptyAttributionState: this._options.createEmptyAttributionState,
      }
    }

    // 否则使用动态导入（仅在首次调用时）
    // 这样可以保持模块的 value import 自由
    const { getEmptyToolPermissionContext: getEmptyPermissions } = require('../Tool.js') as {
      getEmptyToolPermissionContext: GetEmptyToolPermissionContextFn
    }
    const { createEmptyAttributionState: createAttributionState } = require('../utils/commitAttribution.js') as {
      createEmptyAttributionState: CreateEmptyAttributionStateFn
    }

    return {
      getEmptyToolPermissionContext: this._options.getEmptyToolPermissionContext ?? getEmptyPermissions,
      createEmptyAttributionState: this._options.createEmptyAttributionState ?? createAttributionState,
    }
  }

  /**
   * 创建默认状态
   */
  private _createDefaultState(
    initialData?: Partial<EngineStateData>,
  ): EngineStateData {
    const { getEmptyToolPermissionContext, createEmptyAttributionState } = this._getFactoryFunctions()

    return {
      tasks: initialData?.tasks ?? {},
      agentNameRegistry: initialData?.agentNameRegistry ?? new Map(),
      agentDefinitions: initialData?.agentDefinitions ?? {
        activeAgents: [],
        allAgents: [],
      },
      mcp: initialData?.mcp ?? {
        clients: [],
        tools: [],
        commands: [],
        resources: {},
        pluginReconnectKey: 0,
      },
      plugins: initialData?.plugins ?? {
        enabled: [],
        disabled: [],
        commands: [],
        errors: [],
        installationStatus: {
          marketplaces: [],
          plugins: [],
        },
        needsRefresh: false,
      },
      fileHistory: initialData?.fileHistory ?? {
        snapshots: [],
        trackedFiles: new Set(),
        snapshotSequence: 0,
      },
      attribution: initialData?.attribution ?? createEmptyAttributionState(),
      todos: initialData?.todos ?? {},
      toolPermissionContext:
        initialData?.toolPermissionContext ?? getEmptyToolPermissionContext(),
      sessionHooks: initialData?.sessionHooks ?? new Map(),
      initialMessage: initialData?.initialMessage ?? null,
      pendingPlanVerification: initialData?.pendingPlanVerification ?? undefined,
      activeOverlays: initialData?.activeOverlays ?? new Set<string>(),
    }
  }

  /**
   * 从 AppState 数据创建 EngineState
   *
   * @param appStateData AppState 的数据（只提取 A 类字段）
   * @returns EngineState 实例
   */
  static fromAppStateData(appStateData: {
    tasks?: EngineStateData['tasks']
    agentNameRegistry?: EngineStateData['agentNameRegistry']
    agentDefinitions?: EngineStateData['agentDefinitions']
    mcp?: EngineStateData['mcp']
    plugins?: EngineStateData['plugins']
    fileHistory?: EngineStateData['fileHistory']
    attribution?: EngineStateData['attribution']
    todos?: EngineStateData['todos']
    toolPermissionContext?: EngineStateData['toolPermissionContext']
    sessionHooks?: EngineStateData['sessionHooks']
    initialMessage?: EngineStateData['initialMessage']
    pendingPlanVerification?: EngineStateData['pendingPlanVerification']
    activeOverlays?: EngineStateData['activeOverlays']
  }): EngineState {
    return new EngineState(appStateData)
  }
}
