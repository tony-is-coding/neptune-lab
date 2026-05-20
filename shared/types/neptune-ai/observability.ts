export interface ChatRequestContext {
  requestId: string;
  tenantId: string;
  userId: string;
  agentId: string;
  threadId: string;
  sdkSessionId?: string;
  model?: string;
}

export interface ChatTraceMetadata extends ChatRequestContext {
  durationMs?: number;
  traceId?: string;
  traceUrl?: string;
}
