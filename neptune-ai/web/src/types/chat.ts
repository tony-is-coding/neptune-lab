export type {
  AgentTemplateDto as AgentTemplate,
  AgentTemplateDto as AgentWithSummary,
  AgentThreadSummaryDto as AgentThreadSummary,
  AskUserQuestion,
  BackgroundTask,
  ChatMessage,
  MessageBlock,
  PlanTask,
  PlanTodo,
  ThreadDto as Thread,
} from '@shared/neptune-ai';

import type {ThreadDto} from '@shared/neptune-ai';

/**
 * Web 展示层折叠后的 Thread 状态。
 * 后端原始状态仍由 shared `ThreadDto.status` 表达。
 */
export type ThreadStatus = 'idle' | 'running' | 'completed' | 'error';

/**
 * 判断 Thread 是否属于 Current 区域（用户可以交互的）。
 */
export function isCurrentThread(thread: Pick<ThreadDto, 'status'>): boolean {
  return thread.status === 'idle' || thread.status === 'created';
}

/**
 * 判断 Thread 是否属于 Backend 区域（Agent 正在工作）。
 */
export function isBackendThread(thread: Pick<ThreadDto, 'status'>): boolean {
  return thread.status === 'running';
}
