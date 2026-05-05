import type { AgentTemplate } from '../types/chat'
import { API_BASE, getAuthHeaders, handleUnauthorized } from './client'

export interface ListAgentsResponse {
  data: AgentTemplate[]
  meta: { count: number; limit: number; offset: number }
}

export async function listAgents(params?: {
  active?: boolean
  limit?: number
  offset?: number
}): Promise<ListAgentsResponse> {
  const searchParams = new URLSearchParams()
  if (params?.active !== undefined) searchParams.set('active', String(params.active))
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

export async function getAgent(id: string): Promise<AgentTemplate> {
  const res = await fetch(`${API_BASE}/agents/${id}`, {
    headers: getAuthHeaders(),
  })
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
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
  mtdTokenCost: number
  mtdTokenLimit: number
  sessions30Days: number
  avgLatency: number
}

export async function getAgentStats(id: string): Promise<AgentStats> {
  const res = await fetch(`${API_BASE}/agents/${id}/stats`, {
    headers: getAuthHeaders(),
  })
  if (res.status === 401) { handleUnauthorized(res); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`getAgentStats failed: ${res.status}`)
  return res.json()
}

// === Agent Documents ===

export interface AgentDocument {
  id: string
  name: string
  type: string
  size?: string
  uploadedAt: string
}

export async function uploadAgentDocument(
  id: string,
  file: File,
): Promise<AgentDocument> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${API_BASE}/agents/${id}/documents`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
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
