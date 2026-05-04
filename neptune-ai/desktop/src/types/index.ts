/**
 * 用户角色
 */
export type UserRole = 'admin' | 'user';

/**
 * 用户信息 — 前端内部使用，从 AuthResponse.user 转换而来
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

/**
 * 登录请求
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * 注册请求
 */
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  tenantSlug?: string;
}

/**
 * 认证响应 — 对齐后端 authRoutes 返回结构
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Agent 模板
 */
export interface AgentTemplate {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  modelConfig: {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  tools: string[];
  skills: Array<{ id: string; name: string; version?: string }>;
  mcpServers: Array<{ name: string; url: string; authConfig?: Record<string, unknown> }>;
  constraints: {
    maxTokensPerTurn: number;
    maxTurnsPerSession: number;
    maxConcurrentSessions: number;
  };
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Agent 列表响应
 */
export interface AgentListResponse {
  data: AgentTemplate[];
  meta: {
    count: number;
    limit: number;
    offset: number;
  };
}

/**
 * 聊天消息类型
 */
export type MessageType = 'text' | 'tool_use' | 'tool_result' | 'error';

/**
 * 聊天消息
 */
export interface ChatMessage {
  type: MessageType;
  content?: string;
  name?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}

/**
 * SSE 事件
 */
export interface SSEEvent {
  type: 'message' | 'done' | 'error';
  data: ChatMessage | { usage: Record<string, unknown> } | { error: string };
}

/**
 * 对话历史响应
 */
export interface ChatHistoryResponse {
  data: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  meta: {
    agentId: string;
    limit: number;
  };
}

/**
 * 管理员用户信息（不含密码）
 */
export interface AdminUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

/**
 * 用户列表响应
 */
export interface UserListResponse {
  data: AdminUser[];
  meta: {
    count: number;
    limit: number;
    offset: number;
  };
}

/**
 * 创建用户请求
 */
export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

/**
 * 更新用户请求
 */
export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
}

/**
 * Token 使用记录
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  costUSD: number;
}

/**
 * 计费响应
 */
export interface BillingResponse {
  tenantId: string;
  database: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUSD: number;
    recordCount: number;
  };
  realtime: {
    [key: string]: number;
  };
}

/**
 * Agent 统计数据
 */
export interface AgentStats {
  mtdCost: number;
  budgetLimit: number;
  thirtyDaySessions: number;
  avgLatency: number;
  activeSessions: number;
}

/**
 * Agent 文档
 */
export interface AgentDocument {
  id: string;
  templateId: string;
  tenantId: string;
  name: string;
  type: string;
  size: number;
  path: string;
  uploadedAt: string;
}
