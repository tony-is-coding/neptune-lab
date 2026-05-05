/**
 * SSE 事件映射器 — 将 SDK QueryEvent 映射为前端 SSE 事件
 *
 * SDK engine.query() 返回的 QueryEvent 类型与前端期望的 SSE 事件格式不同，
 * 此模块负责两者之间的转换。一个 SDK 事件可能映射为多个前端事件。
 *
 * 纯函数，无副作用，无外部依赖。
 */

import type { QueryEvent } from 'claude-code-best/engine';

// ===== 前端 SSE 事件类型定义 =====

/** 文本输出事件 */
export interface SSETextEvent {
  type: 'text';
  content: string;
}

/** 工具调用开始事件 */
export interface SSEToolUseEvent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: string;
}

/** 工具结果事件 */
export interface SSEToolResultEvent {
  type: 'tool_result';
  toolUseId: string;
  output: unknown;
}

/** 工具状态更新事件（完成/错误） */
export interface SSEToolStatusEvent {
  type: 'tool_status';
  id: string;
  status: string;
}

/** 错误事件 */
export interface SSEErrorEvent {
  type: 'error';
  message: string;
}

/** 对话完成事件 */
export interface SSEDoneEvent {
  type: 'done';
  usage?: Record<string, unknown>;
}

/** SSE 事件联合类型 */
export type SSEEvent =
  | SSETextEvent
  | SSEToolUseEvent
  | SSEToolResultEvent
  | SSEToolStatusEvent
  | SSEErrorEvent
  | SSEDoneEvent
  | Record<string, unknown>;

// ===== SDK 事件结构类型（用于类型安全的属性访问） =====

interface SDKAssistantEvent extends QueryEvent {
  type: 'assistant';
  content: string;
}

interface SDKToolUseEvent extends QueryEvent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface SDKToolResultEvent extends QueryEvent {
  type: 'tool_result';
  toolUseId: string;
  content: unknown;
  isError?: boolean;
}

interface SDKErrorEvent extends QueryEvent {
  type: 'error' | 'assistant_error';
  error: unknown;
}

// ===== 映射函数 =====

/**
 * 将 SDK QueryEvent 映射为前端 SSE 事件数组
 *
 * 映射规则：
 * - assistant → text
 * - tool_use → tool_use (status: 'running')
 * - tool_result → tool_result + tool_status (completed/error)
 * - system → （静默丢弃，不发给前端）
 * - error / assistant_error → error
 * - 其他未知类型 → 透传
 */
export function mapSSEEvent(sdkEvent: QueryEvent): SSEEvent[] {
  switch (sdkEvent.type) {
    case 'assistant': {
      const event = sdkEvent as SDKAssistantEvent;
      return [{ type: 'text', content: event.content }];
    }

    case 'tool_use': {
      const event = sdkEvent as SDKToolUseEvent;
      return [{
        type: 'tool_use',
        id: event.id,
        name: event.name,
        input: event.input,
        status: 'running',
      }];
    }

    case 'tool_result': {
      const event = sdkEvent as SDKToolResultEvent;
      const events: SSEEvent[] = [];

      // 先发 tool_result
      events.push({
        type: 'tool_result',
        toolUseId: event.toolUseId,
        output: event.content,
      });

      // 再发 tool_status：根据是否有错误决定状态
      events.push({
        type: 'tool_status',
        id: event.toolUseId,
        status: event.isError ? 'error' : 'completed',
      });

      return events;
    }

    case 'system':
      // 系统消息不发给前端
      return [];

    case 'error':
    case 'assistant_error': {
      const event = sdkEvent as SDKErrorEvent;
      const message = event.error instanceof Error
        ? event.error.message
        : String(event.error);
      return [{ type: 'error', message }];
    }

    default:
      // 未知类型透传
      return [sdkEvent as SSEEvent];
  }
}
