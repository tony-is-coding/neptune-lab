import type {IsoDateString} from './common';

export interface AgentThreadSummaryDto {
  totalThreads: number;
  latestStatus: 'running' | 'idle' | 'completed' | 'error' | null;
  latestThreadTitle: string | null;
  lastActiveAt: IsoDateString | null;
}

export interface AgentTemplateDto {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  icon: string;
  systemPrompt: string;
  promptConfig?: Record<string, unknown> | null;
  modelConfig: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  tools: string[];
  skills: Array<{ id: string; name: string; version?: string }>;
  mcpServers: Array<{ name: string; url: string; authConfig?: Record<string, unknown> }>;
  constraints: {
    maxTokensPerTurn?: number;
    maxTurnsPerSession?: number;
    maxConcurrentSessions?: number;
  };
  version: number;
  isActive: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  threadSummary?: AgentThreadSummaryDto | null;
}

export interface CreateAgentRequest {
  name: string;
  systemPrompt: string;
  modelConfig: AgentTemplateDto['modelConfig'];
  description?: string | null;
  icon?: string;
}

export type UpdateAgentRequest = Partial<Omit<CreateAgentRequest, 'name'>> & {
  name?: string;
};
