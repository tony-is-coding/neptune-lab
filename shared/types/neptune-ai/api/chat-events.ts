import type {ApiErrorEnvelope} from './common';
import type {AskUserQuestion, PlanTaskStatus} from '../chat/view';

export interface ChatConnectedEvent {
  type: 'connected';
  requestId: string;
  threadId: string;
  timestamp: number;
}

export interface ChatTextEvent {
  type: 'text';
  content: string;
  isDelta?: boolean;
  requestId?: string;
}

export interface ChatThinkingEvent {
  type: 'thinking';
  content: string;
  isDelta?: boolean;
  requestId?: string;
}

export interface ChatToolUseEvent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'running' | 'completed' | 'error';
  requestId?: string;
}

export interface ChatToolResultEvent {
  type: 'tool_result';
  toolUseId: string;
  output: unknown;
  isError?: boolean;
  requestId?: string;
}

export interface ChatToolStatusEvent {
  type: 'tool_status';
  id: string;
  status: 'running' | 'completed' | 'error';
  requestId?: string;
}

export interface ChatAskUserEvent {
  type: 'ask_user';
  id: string;
  questions: AskUserQuestion[];
  requestId?: string;
}

export interface ChatArtifactEvent {
  type: 'artifact';
  id: string;
  title: string;
  fileType: string;
  content: string;
  requestId?: string;
}

export interface ChatPlanCreatedEvent {
  type: 'plan_created';
  planId: string;
  title: string;
  totalSteps: number;
  createdAt: string;
  requestId?: string;
}

export interface ChatPlanStepEvent {
  type: 'plan_step';
  planId: string;
  stepId: string;
  stepNumber: number;
  subject: string;
  status: PlanTaskStatus;
  activeForm?: string;
  updatedAt: string;
  requestId?: string;
}

export interface ChatPlanDoneEvent {
  type: 'plan_done';
  planId: string;
  status: 'completed' | 'failed';
  summary?: string;
  duration: number;
  completedAt: string;
  requestId?: string;
}

export interface ChatDoneEvent {
  type: 'done';
  requestId: string;
  usage?: Record<string, unknown>;
}

export interface ChatErrorEvent extends ApiErrorEnvelope {
  type: 'error';
  requestId: string;
}

export type ChatMessageEvent =
  | ChatTextEvent
  | ChatThinkingEvent
  | ChatToolUseEvent
  | ChatToolResultEvent
  | ChatToolStatusEvent
  | ChatAskUserEvent
  | ChatArtifactEvent
  | ChatPlanCreatedEvent
  | ChatPlanStepEvent
  | ChatPlanDoneEvent;

export type ChatStreamEvent =
  | ChatConnectedEvent
  | ChatMessageEvent
  | ChatDoneEvent
  | ChatErrorEvent;

export type ChatSseEventName = 'connected' | 'message' | 'done' | 'error';
