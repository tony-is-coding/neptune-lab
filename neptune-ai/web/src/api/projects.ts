import type {
  CreateCustomerProjectRequest,
  CustomerProjectDto,
  CustomerProjectListResponse,
} from '@shared/neptune-ai';
import { API_BASE, getAuthHeaders, getJsonHeaders, handleUnauthorized, throwApiClientError } from './client';

function buildProjectQuery(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): string {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params?.offset !== undefined) searchParams.set('offset', String(params.offset));
  return searchParams.toString() ? `?${searchParams.toString()}` : '';
}

export async function listProjects(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<CustomerProjectListResponse> {
  const res = await fetch(`${API_BASE}/projects${buildProjectQuery(params)}`, {
    headers: getAuthHeaders(),
  });

  if (res.status === 401) handleUnauthorized(res);
  if (!res.ok) {
    await throwApiClientError(res, {
      error: res.status === 401 ? 'UNAUTHORIZED' : `PROJECTS_${res.status}`,
      message: res.status === 401 ? '登录已过期，请重新登录' : `客户项目加载失败：${res.status}`,
    });
  }

  return res.json();
}

export async function createProject(input: CreateCustomerProjectRequest): Promise<CustomerProjectDto> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify(input),
  });

  if (res.status === 401) handleUnauthorized(res);
  if (!res.ok) {
    await throwApiClientError(res, {
      error: res.status === 401 ? 'UNAUTHORIZED' : `PROJECT_CREATE_${res.status}`,
      message: res.status === 401 ? '登录已过期，请重新登录' : `客户项目创建失败：${res.status}`,
    });
  }

  return res.json();
}

export async function archiveProject(projectId: string): Promise<CustomerProjectDto> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/archive`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (res.status === 401) handleUnauthorized(res);
  if (!res.ok) {
    await throwApiClientError(res, {
      error: res.status === 401 ? 'UNAUTHORIZED' : `PROJECT_ARCHIVE_${res.status}`,
      message: res.status === 401 ? '登录已过期，请重新登录' : `客户项目归档失败：${res.status}`,
    });
  }

  return res.json();
}
