export type IsoDateString = string;

export interface PaginationMeta {
  count: number;
  limit: number;
  offset: number;
  include?: string;
}

export interface ApiErrorEnvelope {
  error: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

export interface ListResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
