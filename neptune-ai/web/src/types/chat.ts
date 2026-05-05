// === Task Panel Types ===

// 执行计划任务（来自 Agent 的 TaskCreate/TaskUpdate 工具调用）
export interface PlanTask {
  id: string
  subject: string
  description: string
  activeForm?: string
  owner?: string
  status: 'pending' | 'in_progress' | 'completed'
  blocks: string[]
  blockedBy: string[]
}

// 后台活动任务（来自 Engine SDK 事件: task_started/progress/notification）
export interface BackgroundTask {
  id: string
  type: 'local_bash' | 'local_agent' | 'remote_agent' | 'local_workflow'
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'killed'
  startTime: number
  endTime?: number
  summary?: string
}

// === Agent Template Types (from API) ===

export interface AgentTemplate {
  id: string
  tenantId: string
  name: string
  description: string | null
  icon: string
  systemPrompt: string
  modelConfig: {
    provider: string
    model: string
    temperature: number
    maxTokens: number
  }
  tools: string[]
  skills: Array<{ id: string; name: string; version?: string }>
  mcpServers: Array<{ name: string; url: string; authConfig?: Record<string, unknown> }>
  constraints: {
    maxTokensPerTurn?: number
    maxTurnsPerSession?: number
    maxConcurrentSessions?: number
  }
  version: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// === Thread Types ===

export interface Thread {
  id: string
  tenantId: string
  userId: string
  templateId: string
  status: 'running' | 'idle' | 'completed' | 'error'
  title: string | null
  summary: string | null
  workspace: string
  lastActiveAt: string | null
  createdAt: string
  updatedAt: string
}

// === Chat Types ===

export type MessageBlock =
  | { type: 'thinking'; content: string; duration?: number }
  | { type: 'text'; content: string }
  | { type: 'tool_use'; id: string; name: string; input?: Record<string, unknown>; status: 'running' | 'completed' | 'error' }
  | { type: 'tool_result'; toolUseId: string; output?: Record<string, unknown>; isError?: boolean }
  | { type: 'artifact'; id: string; title: string; fileType: string; content: string }

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  blocks: MessageBlock[]
  status: 'streaming' | 'complete'
}
