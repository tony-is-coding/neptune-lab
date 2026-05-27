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
    }>().default({maxTokensPerDay: 1000000, maxConcurrentSessions: 10}),
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
 * 客户项目表
 * CustomerProject 是交付、治理、方案包和受控运行的业务归属入口
 */
export const customerProjects = pgTable('customer_projects', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('active'),
    environment: text('environment').notNull().default('sandbox'),
    solutionPack: text('solution_pack'),
    createdBy: uuid('created_by').references(() => users.id),
    archivedAt: timestamp('archived_at'),
    metadataSummary: jsonb('metadata_summary').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    tenantStatusIdx: index('customer_projects_tenant_status_idx').on(table.tenantId, table.status),
    tenantCreatedIdx: index('customer_projects_tenant_created_idx').on(table.tenantId, table.createdAt),
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
    icon: text('icon').default('smart_toy'),
    systemPrompt: text('system_prompt').notNull(),
    /**
     * Prompt Config — 模块化 System Prompt 配置（Phase 2）
     *
     * 如果存在，使用模块化组装；否则回退到 system_prompt
     *
     * 结构：
     * - identity: Agent 身份描述（岗位名称、职责、能力边界）
     * - inlineSkills: 内联技能定义（可选，优先于 skills 表关联）
     * - knowledgeConfig: 知识库配置（可选）
     * - toolInstructions: 工具约束覆盖（可选，默认自动生成）
     * - disableGuard: 是否禁用平台 Guard（仅管理员可操作，默认 false）
     */
    promptConfig: jsonb('prompt_config').$type<{
        // Block 2: Agent 身份（必填）
        identity: string;

        // Block 3: 内联技能定义（可选，优先于 skills 表关联）
        inlineSkills?: Array<{
            name: string;
            content: string;
        }>;

        // Block 4: 知识库配置（可选）
        knowledgeConfig?: {
            maxDocuments: number;       // 最多注入多少文档
            maxTokensPerDoc: number;    // 每文档最大 token
            summaryMode: 'full' | 'summary' | 'keywords';  // 注入模式
        };

        // Block 5: 工具约束覆盖（可选，默认自动生成）
        toolInstructions?: string;

        // 是否禁用平台 Guard（仅管理员可操作，默认 false）
        disableGuard?: boolean;
    }>(),
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
 * Agent 模板版本表
 * 存储每次生产执行所绑定的不可变 Agent 配置快照
 */
export const agentTemplateVersions = pgTable('agent_template_versions', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    agentId: uuid('agent_id').notNull().references(() => agentTemplates.id, {onDelete: 'cascade'}),
    version: integer('version').notNull(),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    agentVersionIdx: index('agent_template_versions_agent_version_idx').on(table.agentId, table.version),
    tenantIdx: index('agent_template_versions_tenant_id_idx').on(table.tenantId),
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
    status: text('status').notNull().default('created'), // 'created' | 'running' | 'idle' | 'completed' | 'error'
    title: text('title'),
    summary: text('summary'),
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
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    sessionId: text('session_id'), // Session ID（text 类型，与 sessions.id 一致）
    /** 关联的受控运行（Run）；老数据可能为 null，新写入应当带上以便 Run 级成本归因 */
    runId: uuid('run_id').references(() => runs.id),
    userId: uuid('user_id').references(() => users.id),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    model: text('model'),
    costCents: integer('cost_cents'), // 费用（分）
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    tenantIdx: index('billing_records_tenant_id_idx').on(table.tenantId),
    sessionIdx: index('billing_records_session_id_idx').on(table.sessionId),
    runIdx: index('billing_records_run_id_idx').on(table.runId),
}));

/**
 * Run 表
 * 存储一次受控执行的生产事实，而不是只把聊天流作为事实来源
 */
