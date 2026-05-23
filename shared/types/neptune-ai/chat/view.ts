export type PlanTaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface PlanTask {
  id: string;
  subject: string;
  description: string;
  activeForm?: string;
  owner?: string;
  status: PlanTaskStatus;
  blocks: string[];
  blockedBy: string[];
}

export interface BackgroundTask {
  id: string;
  type: 'local_bash' | 'local_agent' | 'remote_agent' | 'local_workflow';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'killed';
  startTime: number;
  endTime?: number;
  summary?: string;
}

export interface AskUserQuestion {
  question: string;
  header?: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
}

export interface PlanTodo {
  content: string;
  status: PlanTaskStatus;
  activeForm?: string;
}

export type MessageBlock =
  | { type: 'thinking'; content: string; duration?: number }
  | { type: 'text'; content: string }
  | { type: 'tool_use'; id: string; name: string; input?: Record<string, unknown>; status: 'running' | 'completed' | 'error' }
  | { type: 'tool_result'; toolUseId: string; output?: Record<string, unknown>; isError?: boolean }
  | { type: 'artifact'; id: string; title: string; fileType: string; content: string }
  | { type: 'ask_user'; id: string; questions: AskUserQuestion[]; answered?: boolean; answers?: Record<string, string> }
  | { type: 'plan'; id: string; todos: PlanTodo[] };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  blocks: MessageBlock[];
  status: 'streaming' | 'complete';
  createdAt?: string;
}
