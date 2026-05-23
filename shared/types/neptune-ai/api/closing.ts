import type {IsoDateString, ListResponse} from './common';
import type {ArtifactDto, AuditEventDto, EvidenceArtifactDto, HumanReviewDto, RunDto} from './platform-facts';

export type CloseWorkspaceStatus = 'active' | 'archived';
export type AccountingPeriodStatus = 'draft' | 'open' | 'locked' | 'checking' | 'review_pending' | 'approved' | 'closed';
export type ChecklistSeverity = 'info' | 'warning' | 'blocking';
export type ChecklistStatus = 'pending' | 'running' | 'passed' | 'failed' | 'review_pending' | 'waived';
export type FindingSeverity = 'warning' | 'blocking';
export type FindingStatus = 'open' | 'acknowledged' | 'resolved' | 'review_pending' | 'approved' | 'rejected' | 'waived';
export type CloseReportStatus = 'draft' | 'generated' | 'exported';

export interface CloseWorkspaceDto {
  id: string;
  tenantId: string;
  name: string;
  scope: Record<string, unknown>;
  status: CloseWorkspaceStatus;
  createdBy: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString | null;
}

export interface AccountingPeriodDto {
  id: string;
  tenantId: string;
  workspaceId: string;
  periodKey: string;
  startsAt: IsoDateString;
  endsAt: IsoDateString;
  status: AccountingPeriodStatus;
  lockedBy: string | null;
  lockedAt: IsoDateString | null;
  metadataSummary: Record<string, unknown>;
  createdAt: IsoDateString;
  updatedAt: IsoDateString | null;
}

export interface ChecklistItemDto {
  id: string;
  tenantId: string;
  workspaceId: string;
  periodId: string;
  code: string;
  title: string;
  description: string | null;
  severity: ChecklistSeverity;
  status: ChecklistStatus;
  runId: string | null;
  ownerUserId: string | null;
  reviewerUserId: string | null;
  metadataSummary: Record<string, unknown>;
  createdAt: IsoDateString;
  updatedAt: IsoDateString | null;
}

export interface FindingDto {
  id: string;
  tenantId: string;
  workspaceId: string;
  periodId: string;
  checklistItemId: string;
  runId: string | null;
  title: string;
  summary: string;
  severity: FindingSeverity;
  status: FindingStatus;
  assigneeId: string | null;
  evidenceArtifactIds: string[];
  evidenceCount: number;
  humanReviewId: string | null;
  reviewStatus: string | null;
  decisionReason: string | null;
  metadataSummary: Record<string, unknown>;
  createdAt: IsoDateString;
  updatedAt: IsoDateString | null;
}

export interface CloseReportDto {
  id: string;
  tenantId: string;
  workspaceId: string;
  periodId: string;
  status: CloseReportStatus;
  title: string;
  summary: Record<string, unknown>;
  snapshot: Record<string, unknown>;
  snapshotHash: string;
  runIds: string[];
  evidenceArtifactIds: string[];
  findingIds: string[];
  humanReviewIds: string[];
  auditEventIds: number[];
  artifactId: string | null;
  generatedBy: string | null;
  generatedAt: IsoDateString;
  createdAt: IsoDateString;
}

export interface CreateCloseWorkspaceRequest {
  name: string;
  scope?: Record<string, unknown>;
  period: {
    periodKey: string;
    startsAt: IsoDateString;
    endsAt: IsoDateString;
  };
}

export interface CreateCloseWorkspaceResponse {
  workspace: CloseWorkspaceDto;
  currentPeriod: AccountingPeriodDto;
}

export interface CloseWorkspaceOverviewResponse {
  workspace: CloseWorkspaceDto;
  currentPeriod: AccountingPeriodDto | null;
  checklistSummary: {
    total: number;
    passed: number;
    failed: number;
    blocking: number;
    reviewPending: number;
  };
  findingSummary: {
    open: number;
    resolved: number;
    waived: number;
    blocking: number;
  };
  latestReport: CloseReportDto | null;
}

export interface GenerateCloseChecksRequest {
  periodId: string;
  mockDataset?: string;
}

export interface GenerateCloseChecksResponse {
  summary: {
    totalChecks: number;
    passedCount: number;
    findingCount: number;
    evidenceCount: number;
  };
  checklistItems: ChecklistItemDto[];
  findings: FindingDto[];
}

export interface ImportCloseCsvEvidenceRequest {
  periodId: string;
  fileName: string;
  content: string;
  sourceSystem?: string;
  ledgerName?: string;
  accountSet?: string;
  findingId?: string;
}

export interface ImportCloseCsvEvidenceFormFields {
  periodId: string;
  sourceSystem?: string;
  ledgerName?: string;
  accountSet?: string;
  findingId?: string;
}

export interface ImportCloseCsvEvidenceResponse {
  artifact: ArtifactDto;
  evidence: EvidenceArtifactDto;
  linkedFindings: FindingDto[];
  summary: {
    rowCount: number;
    columnCount: number;
    schemaStatus: 'valid';
    linkedFindingCount: number;
  };
}

export interface SubmitFindingReviewRequest {
  reason: string;
}

export interface SubmitFindingReviewResponse {
  finding: FindingDto;
  review: HumanReviewDto;
}

export interface DecideCloseReviewRequest {
  reason: string;
}

export interface DecideCloseReviewResponse {
  finding: FindingDto;
  review: HumanReviewDto;
}

export interface GenerateCloseReportRequest {
  periodId: string;
}

export interface CloseReportDetailResponse {
  report: CloseReportDto;
  facts: {
    runs: RunDto[];
    evidenceArtifacts: EvidenceArtifactDto[];
    findings: FindingDto[];
    humanReviews: HumanReviewDto[];
    auditEvents: AuditEventDto[];
  };
}

export type CloseWorkflowTimelineKind =
  | 'workspace_created'
  | 'period_transition'
  | 'check_run'
  | 'artifact'
  | 'evidence'
  | 'finding'
  | 'review'
  | 'report'
  | 'quota'
  | 'other';

export interface CloseWorkflowTimelineItemDto {
  id: string;
  tenantId: string;
  workspaceId: string;
  periodId: string | null;
  auditEventId: number;
  kind: CloseWorkflowTimelineKind;
  title: string;
  summary: string;
  status: string;
  resourceType: string;
  resourceId: string;
  actorUserId: string | null;
  requestId: string | null;
  occurredAt: IsoDateString;
  metadataSummary: Record<string, unknown>;
}

export interface CloseWorkflowTimelineResponse extends ListResponse<CloseWorkflowTimelineItemDto> {
  workspace: CloseWorkspaceDto;
  period: AccountingPeriodDto;
}

export type CloseWorkspaceListResponse = ListResponse<CloseWorkspaceDto>;
export type ChecklistItemListResponse = ListResponse<ChecklistItemDto>;
export type FindingListResponse = ListResponse<FindingDto>;
export type CloseEvidenceArtifactListResponse = ListResponse<EvidenceArtifactDto>;
export type CloseReportListResponse = ListResponse<CloseReportDto>;
