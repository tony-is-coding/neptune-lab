import type {IsoDateString, ListResponse} from './common';
import type {ChatMessage, PlanTask} from '../chat/view';
import type {RunListResponse} from './platform-facts';

export type ThreadStatus = 'created' | 'running' | 'idle' | 'completed' | 'error';

export interface ThreadDto {
  id: string;
  tenantId: string;
  userId: string;
  templateId: string;
  status: ThreadStatus;
  title: string | null;
  summary: string | null;
  workspace: string;
  lastActiveAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export type ListThreadsResponse = ListResponse<ThreadDto>;
export type ThreadRunListResponse = RunListResponse;

export interface CreateThreadRequest {
  title?: string;
}

export interface UpdateThreadRequest {
  title?: string;
  status?: ThreadStatus;
}

export interface ThreadHistoryResponse {
  data: ChatMessage[];
  meta: Record<string, unknown>;
}

export interface ReplyToQuestionRequest {
  toolUseId: string;
  answers: Record<string, string>;
}

export interface ThreadTasksResponse {
  data: PlanTask[];
}
