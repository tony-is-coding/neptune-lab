import type {IsoDateString, ListResponse} from './common';

export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface RunDto {
  id: string;
  tenantId: string;
  userId: string;
  agentId: string;
  agentVersionId: string | null;
  threadId: string;
  requestId: string;
  status: RunStatus;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  startedAt: IsoDateString;
  completedAt: IsoDateString | null;
  retryOfRunId?: string | null;
}

export interface CreateRunRequest {
  agentId: string;
  input: string;
  title?: string | null;
}

export interface RetryRunRequest {
  input: string;
  title?: string | null;
}

export interface RunEventDto {
  id: number;
  tenantId: string;
  runId: string;
  eventType: string;
  sequence: number;
  requestId: string | null;
  payloadSummary: Record<string, unknown>;
  occurredAt: IsoDateString;
}

export type ToolInvocationStatus = 'running' | 'completed' | 'failed';

export interface ToolInvocationDto {
  id: string;
  tenantId: string;
  runId: string;
  toolUseId: string;
  toolName: string;
  status: ToolInvocationStatus;
  requestId: string | null;
  inputSummary: Record<string, unknown>;
  outputSummary: Record<string, unknown> | null;
  errorSummary: Record<string, unknown> | null;
  startedAt: IsoDateString;
  completedAt: IsoDateString | null;
}

export type PolicyDecisionResult = 'allow' | 'deny' | 'review_required';

export interface PolicyDecisionDto {
  id: string;
  tenantId: string;
  runId: string | null;
  requestId: string | null;
  policyType: string;
  subjectType: string;
  subjectId: string;
  decision: PolicyDecisionResult;
  reason: string;
  detailsSummary: Record<string, unknown>;
  createdAt: IsoDateString;
}

export type ArtifactType = 'file' | 'report' | 'table' | 'dataset' | 'evidence' | 'other';
export type ArtifactSourceType = 'runtime_tool' | 'upload' | 'connector' | 'generated_report' | 'manual' | 'other';

export interface ArtifactDto {
  id: string;
  tenantId: string;
  runId: string | null;
  requestId: string | null;
  artifactType: ArtifactType;
  title: string;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string;
  storageUri: string;
  sourceType: ArtifactSourceType;
  sourceRef: string | null;
  createdBy: string | null;
  metadataSummary: Record<string, unknown>;
  createdAt: IsoDateString;
}

export type EvidenceArtifactType = 'source_file' | 'connector_snapshot' | 'generated_extract' | 'runtime_observation' | 'other';

export interface EvidenceArtifactDto {
  id: string;
  tenantId: string;
  artifactId: string;
  runId: string | null;
  requestId: string | null;
  evidenceType: EvidenceArtifactType;
  sourceSystem: string | null;
  sourceUri: string | null;
  sourceHash: string;
  importedBy: string | null;
  capturedAt: IsoDateString | null;
  metadataSummary: Record<string, unknown>;
  createdAt: IsoDateString;
}

export type CostSummaryPeriod = 'today' | 'month_to_date' | 'all_time';

export interface CostSummaryByModelDto {
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costCents: number;
  recordCount: number;
}

export interface CostSummaryDto {
  tenantId: string;
  period: CostSummaryPeriod;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCostCents: number;
  recordCount: number;
  quota: {
    maxTokensPerDay: number;
    maxConcurrentSessions: number;
  };
  quotaUsage: {
    totalTokensToday: number;
    runningSessions: number;
  };
  byModel: CostSummaryByModelDto[];
  updatedAt: IsoDateString;
}

export type QuotaBlockReason = 'TOKEN_QUOTA_EXCEEDED' | 'CONCURRENT_SESSION_LIMIT';

export interface QuotaStatusDto {
  tenantId: string;
  allowed: boolean;
  reason: QuotaBlockReason | null;
  quota: {
    maxTokensPerDay: number;
    maxConcurrentSessions: number;
  };
  usage: {
    totalTokensToday: number;
    runningSessions: number;
  };
  remaining: {
    tokensToday: number;
    concurrentSessions: number;
  };
  message: string;
  updatedAt: IsoDateString;
}

