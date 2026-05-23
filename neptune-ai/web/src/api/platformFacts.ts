import type {
  AgentVersionListResponse,
  AgentVersionSummaryDto,
  ArtifactDto,
  ArtifactListResponse,
  AuditEventDto,
  AuditEventListResponse,
  CostSummaryDto,
  CostSummaryPeriod,
  CreateHumanReviewRequest,
  DecideHumanReviewRequest,
  EvidenceArtifactDto,
  EvidenceArtifactListResponse,
  HumanReviewDto,
  HumanReviewListResponse,
  HumanReviewStatus,
  IsoDateString,
  PolicyDecisionDto,
  PolicyDecisionListResponse,
  QuotaStatusDto,
  RunObservabilityDto,
  RunEventDto,
  RunEventListResponse,
  RunDto,
  RunListResponse,
  ToolInvocationDto,
  ToolInvocationListResponse,
} from '@shared/neptune-ai';
import {API_BASE, getAuthHeaders, handleUnauthorized, throwApiClientError} from './client';

export type PlatformRun = RunDto;
export type PlatformRunEvent = RunEventDto;
export type PlatformToolInvocation = ToolInvocationDto;
export type PlatformPolicyDecision = PolicyDecisionDto;
export type PlatformArtifact = ArtifactDto;
export type PlatformEvidenceArtifact = EvidenceArtifactDto;
export type PlatformCostSummary = CostSummaryDto;
export type PlatformQuotaStatus = QuotaStatusDto;
export type PlatformRunObservability = RunObservabilityDto;
export type PlatformHumanReview = HumanReviewDto;
export type PlatformAuditEvent = AuditEventDto;
export type AgentTemplateVersion = AgentVersionSummaryDto;
export type ListPlatformRunsResponse = RunListResponse;
export type ListRunEventsResponse = RunEventListResponse;
export type ListToolInvocationsResponse = ToolInvocationListResponse;
export type ListPolicyDecisionsResponse = PolicyDecisionListResponse;
export type ListArtifactsResponse = ArtifactListResponse;
export type ListEvidenceArtifactsResponse = EvidenceArtifactListResponse;
export type ListHumanReviewsResponse = HumanReviewListResponse;
export type ListAuditEventsResponse = AuditEventListResponse;
export type ListAgentVersionsResponse = AgentVersionListResponse;

export interface ListAuditEventsParams {
  action?: string;
  resourceType?: string;
  resourceId?: string;
  outcome?: string;
  limit?: number;
  offset?: number;
}

export interface AuditEventsCsvExport {
  filename: string;
  blob: Blob;
}

async function getPlatformFact<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const searchParams = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, String(value));
  });
  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';

  const res = await fetch(`${API_BASE}/platform-facts${path}${qs}`, {
    headers: getAuthHeaders(),
  });

  if (res.status === 401) {
    handleUnauthorized(res);
  }

  if (!res.ok) {
    await throwApiClientError(res, {
      error: res.status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR',
      message: res.status === 401 ? '登录已过期，请重新登录' : `平台事实加载失败：${res.status}`,
    });
  }

  return res.json();
}

async function mutatePlatformFact<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/platform-facts${path}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...getAuthHeaders()},
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    handleUnauthorized(res);
  }

  if (!res.ok) {
    await throwApiClientError(res, {
      error: res.status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR',
      message: res.status === 401 ? '登录已过期，请重新登录' : `平台事实写入失败：${res.status}`,
    });
  }

  return res.json();
}

export function listPlatformRuns(params?: {
  agentId?: string;
  threadId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ListPlatformRunsResponse> {
  return getPlatformFact('/runs', params);
}

export function listRunEvents(
  runId: string,
  params?: {limit?: number; offset?: number},
): Promise<ListRunEventsResponse> {
  return getPlatformFact(`/runs/${runId}/events`, params);
}

export function listToolInvocations(
  runId: string,
  params?: {limit?: number; offset?: number},
): Promise<ListToolInvocationsResponse> {
  return getPlatformFact(`/runs/${runId}/tool-invocations`, params);
}

export function listRunArtifacts(
  runId: string,
  params?: {artifactType?: string; sourceType?: string; limit?: number; offset?: number},
): Promise<ListArtifactsResponse> {
  return getPlatformFact(`/runs/${runId}/artifacts`, params);
}

export function listRunEvidenceArtifacts(
  runId: string,
  params?: {evidenceType?: string; limit?: number; offset?: number},
): Promise<ListEvidenceArtifactsResponse> {
  return getPlatformFact(`/runs/${runId}/evidence-artifacts`, params);
}

export function listPolicyDecisions(params?: {
  runId?: string;
  decision?: string;
  policyType?: string;
  subjectType?: string;
  limit?: number;
  offset?: number;
}): Promise<ListPolicyDecisionsResponse> {
  return getPlatformFact('/policy-decisions', params);
}

export function listHumanReviews(params?: {
  runId?: string;
  status?: HumanReviewStatus;
  reviewType?: string;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}): Promise<ListHumanReviewsResponse> {
  return getPlatformFact('/human-reviews', params);
}

export function createHumanReview(input: CreateHumanReviewRequest): Promise<PlatformHumanReview> {
  return mutatePlatformFact('/human-reviews', input);
}

export function decideHumanReview(reviewId: string, input: DecideHumanReviewRequest): Promise<PlatformHumanReview> {
  return mutatePlatformFact(`/human-reviews/${reviewId}/decision`, input);
}

export function listAuditEvents(params?: ListAuditEventsParams): Promise<ListAuditEventsResponse> {
  return getPlatformFact('/audit-events', params ? {...params} : undefined);
}

export async function exportAuditEventsCsv(params?: Omit<ListAuditEventsParams, 'limit' | 'offset'>): Promise<AuditEventsCsvExport> {
  const searchParams = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') searchParams.set(key, String(value));
  });
  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';

  const res = await fetch(`${API_BASE}/platform-facts/audit-events/export${qs}`, {
    headers: getAuthHeaders(),
  });

  if (res.status === 401) {
    handleUnauthorized(res);
  }

  if (!res.ok) {
    await throwApiClientError(res, {
      error: res.status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR',
      message: res.status === 401 ? '登录已过期，请重新登录' : `审计事件导出失败：${res.status}`,
    });
  }

  const disposition = res.headers.get('content-disposition') ?? '';
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
  return {
    filename: filenameMatch?.[1] ?? `neptune-audit-events-${new Date().toISOString().slice(0, 10)}.csv`,
    blob: await res.blob(),
  };
}

export function listAgentVersions(
  agentId: string,
  params?: {limit?: number; offset?: number},
): Promise<ListAgentVersionsResponse> {
  return getPlatformFact(`/agents/${agentId}/versions`, params);
}

export function getCostSummary(period: CostSummaryPeriod = 'today'): Promise<PlatformCostSummary> {
  return getPlatformFact('/cost-summary', {period});
}

export function getQuotaStatus(): Promise<PlatformQuotaStatus> {
  return getPlatformFact('/quota/status');
}

export function getRunObservability(runId: string): Promise<PlatformRunObservability> {
  return getPlatformFact(`/runs/${runId}/observability`);
}
