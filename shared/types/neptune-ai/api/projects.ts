import type {IsoDateString, ListResponse} from './common';

export type CustomerProjectStatus = 'active' | 'archived';

export interface CustomerProjectDto {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: CustomerProjectStatus;
  environment: string;
  solutionPack: string | null;
  createdBy: string | null;
  archivedAt: IsoDateString | null;
  metadataSummary: Record<string, unknown>;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CreateCustomerProjectRequest {
  name: string;
  description?: string | null;
  environment?: string;
  solutionPack?: string | null;
  metadataSummary?: Record<string, unknown>;
}

export interface UpdateCustomerProjectRequest {
  name?: string;
  description?: string | null;
  environment?: string;
  solutionPack?: string | null;
  metadataSummary?: Record<string, unknown>;
}

export type CustomerProjectListResponse = ListResponse<CustomerProjectDto>;
