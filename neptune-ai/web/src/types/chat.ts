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

// Agent Thread 聚合摘要信息（来自后端 listWithThreadSummary）
export interface AgentThreadSummary {
  totalThreads: number
  latestStatus: 'running' | 'idle' | 'completed' | 'error' | null
  latestThreadTitle: string | null
  lastActiveAt: string | null
}

// Agent 带 Thread 摘要扩展（用于 listAgents include=thread_summary）
export interface AgentWithSummary extends AgentTemplate {
  threadSummary?: AgentThreadSummary | null
}

// === Thread Types ===

/**
 * 后端 Thread 状态：created/running/paused/terminated/error
 * 前端显示映射：
 * - idle ← created, paused, terminated（用户可以交互的）
 * - running ← running（Agent 正在工作）
 * - error ← error
 */
export type ThreadStatus = 'idle' | 'running' | 'completed' | 'error';

export interface Thread {
  id: string
  tenantId: string
  userId: string
  templateId: string
  status: ThreadStatus
  title: string | null
  summary: string | null
  workspace: string
  lastActiveAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * 判断 Thread 是否属于 Current 区域（用户可以交互的）
 * Current: idle 状态（created, paused, terminated 映射为 idle）
 */
export function isCurrentThread(thread: Thread): boolean {
  return thread.status === 'idle';
}

/**
 * 判断 Thread 是否属于 Backend 区域（Agent 正在工作）
 * Backend: running 状态
 */
export function isBackendThread(thread: Thread): boolean {
  return thread.status === 'running';
}

// === Chat Types ===

export type MessageBlock =
  | { type: 'thinking'; content: string; duration?: number }
  | { type: 'text'; content: string }
  | { type: 'tool_use'; id: string; name: string; input?: Record<string, unknown>; status: 'running' | 'completed' | 'error' }
  | { type: 'tool_result'; toolUseId: string; output?: Record<string, unknown>; isError?: boolean }
  | { type: 'artifact'; id: string; title: string; fileType: string; content: string }
  | { type: 'ask_user'; id: string; questions: AskUserQuestion[]; answered?: boolean; answers?: Record<string, string> }
  | { type: 'plan'; id: string; todos: PlanTodo[] }

export interface PlanTodo {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}

export interface AskUserQuestion {
  question: string
  header?: string
  options: Array<{ label: string; description?: string }>
  multiSelect?: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  blocks: MessageBlock[]
  status: 'streaming' | 'complete'
  createdAt?: string
}
