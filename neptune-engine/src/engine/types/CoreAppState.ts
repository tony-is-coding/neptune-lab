/**
 * CoreAppState — QueryEngine 核心运行时状态类型
 *
 * 从 AppState 中提取的核心字段，专用于 SDK/headless 模式。
 * 零 UI 依赖，所有字段都是运行时必需或有条件使用。
 *
 * 设计原则：
 * - 只包含 QueryEngine 核心路径实际使用的字段
 * - 排除所有纯 UI 展示字段
 * - 支持可选字段（SDK 模式下某些字段可能不存在）
 */

// 类型导入（使用 import type 避免 value import）
import type { Message } from '../types/message.js'
import type { UserMessage } from '../types/message.js'
import type {
  FileHistoryState,
} from '../../utils/fileHistory.js'
import type { AttributionState } from '../../utils/commitAttribution.js'
import type { ToolPermissionContext } from '../types/permissions.js'
import type { Tool } from '../../Tool.js'
import type { MCPServerConnection } from '../../services/mcp/types.js'
import type { ModelSetting } from '../../utils/model/model.js'
import type { SessionHooksState } from '../../utils/hooks/sessionHooks.js'

// EffortValue 类型定义（本地定义，避免导入非导出类型）
export type EffortValue = 'low' | 'medium' | 'high'

/**
 * CoreAppState — 核心运行时状态
 *
 * 字段说明：
 * - 必需字段：QueryEngine 核心路径必须使用
 * - 可选字段：特定条件下使用（SDK 模式下可能为 undefined）
 */
export interface CoreAppState {
  // ============================================================
  // 必需字段（7 个）
  // ============================================================

  /**
   * 权限上下文
   * 包含权限模式、工作目录、允许规则等
   */
  toolPermissionContext: ToolPermissionContext

  /**
   * 主循环模型配置
   * 模型名称、提供商等配置
   */
  mainLoopModel: ModelSetting | null

  /**
   * 文件历史状态
   * 跟踪文件修改历史，用于代码归属和快照
   */
  fileHistory: FileHistoryState

  /**
   * 代码归属信息
   * 跟踪代码修改的作者和来源
   */
  attribution: AttributionState

  /**
   * MCP 工具和客户端连接
   */
  mcp: {
    /** MCP 工具列表 */
    tools: Tool[]
    /** MCP 客户端连接状态 */
    clients: MCPServerConnection[]
  }

  /**
   * 会话级 hooks 状态
   * 运行时核心字段（hooks 系统），SDK 模式下也必须初始化
   */
  sessionHooks: SessionHooksState

  // ============================================================
  // 可选字段（5 个）
  // ============================================================

  /**
   * 快速模式标志
   * 启用时跳过某些检查和优化
   */
  fastMode?: boolean

  /**
   * 详细输出标志
   * 调试模式下启用
   */
  verbose?: boolean

  /**
   * 消息列表
   * 用于状态管理和同步
   */
  messages?: Message[]

  /**
   * 初始消息
   * CLI 参数传递的初始用户消息
   */
  initialMessage?: UserMessage

  /**
   * Effort 参数
   * API 调用的 effort 值
   */
  effortValue?: EffortValue

  /**
   * 顾问模型
   * 高级功能使用的顾问模型配置
   */
  advisorModel?: string
}
