import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  timestamp,
  bigserial,
  integer,
  index,
} from 'drizzle-orm/pg-core';

/**
 * 租户表
 * 存储租户信息、配额、计费配置
 */
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  quota: jsonb('quota').$type<{
    maxTokensPerDay: number;
    maxConcurrentSessions: number;
  }>().default({ maxTokensPerDay: 1000000, maxConcurrentSessions: 10 }),
  billingConfig: jsonb('billing_config').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * 用户表
 * 存储用户信息、角色、所属租户
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'), // 'admin' | 'user'
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  tenantIdx: index('users_tenant_id_idx').on(table.tenantId),
}));

/**
 * Agent 模板表
 * 存储 Agent 模板配置（systemPrompt/tools/skills/MCP）
 */
export const agentTemplates = pgTable('agent_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  description: text('description'),
  systemPrompt: text('system_prompt').notNull(),
  modelConfig: jsonb('model_config').$type<{
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
  }>().notNull(),
  tools: jsonb('tools').$type<string[]>().default([]),
  skills: jsonb('skills').$type<Array<{
    id: string;
    name: string;
    version?: string;
  }>>().default([]),
  mcpServers: jsonb('mcp_servers').$type<Array<{
    name: string;
    url: string;
    authConfig?: Record<string, unknown>;
  }>>().default([]),
  constraints: jsonb('constraints').$type<{
    maxTokensPerTurn: number;
    maxTurnsPerSession: number;
    maxConcurrentSessions: number;
  }>(),
  version: integer('version').default(1),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  tenantActiveIdx: index('agent_templates_tenant_active_idx').on(table.tenantId, table.isActive),
}));

/**
 * Session 表
 * 存储 Session 元数据（状态/归属）
 */
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // Session ID（text 类型，与 SDK SessionId 一致）
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  templateId: uuid('template_id').references(() => agentTemplates.id),
  status: text('status').notNull().default('active'), // 'created' | 'running' | 'paused' | 'terminated' | 'error'
  workspace: text('workspace').notNull(), // 租户隔离的工作目录
  lastActiveAt: timestamp('last_active_at'), // 最后活跃时间
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  tenantStatusIdx: index('sessions_tenant_status_idx').on(table.tenantId, table.status),
  userIdx: index('sessions_user_id_idx').on(table.userId),
}));

/**
 * 计费记录表
 * 存储 token 使用和费用记录
 */
export const billingRecords = pgTable('billing_records', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  sessionId: text('session_id'), // Session ID（text 类型，与 sessions.id 一致）
  userId: uuid('user_id').references(() => users.id),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  model: text('model'),
  costCents: integer('cost_cents'), // 费用（分）
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  tenantIdx: index('billing_records_tenant_id_idx').on(table.tenantId),
  sessionIdx: index('billing_records_session_id_idx').on(table.sessionId),
}));

/**
 * 文档表
 * 存储 Agent 上传的文档/记忆文件
 */
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull().references(() => agentTemplates.id),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'PDF', 'CSV', 'Markdown', 'JSON'
  size: integer('size').notNull().default(0),
  path: text('path').notNull(), // 文件系统路径
  uploadedAt: timestamp('uploaded_at').defaultNow(),
}, (table) => ({
  templateIdx: index('documents_template_id_idx').on(table.templateId),
}));

// 类型导出
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type AgentTemplate = typeof agentTemplates.$inferSelect;
export type NewAgentTemplate = typeof agentTemplates.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type BillingRecord = typeof billingRecords.$inferSelect;
export type NewBillingRecord = typeof billingRecords.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