export interface RunObservabilityDto {
  tenantId: string;
  runId: string;
  requestId: string;
  threadId: string;
  agentId: string;
  agentVersionId: string | null;
  status: RunStatus;
  model: string | null;
  durationMs: number | null;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  factCounts: {
    events: number;
    toolInvocations: number;
    artifacts: number;
    evidenceArtifacts: number;
    policyDecisions: number;
    auditEvents: number;
  };
  trace: {
    provider: 'internal' | 'langfuse' | 'unknown';
    traceId: string | null;
    traceUrl: string | null;
    message: string;
  };
  agentVersion: AgentVersionSummaryDto | null;
  updatedAt: IsoDateString;
}

export type HumanReviewStatus = 'pending' | 'approved' | 'rejected' | 'waived';
export type HumanReviewDecision = 'approve' | 'reject' | 'waive';

export interface HumanReviewDto {
  id: string;
  tenantId: string;
  runId: string | null;
  requestId: string | null;
  reviewType: string;
  status: HumanReviewStatus;
  subjectType: string;
  subjectId: string;
  title: string;
  reason: string;
  assignedTo: string | null;
  requestedBy: string | null;
  decidedBy: string | null;
  decision: HumanReviewDecision | null;
  decisionReason: string | null;
  decisionSummary: Record<string, unknown>;
  createdAt: IsoDateString;
  decidedAt: IsoDateString | null;
}

export interface CreateHumanReviewRequest {
  runId?: string | null;
  requestId?: string | null;
  reviewType: string;
  subjectType: string;
  subjectId: string;
  title: string;
  reason: string;
  assignedTo?: string | null;
  metadataSummary?: Record<string, unknown>;
}

export interface DecideHumanReviewRequest {
  decision: HumanReviewDecision;
  reason: string;
  decisionSummary?: Record<string, unknown>;
}

export interface AuditEventDto {
  id: number;
  tenantId: string;
  userId: string | null;
  requestId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  createdAt: IsoDateString;
}

export interface AgentVersionSnapshotSummaryDto {
  name: string;
  description: string | null;
  modelProvider: string | null;
  model: string | null;
  toolCount: number;
  skillCount: number;
  mcpServerCount: number;
}

export interface AgentVersionSummaryDto {
  id: string;
  tenantId: string;
  agentId: string;
  version: number;
  versionHash: string;
  createdBy: string | null;
  createdAt: IsoDateString;
  snapshotSummary: AgentVersionSnapshotSummaryDto;
}

export type PlatformFactListResponse<T> = ListResponse<T>;
export type RunListResponse = PlatformFactListResponse<RunDto>;
export interface RunDetailDto {
  run: RunDto;
  observability: RunObservabilityDto | null;
  events: RunEventListResponse;
  toolInvocations: ToolInvocationListResponse;
  artifacts: ArtifactListResponse;
  evidenceArtifacts: EvidenceArtifactListResponse;
  policyDecisions: PolicyDecisionListResponse;
  humanReviews: HumanReviewListResponse;
  auditEvents: AuditEventListResponse;
}
export type RunEventListResponse = PlatformFactListResponse<RunEventDto>;
export type ToolInvocationListResponse = PlatformFactListResponse<ToolInvocationDto>;
export type PolicyDecisionListResponse = PlatformFactListResponse<PolicyDecisionDto>;
export type ArtifactListResponse = PlatformFactListResponse<ArtifactDto>;
export type EvidenceArtifactListResponse = PlatformFactListResponse<EvidenceArtifactDto>;
export type HumanReviewListResponse = PlatformFactListResponse<HumanReviewDto>;
export type AuditEventListResponse = PlatformFactListResponse<AuditEventDto>;
export type AgentVersionListResponse = PlatformFactListResponse<AgentVersionSummaryDto>;
