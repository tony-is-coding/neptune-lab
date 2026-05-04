/**
 * Engine 事件系统类型映射
 *
 * 为 AgentEngine.on() 和 once() 方法提供类型安全的事件类型定义。
 * 每个事件类型对应特定的 payload 结构。
 */

/**
 * EngineEventMap — 事件类型到 payload 的映射
 *
 * SDK 用户可以通过泛型参数获得类型安全：
 * ```typescript
 * engine.on('session:created', (payload) => {
 *   // payload 类型为 { sessionId: string; workspace: string }
 * })
 * ```
 */
export interface EngineEventMap {
  /** Session 创建成功事件 */
  'session:created': { sessionId: string; workspace: string }

  /** Session 销毁成功事件 */
  'session:destroyed': { sessionId: string; workspace: string }

  /** Session 暂停成功事件 */
  'session:paused': { sessionId: string; workspace: string }

  /** Session 恂复成功事件 */
  'session:resumed': { sessionId: string; workspace: string }

  /** Engine 停止事件 */
  'engine:stopped': Record<string, never>

  /** Engine 关机事件（gracefulShutdown 触发） */
  'engine:shutdown': { reason: string }

  /** 错误事件 */
  'error': { error: Error; source: string; eventType?: string; sessionId?: string }

  // CC 原始消息事件（透传）—— 使用 SDKMessage 保持灵活性
  /** Assistant 消息事件 */
  'assistant': { type: string; [key: string]: unknown }

  /** 文本消息事件 */
  'text': { type: string; [key: string]: unknown }

  /** 工具调用事件 */
  'tool_use': { type: string; [key: string]: unknown }

  /** 工具结果事件 */
  'tool_result': { type: string; [key: string]: unknown }

  /** 通用消息事件 */
  'message': { type: string; [key: string]: unknown }

  /** Query 完成事件（含 token 用量） */
  'query:complete': {
    sessionId: string
    modelUsage: Record<string, {
      inputTokens: number
      outputTokens: number
      cacheReadInputTokens: number
      cacheCreationInputTokens: number
      webSearchRequests: number
      costUSD: number
      contextWindow: number
      maxOutputTokens: number
    }>
  }
}

/**
 * 从 EngineEventMap 中提取所有事件类型的联合类型
 */
export type EngineEventType = keyof EngineEventMap