export const runs = pgTable('runs', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    userId: uuid('user_id').notNull().references(() => users.id),
    agentId: uuid('agent_id').notNull().references(() => agentTemplates.id),
    agentVersionId: uuid('agent_version_id').references(() => agentTemplateVersions.id),
    threadId: text('thread_id').notNull().references(() => sessions.id),
    requestId: text('request_id').notNull(),
    status: text('status').notNull().default('running'), // 'running' | 'completed' | 'failed' | 'cancelled'
    model: text('model'),
    inputTokens: integer('input_tokens').default(0),
    outputTokens: integer('output_tokens').default(0),
    /** Run 级成本归因（分）。从 inputTokens/outputTokens + 当前模型定价计算，
     *  在 runs 进入 completed 终态时由 thread-manager 写入。 */
    costCents: integer('cost_cents').default(0),
    error: jsonb('error').$type<Record<string, unknown>>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    startedAt: timestamp('started_at').defaultNow(),
    completedAt: timestamp('completed_at'),
}, (table) => ({
    tenantStartedIdx: index('runs_tenant_started_idx').on(table.tenantId, table.startedAt),
    threadIdx: index('runs_thread_id_idx').on(table.threadId),
    requestIdx: index('runs_request_id_idx').on(table.requestId),
}));

/**
 * Run 事件表
 * 存储一次受控执行的可解释时间线，而不是把聊天 transcript 当作事实来源
 */
export const runEvents = pgTable('run_events', {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    runId: uuid('run_id').notNull().references(() => runs.id, {onDelete: 'cascade'}),
    eventType: text('event_type').notNull(),
    sequence: integer('sequence').notNull(),
    requestId: text('request_id'),
    payloadSummary: jsonb('payload_summary').$type<Record<string, unknown>>().default({}),
    occurredAt: timestamp('occurred_at').defaultNow(),
}, (table) => ({
    runSequenceIdx: index('run_events_run_sequence_idx').on(table.runId, table.sequence),
    tenantOccurredIdx: index('run_events_tenant_occurred_idx').on(table.tenantId, table.occurredAt),
    typeIdx: index('run_events_type_idx').on(table.eventType),
}));

/**
 * 工具调用表
 * 存储 runtime 工具调用摘要，输入/输出只保留治理可解释的脱敏摘要
 */
export const toolInvocations = pgTable('tool_invocations', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    runId: uuid('run_id').notNull().references(() => runs.id, {onDelete: 'cascade'}),
    toolUseId: text('tool_use_id').notNull(),
    toolName: text('tool_name').notNull(),
    status: text('status').notNull().default('running'),
    requestId: text('request_id'),
    inputSummary: jsonb('input_summary').$type<Record<string, unknown>>().default({}),
    outputSummary: jsonb('output_summary').$type<Record<string, unknown>>(),
    errorSummary: jsonb('error_summary').$type<Record<string, unknown>>(),
    startedAt: timestamp('started_at').defaultNow(),
    completedAt: timestamp('completed_at'),
}, (table) => ({
    runIdx: index('tool_invocations_run_idx').on(table.runId),
    tenantStartedIdx: index('tool_invocations_tenant_started_idx').on(table.tenantId, table.startedAt),
    toolUseIdx: index('tool_invocations_tool_use_idx').on(table.toolUseId),
}));

/**
 * 策略决策表
 * 记录模型、工具、配额、数据边界等治理决策，供治理台追责和审计
 */
export const policyDecisions = pgTable('policy_decisions', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    runId: uuid('run_id').references(() => runs.id, {onDelete: 'cascade'}),
    requestId: text('request_id'),
    policyType: text('policy_type').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    decision: text('decision').notNull(), // 'allow' | 'deny' | 'review_required'
    reason: text('reason').notNull(),
    detailsSummary: jsonb('details_summary').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    tenantCreatedIdx: index('policy_decisions_tenant_created_idx').on(table.tenantId, table.createdAt),
    runIdx: index('policy_decisions_run_idx').on(table.runId),
    requestIdx: index('policy_decisions_request_idx').on(table.requestId),
    decisionIdx: index('policy_decisions_decision_idx').on(table.decision),
    typeIdx: index('policy_decisions_type_idx').on(table.policyType),
}));

/**
 * 成果文件表
 * 只存储平台治理需要的 artifact 元数据、hash 和存储引用，不存储文件正文
 */
