/**
 * QueryEvent — SDK query() 流式事件联合类型
 *
 * 为 AgentEngine.query() 返回的 AsyncGenerator 提供类型安全的消息类型。
 * 覆盖 5 种核心事件变体，方便 SDK 用户处理流式响应。
 */

/** 基础 SDK Message 类型（来自 CC 原始代码）*/
export type SDKMessage = { type: string; [key: string]: unknown }

// ============================================================
// 5 种核心事件变体
// ============================================================

/**
 * AssistantTextEvent — 助手文本消息
 * 对应 SDKAssistantMessage，包含助手生成的文本内容
 */
export interface AssistantTextEvent extends SDKMessage {
  type: 'assistant'
  content: string // 文本内容
}

/**
 * ToolUseEvent — 工具调用事件
 * 对应 assistant 发起的 tool_use 调用
 */
export interface ToolUseEvent extends SDKMessage {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

/**
 * ToolResultEvent — 工具执行结果事件
 * 对应 tool 执行完成后的结果返回
 */
export interface ToolResultEvent extends SDKMessage {
  type: 'tool_result'
  toolUseId: string
  content: unknown
  isError?: boolean
}

/**
 * SystemEvent — 系统消息事件
 * 对应 SDKSystemMessage，包含系统级通知、状态变更等
 */
export interface SystemEvent extends SDKMessage {
  type: 'system'
  content?: unknown
}

/**
 * ErrorEvent — 错误事件
 * 对应 SDKAssistantErrorMessage 或其他错误类型
 */
export interface ErrorEvent extends SDKMessage {
  type: 'assistant_error' | 'error'
  error: Error | string
}

// ============================================================
// 联合类型
// ============================================================

/**
 * QueryEvent — query() 流的所有可能事件类型
 *
 * 使用联合类型提供类型安全，SDK 用户可通过类型守卫（type guard）
 * 或 switch 语句处理不同事件。
 */
export type QueryEvent =
  | AssistantTextEvent
  | ToolUseEvent
  | ToolResultEvent
  | SystemEvent
  | ErrorEvent

// ============================================================
// 类型守卫（Type Guards）
// ============================================================

/**
 * 检查是否为 AssistantTextEvent
 */
export function isAssistantTextEvent(event: SDKMessage): event is AssistantTextEvent {
  return event.type === 'assistant'
}

/**
 * 检查是否为 ToolUseEvent
 */
export function isToolUseEvent(event: SDKMessage): event is ToolUseEvent {
  return event.type === 'tool_use'
}

/**
 * 检查是否为 ToolResultEvent
 */
export function isToolResultEvent(event: SDKMessage): event is ToolResultEvent {
  return event.type === 'tool_result'
}

/**
 * 检查是否为 SystemEvent
 */
export function isSystemEvent(event: SDKMessage): event is SystemEvent {
  return event.type === 'system'
}

/**
 * 检查是否为 ErrorEvent
 */
export function isErrorEvent(event: SDKMessage): event is ErrorEvent {
  return event.type === 'assistant_error' || event.type === 'error'
}

// ============================================================
// 工具类型
// ============================================================

/**
 * 从 QueryEvent 中提取类型字符串的联合类型
 */
export type QueryEventType = QueryEvent['type']

/**
 * QueryEvent 辅助信息（用于调试或日志）
 */
export interface QueryEventMetadata {
  type: QueryEventType
  timestamp?: number
  sessionId?: string
}
