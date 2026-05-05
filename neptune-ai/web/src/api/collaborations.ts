import type { Thread, AgentTemplate } from '../types/chat';
import { API_BASE, getAuthHeaders, handleUnauthorized } from './client';

export interface RecentCollaboration {
  thread: Thread;
  agent: {
    id: string;
    name: string;
    icon: string;
    description: string | null;
  };
}

export interface RecentCollaborationsResponse {
  data: RecentCollaboration[];
  meta: {
    count: number;
  };
}

export async function getRecentCollaborations(limit?: number): Promise<RecentCollaborationsResponse> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  const qs = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(`${API_BASE}/collaborations/recent${qs}`, {
    headers: getAuthHeaders(),
  });

  if (res.status === 401) {
    handleUnauthorized(res);
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(`getRecentCollaborations failed: ${res.status}`);
  }

  return res.json();
}