export const artifacts = pgTable('artifacts', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    runId: uuid('run_id').references(() => runs.id),
    requestId: text('request_id'),
    artifactType: text('artifact_type').notNull().default('file'),
    title: text('title').notNull(),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes'),
    sha256: text('sha256').notNull(),
    storageUri: text('storage_uri').notNull(),
    sourceType: text('source_type').notNull().default('runtime_tool'),
    sourceRef: text('source_ref'),
    createdBy: uuid('created_by').references(() => users.id),
    metadataSummary: jsonb('metadata_summary').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    tenantCreatedIdx: index('artifacts_tenant_created_idx').on(table.tenantId, table.createdAt),
    runCreatedIdx: index('artifacts_run_created_idx').on(table.runId, table.createdAt),
    tenantTypeIdx: index('artifacts_tenant_type_idx').on(table.tenantId, table.artifactType),
    shaIdx: index('artifacts_sha_idx').on(table.sha256),
}));

/**
 * 证据元数据表
 * Evidence 是审计事实，不等同于聊天 transcript 或流式输出
 */
export const evidenceArtifacts = pgTable('evidence_artifacts', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    artifactId: uuid('artifact_id').notNull().references(() => artifacts.id),
    runId: uuid('run_id').references(() => runs.id),
    requestId: text('request_id'),
    evidenceType: text('evidence_type').notNull().default('generated_extract'),
    sourceSystem: text('source_system'),
    sourceUri: text('source_uri'),
    sourceHash: text('source_hash').notNull(),
    importedBy: uuid('imported_by').references(() => users.id),
    capturedAt: timestamp('captured_at'),
    metadataSummary: jsonb('metadata_summary').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    tenantCreatedIdx: index('evidence_artifacts_tenant_created_idx').on(table.tenantId, table.createdAt),
    runCreatedIdx: index('evidence_artifacts_run_created_idx').on(table.runId, table.createdAt),
    artifactIdx: index('evidence_artifacts_artifact_idx').on(table.artifactId),
    tenantTypeIdx: index('evidence_artifacts_tenant_type_idx').on(table.tenantId, table.evidenceType),
}));

/**
 * 人工复核表
 * 记录复核、批准、退回、豁免等人类责任判断
 */
export const humanReviews = pgTable('human_reviews', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    runId: uuid('run_id').references(() => runs.id),
    requestId: text('request_id'),
    reviewType: text('review_type').notNull().default('run_result'),
    status: text('status').notNull().default('pending'),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    title: text('title').notNull(),
    reason: text('reason').notNull(),
    assignedTo: uuid('assigned_to').references(() => users.id),
    requestedBy: uuid('requested_by').references(() => users.id),
    decidedBy: uuid('decided_by').references(() => users.id),
    decision: text('decision'),
    decisionReason: text('decision_reason'),
    decisionSummary: jsonb('decision_summary').$type<Record<string, unknown>>().default({}),
    metadataSummary: jsonb('metadata_summary').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow(),
    decidedAt: timestamp('decided_at'),
}, (table) => ({
    tenantCreatedIdx: index('human_reviews_tenant_created_idx').on(table.tenantId, table.createdAt),
    tenantStatusIdx: index('human_reviews_tenant_status_idx').on(table.tenantId, table.status),
    runIdx: index('human_reviews_run_idx').on(table.runId),
    subjectIdx: index('human_reviews_subject_idx').on(table.subjectType, table.subjectId),
    assigneeIdx: index('human_reviews_assignee_idx').on(table.assignedTo),
}));

/**
 * 关账工作区表
 * Solution Pack 业务容器，承载账套和期间范围，不进入 runtime kernel
 */
export const closeWorkspaces = pgTable('close_workspaces', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    name: text('name').notNull(),
    scope: jsonb('scope').$type<Record<string, unknown>>().default({}),
    status: text('status').notNull().default('active'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    tenantCreatedIdx: index('close_workspaces_tenant_created_idx').on(table.tenantId, table.createdAt),
    tenantStatusIdx: index('close_workspaces_tenant_status_idx').on(table.tenantId, table.status),
}));

/**
 * 会计期间表
 * 关账 workflow 的主状态对象
 */
export const accountingPeriods = pgTable('accounting_periods', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    workspaceId: uuid('workspace_id').notNull().references(() => closeWorkspaces.id),
    periodKey: text('period_key').notNull(),
    startsAt: timestamp('starts_at').notNull(),
    endsAt: timestamp('ends_at').notNull(),
    status: text('status').notNull().default('open'),
    lockedBy: uuid('locked_by').references(() => users.id),
    lockedAt: timestamp('locked_at'),
    metadataSummary: jsonb('metadata_summary').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    workspaceIdx: index('accounting_periods_workspace_idx').on(table.workspaceId),
    tenantPeriodIdx: index('accounting_periods_tenant_period_idx').on(table.tenantId, table.periodKey),
    tenantStatusIdx: index('accounting_periods_tenant_status_idx').on(table.tenantId, table.status),
}));

