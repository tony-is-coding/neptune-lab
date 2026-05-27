import type { AgentTemplate, AgentWithSummary } from '../types/chat'
import type {AgentDocumentCategory, AgentDocumentDto} from '@shared/neptune-ai'
import { API_BASE, getAuthHeaders, handleUnauthorized, fetchWithTimeout } from './client'

export interface ListAgentsResponse<T = AgentTemplate> {
  data: T[]
  meta: { count: number; limit: number; offset: number; include?: string }
}

export async function listAgents(params?: {
  active?: boolean
  include?: 'thread_summary'
  limit?: number
  offset?: number
}): Promise<ListAgentsResponse<AgentTemplate>> {
  const searchParams = new URLSearchParams()
  if (params?.active !== undefined) searchParams.set('active', String(params.active))
  if (params?.include) searchParams.set('include', params.include)
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))
  const qs = searchParams.toString() ? `?${searchParams.toString()}` : ''

  const res = await fetch(`${API_BASE}/agents${qs}`, {
    headers: getAuthHeaders(),
  })
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`listAgents failed: ${res.status}`)
  return res.json()
}

// 带泛型的 listAgents（用于 include=thread_summary）
export async function listAgentsWithSummary(params?: {
  active?: boolean
  limit?: number
  offset?: number
}): Promise<ListAgentsResponse<AgentWithSummary>> {
  return listAgents({ ...params, include: 'thread_summary' }) as Promise<ListAgentsResponse<AgentWithSummary>>
}

export async function getAgent(id: string): Promise<AgentTemplate> {
  const res = await fetchWithTimeout(`${API_BASE}/agents/${id}`, {
    headers: getAuthHeaders(),
  })
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (res.status === 404) throw new Error('Agent not found')
  if (!res.ok) throw new Error(`getAgent failed: ${res.status}`)
  return res.json()
}

// === Agent CRUD ===

export interface CreateAgentData {
  name: string
  description?: string
  systemPrompt?: string
  modelConfig?: {
    provider?: string
    model?: string
    temperature?: number
    maxTokens?: number
  }
  tools?: string[]
  skills?: Array<{ id: string; name: string; version?: string }>
  mcpServers?: Array<{ name: string; url: string; authConfig?: Record<string, unknown> }>
  constraints?: {
    maxTokensPerTurn?: number
    maxTurnsPerSession?: number
    maxConcurrentSessions?: number
  }
}

export async function createAgent(data: CreateAgentData): Promise<AgentTemplate> {
  const res = await fetch(`${API_BASE}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  })
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`createAgent failed: ${res.status}`)
  return res.json()
}

export async function updateAgent(id: string, data: Partial<CreateAgentData>): Promise<AgentTemplate> {
  const res = await fetch(`${API_BASE}/agents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  })
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`updateAgent failed: ${res.status}`)
  return res.json()
}

export async function deleteAgent(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/agents/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`deleteAgent failed: ${res.status}`)
}

// === Agent Stats ===

export interface AgentStats {
  // 前端期望的字段名
  mtdTokenCost?: number
  mtdTokenLimit?: number
  sessions30Days?: number
  avgLatency: number
  // 后端实际返回的字段名
  mtdCost?: number
  budgetLimit?: number
  thirtyDaySessions?: number
  activeSessions?: number
}

export async function getAgentStats(id: string): Promise<AgentStats> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/agents/${id}/stats`, {
      headers: getAuthHeaders(),
    }, 5000) // stats 使用 5 秒超时
    if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
    if (!res.ok) throw new Error(`getAgentStats failed: ${res.status}`)
    return res.json()
  } catch (error) {
    // Stats 失败不应该阻塞页面，返回 null 让调用方处理
    if (error instanceof Error && error.message === 'Request timeout') {
      console.warn('Agent stats request timeout')
    } else {
      console.warn('Failed to load agent stats:', error)
    }
    throw error
  }
}

// === Agent Documents ===

export type AgentDocument = AgentDocumentDto

/** 获取 Agent 文档列表 */
export async function listAgentDocuments(
  id: string,
  params?: { category?: AgentDocumentCategory },
): Promise<AgentDocument[]> {
  const searchParams = new URLSearchParams()
  if (params?.category) searchParams.set('category', params.category)
  const qs = searchParams.toString() ? `?${searchParams.toString()}` : ''

  const res = await fetch(`${API_BASE}/agents/${id}/documents${qs}`, {
    headers: getAuthHeaders(),
  })
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`listAgentDocuments failed: ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}

/** 上传文档到 Agent（将 File 转为 base64 JSON body，匹配后端接口） */
export async function uploadAgentDocument(
  id: string,
  file: File,
  category: AgentDocumentCategory = 'document',
): Promise<AgentDocument> {
  // 将文件转为 base64
  const arrayBuffer = await file.arrayBuffer()
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  )

  const res = await fetch(`${API_BASE}/agents/${id}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({
      name: file.name,
      type: file.type || file.name.split('.').pop()?.toUpperCase() || 'FILE',
      size: file.size,
      content: base64,
      category,
    }),
  })
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`uploadAgentDocument failed: ${res.status}`)
  return res.json()
}

export async function deleteAgentDocument(id: string, docId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/agents/${id}/documents/${docId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`deleteAgentDocument failed: ${res.status}`)
}

// Skills API 在 ./skills.ts 中维护（含分页 / CRUD / 上下架 / Agent 关联）。
// 历史上这里有重复实现，已在 P1-3 wave 2 整合并删除。
