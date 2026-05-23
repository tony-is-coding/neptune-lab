import type {
  ChecklistItemDto,
  ChecklistItemListResponse,
  CloseReportDto,
  CloseReportDetailResponse,
  CloseReportListResponse,
  CloseEvidenceArtifactListResponse,
  CloseWorkspaceDto,
  CloseWorkspaceListResponse,
  CloseWorkspaceOverviewResponse,
  CreateCloseWorkspaceRequest,
  CreateCloseWorkspaceResponse,
  DecideCloseReviewRequest,
  DecideCloseReviewResponse,
  EvidenceArtifactDto,
  FindingDto,
  FindingListResponse,
  GenerateCloseChecksRequest,
  GenerateCloseChecksResponse,
  GenerateCloseReportRequest,
  ImportCloseCsvEvidenceFormFields,
  ImportCloseCsvEvidenceRequest,
  ImportCloseCsvEvidenceResponse,
  SubmitFindingReviewRequest,
  SubmitFindingReviewResponse,
} from '@shared/neptune-ai';
import {API_BASE, getAuthHeaders, handleUnauthorized} from './client';

export type CloseWorkspace = CloseWorkspaceDto;
export type AccountingPeriod = CreateCloseWorkspaceResponse['currentPeriod'];
export type CloseChecklistItem = ChecklistItemDto;
export type CloseFinding = FindingDto;
export type CloseReport = CloseReportDto;
export type CloseReportDetail = CloseReportDetailResponse;
export type CloseEvidenceArtifact = EvidenceArtifactDto;
export type ImportCloseCsvEvidenceInput = ImportCloseCsvEvidenceFormFields & {file: File};

async function getClosing<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const searchParams = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, String(value));
  });
  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';

  const res = await fetch(`${API_BASE}/closing${path}${qs}`, {
    headers: getAuthHeaders(),
  });

  if (res.status === 401) {
    handleUnauthorized(res);
    throw new Error('Unauthorized');
  }

  if (!res.ok) throw new Error(`closing API failed: ${res.status}`);
  return res.json();
}

async function mutateClosing<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/closing${path}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...getAuthHeaders()},
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    handleUnauthorized(res);
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    let message = `closing mutation failed: ${res.status}`;
    try {
      const payload = await res.json();
      if (typeof payload?.message === 'string') message = payload.message;
    } catch {
      // keep fallback message
    }
    throw new Error(message);
  }

  return res.json();
}

async function mutateClosingFormData<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}/closing${path}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body,
  });

  if (res.status === 401) {
    handleUnauthorized(res);
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    let message = `closing mutation failed: ${res.status}`;
    try {
      const payload = await res.json();
      if (typeof payload?.message === 'string') message = payload.message;
    } catch {
      // keep fallback message
    }
    throw new Error(message);
  }

  return res.json();
}

export function listCloseWorkspaces(params?: {limit?: number; offset?: number}): Promise<CloseWorkspaceListResponse> {
  return getClosing('/workspaces', params);
}

export function createCloseWorkspace(input: CreateCloseWorkspaceRequest): Promise<CreateCloseWorkspaceResponse> {
  return mutateClosing('/workspaces', input);
}

export function getCloseOverview(workspaceId: string): Promise<CloseWorkspaceOverviewResponse> {
  return getClosing(`/workspaces/${workspaceId}/overview`);
}

export function listCloseChecklist(workspaceId: string): Promise<ChecklistItemListResponse> {
  return getClosing(`/workspaces/${workspaceId}/checklist`);
}

export function listCloseFindings(workspaceId: string): Promise<FindingListResponse> {
  return getClosing(`/workspaces/${workspaceId}/findings`);
}

export function listCloseReports(workspaceId: string): Promise<CloseReportListResponse> {
  return getClosing(`/workspaces/${workspaceId}/report-snapshots`);
}

export function listCloseEvidenceArtifacts(workspaceId: string): Promise<CloseEvidenceArtifactListResponse> {
  return getClosing(`/workspaces/${workspaceId}/evidence-artifacts`, {limit: 100});
}

export function getCloseReportDetail(reportId: string): Promise<CloseReportDetailResponse> {
  return getClosing(`/report-snapshots/${reportId}`);
}

export function generateCloseChecks(
  workspaceId: string,
  input: GenerateCloseChecksRequest,
): Promise<GenerateCloseChecksResponse> {
  return mutateClosing(`/workspaces/${workspaceId}/checks:generate`, input);
}

export function submitFindingReview(
  findingId: string,
  input: SubmitFindingReviewRequest,
): Promise<SubmitFindingReviewResponse> {
  return mutateClosing(`/findings/${findingId}/submit-review`, input);
}

export function decideCloseReview(
  reviewId: string,
  decision: 'approve' | 'reject' | 'waive',
  input: DecideCloseReviewRequest,
): Promise<DecideCloseReviewResponse> {
  return mutateClosing(`/reviews/${reviewId}/${decision}`, input);
}

export function generateCloseReport(
  workspaceId: string,
  input: GenerateCloseReportRequest,
): Promise<CloseReportDto> {
  return mutateClosing(`/workspaces/${workspaceId}/report-snapshots`, input);
}

export function importCloseCsvEvidence(
  workspaceId: string,
  input: ImportCloseCsvEvidenceRequest | ImportCloseCsvEvidenceInput,
): Promise<ImportCloseCsvEvidenceResponse> {
  if ('file' in input) {
    const formData = new FormData();
    formData.append('file', input.file);
    formData.append('periodId', input.periodId);
    if (input.sourceSystem) formData.append('sourceSystem', input.sourceSystem);
    if (input.ledgerName) formData.append('ledgerName', input.ledgerName);
    if (input.accountSet) formData.append('accountSet', input.accountSet);
    if (input.findingId) formData.append('findingId', input.findingId);

    return mutateClosingFormData(`/workspaces/${workspaceId}/evidence-imports:csv`, formData);
  }

  return mutateClosing(`/workspaces/${workspaceId}/evidence-imports:csv`, input);
}