/**
 * 关账检查项表
 * MVP 固化前三条规则实例，不下沉到 engine
 */
export const checklistItems = pgTable('checklist_items', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    workspaceId: uuid('workspace_id').notNull().references(() => closeWorkspaces.id),
    periodId: uuid('period_id').notNull().references(() => accountingPeriods.id),
    code: text('code').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    severity: text('severity').notNull().default('warning'),
    status: text('status').notNull().default('pending'),
    runId: uuid('run_id').references(() => runs.id),
    ownerUserId: uuid('owner_user_id').references(() => users.id),
    reviewerUserId: uuid('reviewer_user_id').references(() => users.id),
    metadataSummary: jsonb('metadata_summary').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    periodIdx: index('checklist_items_period_idx').on(table.periodId),
    workspaceIdx: index('checklist_items_workspace_idx').on(table.workspaceId),
    tenantStatusIdx: index('checklist_items_tenant_status_idx').on(table.tenantId, table.status),
    codeIdx: index('checklist_items_code_idx').on(table.code),
}));

/**
 * 关账异常发现表
 * 关联 EvidenceArtifact 与 HumanReview，记录业务责任状态
 */
export const findings = pgTable('findings', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    workspaceId: uuid('workspace_id').notNull().references(() => closeWorkspaces.id),
    periodId: uuid('period_id').notNull().references(() => accountingPeriods.id),
    checklistItemId: uuid('checklist_item_id').notNull().references(() => checklistItems.id),
    runId: uuid('run_id').references(() => runs.id),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    severity: text('severity').notNull().default('warning'),
    status: text('status').notNull().default('open'),
    assigneeId: uuid('assignee_id').references(() => users.id),
    evidenceArtifactIds: jsonb('evidence_artifact_ids').$type<string[]>().default([]),
    humanReviewId: uuid('human_review_id').references(() => humanReviews.id),
    decisionReason: text('decision_reason'),
    metadataSummary: jsonb('metadata_summary').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    periodIdx: index('findings_period_idx').on(table.periodId),
    workspaceIdx: index('findings_workspace_idx').on(table.workspaceId),
    tenantStatusIdx: index('findings_tenant_status_idx').on(table.tenantId, table.status),
    reviewIdx: index('findings_human_review_idx').on(table.humanReviewId),
}));

/**
 * 关账报告快照表
 * 报告是事实链快照，不是模型回答副本
 */
export const closeReports = pgTable('close_reports', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    workspaceId: uuid('workspace_id').notNull().references(() => closeWorkspaces.id),
    periodId: uuid('period_id').notNull().references(() => accountingPeriods.id),
    status: text('status').notNull().default('generated'),
    title: text('title').notNull(),
    summary: jsonb('summary').$type<Record<string, unknown>>().default({}),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
    snapshotHash: text('snapshot_hash').notNull(),
    runIds: jsonb('run_ids').$type<string[]>().default([]),
    evidenceArtifactIds: jsonb('evidence_artifact_ids').$type<string[]>().default([]),
    findingIds: jsonb('finding_ids').$type<string[]>().default([]),
    humanReviewIds: jsonb('human_review_ids').$type<string[]>().default([]),
    auditEventIds: jsonb('audit_event_ids').$type<number[]>().default([]),
    artifactId: uuid('artifact_id').references(() => artifacts.id),
    generatedBy: uuid('generated_by').references(() => users.id),
    generatedAt: timestamp('generated_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    periodIdx: index('close_reports_period_idx').on(table.periodId),
    workspaceIdx: index('close_reports_workspace_idx').on(table.workspaceId),
    tenantCreatedIdx: index('close_reports_tenant_created_idx').on(table.tenantId, table.createdAt),
    hashIdx: index('close_reports_hash_idx').on(table.snapshotHash),
}));

/**
 * 审计事件表
 * 存储企业治理需要的 append-only 事实
 */
