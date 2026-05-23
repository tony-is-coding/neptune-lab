import type {CreateRunRequest, RetryRunRequest, RunDetailDto, RunDto} from '@shared/neptune-ai';
import {API_BASE, getJsonHeaders, handleUnauthorized, throwApiClientError} from './client';

async function runRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/runs${path}`, {
    ...options,
    headers: {
      ...(options.body ? getJsonHeaders() : getJsonHeaders()),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    handleUnauthorized(res);
  }

  if (!res.ok) {
    await throwApiClientError(res, {
      error: res.status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR',
      message: res.status === 401 ? '登录已过期，请重新登录' : `运行控制请求失败：${res.status}`,
    });
  }

  return res.json();
}

export function createRun(input: CreateRunRequest): Promise<RunDto> {
  return runRequest('', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getRunDetail(runId: string): Promise<RunDetailDto> {
  return runRequest(`/${runId}`);
}

export function cancelRun(runId: string): Promise<RunDto> {
  return runRequest(`/${runId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function retryRun(runId: string, input: RetryRunRequest): Promise<RunDto> {
  return runRequest(`/${runId}/retry`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
