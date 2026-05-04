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

// === Thread Types ===

export interface Thread {
  id: string
  agentId: string
  title: string | null
  summary: string | null
  status: 'running' | 'idle' | 'completed' | 'error'
  lastActiveAt: string
  createdAt: string
}

// === Chat Types (existing) ===

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

export interface Agent {
  id: string
  agentName: string
  agentRole: string
  title: string
  time: string
  icon: string
}
