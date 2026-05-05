import type { Thread } from '../types/chat'
import { API_BASE, getAuthHeaders, handleUnauthorized } from './client'
import { getStoredToken } from '../stores/auth'

// === Thread CRUD ===

/** Thread 列表接口返回结构 */
export interface ListThreadsResponse {
  data: Thread[]
  meta: {
    count: number
    limit: number
    offset: number
  }
}

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
): Promise<{
  data: unknown[]
  meta: unknown
}> {
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

// === Thread Chat (SSE) ===

/** SSE 事件回调 */
export interface SSECallbacks {
  onEvent: (event: { type: string; data: unknown }) => void
  onError?: (error: Error) => void
  onDone?: () => void
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
        callbacks.onError?.(new Error(`Chat failed: ${res.status}`))
        return
      }

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let currentEvent = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7)
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6)
            try {
              const parsed = JSON.parse(dataStr)
              if (currentEvent === 'done') {
                callbacks.onDone?.()
              } else if (currentEvent === 'error') {
                callbacks.onError?.(
                  new Error(
                    (parsed as { message?: string }).message || 'SSE error',
                  ),
                )
              } else if (currentEvent === 'message') {
                // Backend sends content events as `event: message`
                // with actual type in `data.type`
                const subType = (parsed as { type?: string }).type || 'text'
                callbacks.onEvent({ type: subType, data: parsed })
              } else if (currentEvent === 'connected') {
                // Connection confirmation, ignore
              } else {
                // Fallback: use SSE event name directly
                callbacks.onEvent({ type: currentEvent, data: parsed })
              }
            } catch {
              // 解析失败的 data 行忽略
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        callbacks.onError?.(err)
      }
    })

  return controller
}
