import { API_BASE, getAuthHeaders, handleUnauthorized } from './client';

// === Types ===

export interface Skill {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  content: string | null;
  status: 'active' | 'draft';
  createdAt: string;
  updatedAt: string;
}

export interface ListSkillsResponse {
  data: Skill[];
  meta: {
    count: number;
    limit?: number;
    offset?: number;
  };
}

export interface AgentSkillReference {
  id: string;
  name: string;
  agentId: string;
}

export interface SkillAgentsResponse {
  data: AgentSkillReference[];
  meta: {
    count: number;
  };
}

// === Skill CRUD ===

export async function listSkills(filters?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ListSkillsResponse> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const qs = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(`${API_BASE}/skills${qs}`, {
    headers: getAuthHeaders(),
  });

  if (res.status === 401) {
    handleUnauthorized(res);
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(`listSkills failed: ${res.status}`);
  }

  return res.json();
}

export async function getSkill(id: string): Promise<Skill> {
  const res = await fetch(`${API_BASE}/skills/${id}`, {
    headers: getAuthHeaders(),
  });

  if (res.status === 401) {
    handleUnauthorized(res);
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(`getSkill failed: ${res.status}`);
  }

  return res.json();
}

export interface CreateSkillData {
  name: string;
  description?: string;
  content?: string;
  status?: 'active' | 'draft';
}

export async function createSkill(data: CreateSkillData): Promise<Skill> {
  const res = await fetch(`${API_BASE}/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });

  if (res.status === 401) {
    handleUnauthorized(res);
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `createSkill failed: ${res.status}`);
  }

  return res.json();
}

export interface UpdateSkillData {
  name?: string;
  description?: string;
  content?: string;
  status?: 'active' | 'draft';
}

export async function updateSkill(id: string, data: UpdateSkillData): Promise<Skill> {
  const res = await fetch(`${API_BASE}/skills/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });

  if (res.status === 401) {
    handleUnauthorized(res);
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `updateSkill failed: ${res.status}`);
  }

  return res.json();
}

export async function deleteSkill(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/skills/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (res.status === 401) {
    handleUnauthorized(res);
    throw new Error('Unauthorized');
  }

  if (res.status === 404) {
    throw new Error('Skill not found');
  }

  if (!res.ok) {
    throw new Error(`deleteSkill failed: ${res.status}`);
  }
}

// === Agent-Skill 关联 ===

export async function assignSkillToAgent(skillId: string, agentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/skills/${skillId}/agents/${agentId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (res.status === 401) {
    handleUnauthorized(res);
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(`assignSkillToAgent failed: ${res.status}`);
  }
}

export async function removeSkillFromAgent(skillId: string, agentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/skills/${skillId}/agents/${agentId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (res.status === 401) {
    handleUnauthorized(res);
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(`removeSkillFromAgent failed: ${res.status}`);
  }
}

export async function getSkillAgents(skillId: string): Promise<AgentSkillReference[]> {
  const res = await fetch(`${API_BASE}/skills/${skillId}/agents`, {
    headers: getAuthHeaders(),
  });

  if (res.status === 401) {
    handleUnauthorized(res);
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(`getSkillAgents failed: ${res.status}`);
  }

  const result: SkillAgentsResponse = await res.json();
  return result.data;
}