export const auditEvents = pgTable('audit_events', {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    userId: uuid('user_id').references(() => users.id),
    requestId: text('request_id'),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    outcome: text('outcome').notNull().default('success'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
    tenantCreatedIdx: index('audit_events_tenant_created_idx').on(table.tenantId, table.createdAt),
    requestIdx: index('audit_events_request_id_idx').on(table.requestId),
    resourceIdx: index('audit_events_resource_idx').on(table.resourceType, table.resourceId),
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
    type: text('type').notNull(), // MIME type（如 application/pdf, text/markdown）
    category: text('category').notNull().default('document'), // 'memory' | 'knowledge' | 'document'
    size: integer('size').notNull().default(0),
    path: text('path').notNull(), // 文件系统路径
    uploadedAt: timestamp('uploaded_at').defaultNow(),
}, (table) => ({
    templateIdx: index('documents_template_id_idx').on(table.templateId),
}));

/**
 * Skills 表
 * 存储 Agent 技能模板
 */
export const skills = pgTable('skills', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    name: text('name').notNull(),
    description: text('description'),
    content: text('content'), // 技能的具体内容（可选）
    status: text('status').notNull().default('active'), // 'active' | 'draft'
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    tenantIdx: index('skills_tenant_id_idx').on(table.tenantId),
    statusIdx: index('skills_status_idx').on(table.status),
}));

/**
 * Agent-Skills 关联表
 * 存储 Agent 与 Skill 的多对多关系
 */
export const agentSkills = pgTable('agent_skills', {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id').notNull().references(() => agentTemplates.id, {onDelete: 'cascade'}),
    skillId: uuid('skill_id').notNull().references(() => skills.id, {onDelete: 'cascade'}),
    assignedAt: timestamp('assigned_at').defaultNow(),
}, (table) => ({
    agentIdx: index('agent_skills_agent_id_idx').on(table.agentId),
    skillIdx: index('agent_skills_skill_id_idx').on(table.skillId),
    uniqueAgentSkill: index('agent_skills_agent_skill_unique_idx').on(table.agentId, table.skillId),
}));

// 类型导出
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type CustomerProject = typeof customerProjects.$inferSelect;
export type NewCustomerProject = typeof customerProjects.$inferInsert;

export type AgentTemplate = typeof agentTemplates.$inferSelect;
export type NewAgentTemplate = typeof agentTemplates.$inferInsert;

export type AgentTemplateVersion = typeof agentTemplateVersions.$inferSelect;
export type NewAgentTemplateVersion = typeof agentTemplateVersions.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type BillingRecord = typeof billingRecords.$inferSelect;
export type NewBillingRecord = typeof billingRecords.$inferInsert;

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;

export type RunEvent = typeof runEvents.$inferSelect;
export type NewRunEvent = typeof runEvents.$inferInsert;

export type ToolInvocation = typeof toolInvocations.$inferSelect;
export type NewToolInvocation = typeof toolInvocations.$inferInsert;

export type PolicyDecision = typeof policyDecisions.$inferSelect;
export type NewPolicyDecision = typeof policyDecisions.$inferInsert;

export type Artifact = typeof artifacts.$inferSelect;
export type NewArtifact = typeof artifacts.$inferInsert;

export type EvidenceArtifact = typeof evidenceArtifacts.$inferSelect;
export type NewEvidenceArtifact = typeof evidenceArtifacts.$inferInsert;

export type HumanReview = typeof humanReviews.$inferSelect;
export type NewHumanReview = typeof humanReviews.$inferInsert;

export type CloseWorkspace = typeof closeWorkspaces.$inferSelect;
export type NewCloseWorkspace = typeof closeWorkspaces.$inferInsert;

export type AccountingPeriod = typeof accountingPeriods.$inferSelect;
export type NewAccountingPeriod = typeof accountingPeriods.$inferInsert;

export type ChecklistItem = typeof checklistItems.$inferSelect;
export type NewChecklistItem = typeof checklistItems.$inferInsert;

export type Finding = typeof findings.$inferSelect;
export type NewFinding = typeof findings.$inferInsert;

export type CloseReport = typeof closeReports.$inferSelect;
export type NewCloseReport = typeof closeReports.$inferInsert;

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;

export type AgentSkill = typeof agentSkills.$inferSelect;
export type NewAgentSkill = typeof agentSkills.$inferInsert;
