import type {
  ApiErrorEnvelope,
  ChatConnectedEvent,
  ChatDoneEvent,
  ChatErrorEvent,
  ChatMessageEvent,
  ListThreadsResponse,
  ReplyToQuestionRequest,
  ThreadDto as Thread,
  ThreadHistoryResponse,
  ThreadTasksResponse,
} from '@shared/neptune-ai'
import { API_BASE, getAuthHeaders, handleUnauthorized } from './client'
import { getStoredToken } from '../stores/auth'
import {parseSSEChunk} from './sse-parser'

// === Thread CRUD ===

/** 获取 Agent 的 Thread 列表 */
export async function listThreads(
  agentId: string,
  filters?: {
    status?: string
    limit?: number
    offset?: number
  },
): Promise<ListThreadsResponse> {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.limit) params.set('limit', String(filters.limit))
  if (filters?.offset) params.set('offset', String(filters.offset))
  const qs = params.toString() ? `?${params.toString()}` : ''

  const res = await fetch(`${API_BASE}/agents/${agentId}/threads${qs}`, {
    headers: getAuthHeaders(),
  })
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`listThreads failed: ${res.status}`)
  return res.json()
}

/** 创建新 Thread */
export async function createThread(
  agentId: string,
  title?: string,
): Promise<Thread> {
  const res = await fetch(`${API_BASE}/agents/${agentId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ title }),
  })
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`createThread failed: ${res.status}`)
  return res.json()
}

/** 获取 Thread 详情 */
export async function getThread(
  agentId: string,
  threadId: string,
): Promise<Thread> {
  const res = await fetch(
    `${API_BASE}/agents/${agentId}/threads/${threadId}`,
    {
      headers: getAuthHeaders(),
    },
  )
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`getThread failed: ${res.status}`)
  return res.json()
}

/** 更新 Thread（标题、状态） */
export async function updateThread(
  agentId: string,
  threadId: string,
  data: {
    title?: string
    status?: string
  },
): Promise<Thread> {
  const res = await fetch(
    `${API_BASE}/agents/${agentId}/threads/${threadId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    },
  )
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`updateThread failed: ${res.status}`)
  return res.json()
}

/** 删除 Thread */
export async function deleteThread(
  agentId: string,
  threadId: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/agents/${agentId}/threads/${threadId}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders(),
    },
  )
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`deleteThread failed: ${res.status}`)
}

/** 获取 Thread 对话历史 */
export async function getThreadHistory(
  agentId: string,
  threadId: string,
): Promise<ThreadHistoryResponse> {
  const res = await fetch(
    `${API_BASE}/agents/${agentId}/threads/${threadId}/history`,
    {
      headers: getAuthHeaders(),
    },
  )
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`getThreadHistory failed: ${res.status}`)
  return res.json()
}

/** 获取 Thread 的任务列表 */
export async function getThreadTasks(
  agentId: string,
  threadId: string,
): Promise<ThreadTasksResponse> {
  const res = await fetch(
    `${API_BASE}/agents/${agentId}/threads/${threadId}/tasks`,
    { headers: getAuthHeaders() },
  )
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`getThreadTasks failed: ${res.status}`)
  return res.json()
}

/** 回复 AskUserQuestion（用户选择答案后调用） */
export async function replyToQuestion(
  agentId: string,
  threadId: string,
  toolUseId: string,
  answers: ReplyToQuestionRequest['answers'],
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/agents/${agentId}/threads/${threadId}/reply`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ toolUseId, answers }),
    },
  )
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`replyToQuestion failed: ${res.status}`)
}

// === Thread Chat (SSE) ===

/** SSE 事件回调 */
export interface SSECallbacks {
  onEvent: (event: ChatMessageEvent) => void
  onError?: (error: Error, event?: ChatErrorEvent) => void
  onDone?: (event?: ChatDoneEvent) => void
  onConnected?: (event: ChatConnectedEvent) => void
}

/**
 * 向 Thread 发送消息（SSE 流式）
 *
 * 返回 AbortController，调用 controller.abort() 可中断流。
 */
export function sendThreadMessage(
  agentId: string,
  threadId: string,
  content: string,
  callbacks: SSECallbacks,
): AbortController {
  const controller = new AbortController()

  const token = getStoredToken() || ''

  fetch(`${API_BASE}/agents/${agentId}/threads/${threadId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        let envelope: Partial<ApiErrorEnvelope> = {};
        try {
          envelope = await res.json();
        } catch {
          envelope = {};
        }
        if (res.status === 401) {
          callbacks.onError?.(new Error(envelope.message || '登录已过期，请重新登录'))
          return
        }
        callbacks.onError?.(new Error(envelope.message || `Chat failed: ${res.status}`))
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        // 没有 body 的情况视为完成
        callbacks.onDone?.()
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          // 流正常结束时调用 onDone
          callbacks.onDone?.()
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const parsedChunk = parseSSEChunk('', buffer)
        buffer = parsedChunk.buffer

        for (const frame of parsedChunk.frames) {
          const parsed = frame.data as Record<string, unknown>
          if (frame.event === 'done') {
            callbacks.onDone?.({ type: 'done', ...(parsed as Omit<ChatDoneEvent, 'type'>) })
          } else if (frame.event === 'error') {
            const event = { type: 'error', ...(parsed as Omit<ChatErrorEvent, 'type'>) } as ChatErrorEvent
            callbacks.onError?.(new Error(event.message || 'SSE error'), event)
          } else if (frame.event === 'message') {
            callbacks.onEvent(parsed as unknown as ChatMessageEvent)
          } else if (frame.event === 'connected') {
            callbacks.onConnected?.({ type: 'connected', ...(parsed as Omit<ChatConnectedEvent, 'type'>) })
          } else {
            callbacks.onEvent({ ...parsed, type: frame.event } as unknown as ChatMessageEvent)
          }
        }
      }
    })
    .catch((err) => {
      if (err.name === 'AbortError') {
        callbacks.onError?.(new Error('已停止生成'))
        return
      }
      callbacks.onError?.(err)
    })

  return controller
}
