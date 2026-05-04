import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  AgentListResponse,
  AgentTemplate,
  ChatHistoryResponse,
  UserListResponse,
  AdminUser,
  CreateUserRequest,
  UpdateUserRequest,
  BillingResponse,
  AgentStats,
  AgentDocument,
} from '../types';
import { getStoredToken } from '../stores/auth';

/**
 * API 错误
 */
export interface APIError {
  error: string;
  message: string;
}

/**
 * API 客户端类
 */
export class APIClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:3000/api/v1') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 请求拦截器：从 zustand persist store 读取 token
    this.client.interceptors.request.use(
      (config) => {
        const token = getStoredToken();
        console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, token ? '(with token)' : '(no token)');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 响应拦截器：处理 401
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[API] ${response.status} ${response.config.url}`);
        return response;
      },
      (error: AxiosError<APIError>) => {
        console.error(`[API] Error:`, error.message, error.response?.status, error.response?.data);
        if (error.response?.status === 401) {
          // 清除 zustand persist store 并跳转登录
          console.warn('[API] 401 — clearing auth and redirecting to login');
          localStorage.removeItem('neptune-auth');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * 登录
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/login', data);
    return response.data;
  }

  /**
   * 注册
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/register', data);
    return response.data;
  }

  /**
   * 获取 Agent 列表
   */
  async getAgents(active?: boolean): Promise<AgentListResponse> {
    const params = active !== undefined ? { active: active.toString() } : {};
    const response = await this.client.get<AgentListResponse>('/agents', { params });
    return response.data;
  }

  /**
   * 获取 Agent 详情
   */
  async getAgent(id: string): Promise<AgentTemplate> {
    const response = await this.client.get<AgentTemplate>(`/agents/${id}`);
    return response.data;
  }

  /**
   * 创建 Agent 模板
   */
  async createAgent(data: Partial<AgentTemplate>): Promise<AgentTemplate> {
    const response = await this.client.post<AgentTemplate>('/agents', data);
    return response.data;
  }

  /**
   * 更新 Agent 模板
   */
  async updateAgent(id: string, data: Partial<AgentTemplate>): Promise<AgentTemplate> {
    const response = await this.client.put<AgentTemplate>(`/agents/${id}`, data);
    return response.data;
  }

  /**
   * 激活 Agent
   */
  async activateAgent(id: string): Promise<AgentTemplate> {
    const response = await this.client.patch<AgentTemplate>(`/agents/${id}/activate`);
    return response.data;
  }

  /**
   * 停用 Agent
   */
  async deactivateAgent(id: string): Promise<AgentTemplate> {
    const response = await this.client.patch<AgentTemplate>(`/agents/${id}/deactivate`);
    return response.data;
  }

  /**
   * 删除 Agent
   */
  async deleteAgent(id: string): Promise<void> {
    await this.client.delete(`/agents/${id}`);
  }

  /**
   * 获取对话历史
   */
  async getChatHistory(agentId: string, limit: number = 50): Promise<ChatHistoryResponse> {
    const response = await this.client.get<ChatHistoryResponse>(`/agents/${agentId}/history`, {
      params: { limit: limit.toString() },
    });
    return response.data;
  }

  /**
   * 发送聊天消息（返回 SSE URL）
   */
  getChatURL(agentId: string): string {
    return `${this.baseURL}/agents/${agentId}/chat`;
  }

  /**
   * 获取用户列表
   */
  async getUsers(limit: number = 100, offset: number = 0): Promise<UserListResponse> {
    const response = await this.client.get<UserListResponse>('/users', {
      params: { limit: limit.toString(), offset: offset.toString() },
    });
    return response.data;
  }

  /**
   * 获取用户详情
   */
  async getUser(id: string): Promise<AdminUser> {
    const response = await this.client.get<AdminUser>(`/users/${id}`);
    return response.data;
  }

  /**
   * 创建用户
   */
  async createUser(data: CreateUserRequest): Promise<AdminUser> {
    const response = await this.client.post<AdminUser>('/users', data);
    return response.data;
  }

  /**
   * 更新用户
   */
  async updateUser(id: string, data: UpdateUserRequest): Promise<AdminUser> {
    const response = await this.client.put<AdminUser>(`/users/${id}`, data);
    return response.data;
  }

  /**
   * 删除用户
   */
  async deleteUser(id: string): Promise<void> {
    await this.client.delete(`/users/${id}`);
  }

  /**
   * 获取计费信息
   */
  async getBilling(tenantId: string): Promise<BillingResponse> {
    const response = await this.client.get<BillingResponse>(`/tenants/${tenantId}/billing`);
    return response.data;
  }

  /**
   * 获取 Agent 统计数据
   */
  async getAgentStats(id: string): Promise<AgentStats> {
    const response = await this.client.get<AgentStats>(`/agents/${id}/stats`);
    return response.data;
  }

  /**
   * 上传文档到 Agent
   */
  async uploadDocument(agentId: string, file: { name: string; type: string; size: number; content: string }): Promise<AgentDocument> {
    const response = await this.client.post<AgentDocument>(`/agents/${agentId}/documents`, file);
    return response.data;
  }

  /**
   * 获取 Agent 文档列表
   */
  async getDocuments(agentId: string): Promise<{ data: AgentDocument[] }> {
    const response = await this.client.get<{ data: AgentDocument[] }>(`/agents/${agentId}/documents`);
    return response.data;
  }

  /**
   * 删除 Agent 文档
   */
  async deleteDocument(agentId: string, docId: string): Promise<void> {
    await this.client.delete(`/agents/${agentId}/documents/${docId}`);
  }
}

// 导出单例
export const apiClient = new APIClient();
