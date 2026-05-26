/**
 * ThreadManager — Thread 生命周期管理服务
 *
 * 核心设计：
 * - 每次 dispatch 创建/销毁 Engine（无状态，无池化）
 * - SDK 自动从 workspace 恢复对话历史
 * - Engine 创建通过工厂函数注入，便于测试 mock
 */

import {randomUUID} from 'crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync} from 'fs';
import {resolve, join} from 'path';
import {db} from '../db/index.js';
import {
    agentTemplates,
    sessions as sessionsTable,
    skills,
    documents as documentsTable,
    agentSkills
} from '../db/schema.js';
import {eq, and, desc, sql} from 'drizzle-orm';
import {
    assembleSystemPrompt,
    type AgentTemplate as PromptAssemblerTemplate,
    type Skill,
    type Document
} from './prompt-assembler.js';
import {createLogger} from '../utils/logger.js';
import {createTracingProviderForRequest} from './observability/index.js';
import {LangfuseTracingProvider} from './observability/langfuse-tracing-provider.js';
import {TracingEventProcessor} from './observability/tracing-event-processor.js';
import {costAggregator} from './cost.js';
import {agentVersionService} from './agent-version.js';
import {runService} from './run.js';
import {runFactService} from './run-facts.js';
import {artifactEvidenceService} from './artifact-evidence.js';
import {runAdmissionService} from './run-admission.js';
import type {ChatRequestContext} from '@shared/neptune-ai';

const log = createLogger('thread-manager');

/**
 * Thread 类型 — 基于 sessions 表
 */
export interface Thread {
    id: string;
    tenantId: string;
    userId: string;
    templateId: string | null;
    status: string;
    title: string | null;
    summary: string | null;
    workspace: string;
    lastActiveAt: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
}

/**
 * Thread 列表查询结果
 */
export interface ThreadListResult {
    data: Thread[];
    meta: {
        count: number;
        limit: number;
        offset: number;
    };
}

/**
 * Engine 最小接口 — 只需要 query 和 destroy
 */
export interface QueryableEngine {
    query(sessionId: string, content: string): AsyncIterable<unknown>;
    destroy(): Promise<void>;
    on?(event: string, handler: (payload: unknown) => void): void;
}

/**
 * Engine 工厂接口 — 用于解耦 AgentEngine 依赖
 */
export interface EngineFactory {
    createAndLoad(params: {
        /** Agent 身份声明（精确替换 CC 默认身份前缀） */
        identityOverride?: string;
        /** 技能列表（Engine 内部写入 .claude/skills/，CC 自动发现） */
        skills?: Array<{ name: string; description?: string; content: string }>;
        /** 平台安全规则 + 行为指令（写入 workspace CLAUDE.md，CC 自动读取） */
        instructions?: string;
        memoryRoot: string;
        workspace: string;
        tools: string[];
        mcpServers: Array<{ name: string; url: string }>;
        tenantId: string;
        /**
         * 治理上下文：让 permission-delegate 在 deny 工具/MCP/路径时
         * 能够写入 PolicyDecision 并关联到 Run。
         * 由 dispatch 在 Run 启动后传入。
         */
        governance?: {
            runId?: string | null;
            requestId?: string;
        };
    }): Promise<{
        engine: QueryableEngine;
        sdkSessionId: string;
    }>;
}

/**
 * Query Usage 结果
 */
export interface QueryUsageResult {
    sessionId: string;
    modelUsage: Record<string, {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens: number;
        cacheCreationInputTokens: number;
        costUSD: number;
    }>;
}

export interface DispatchDoneEvent {
    type: 'dispatch_done';
    usage?: QueryUsageResult;
}

export type ThreadDispatchEvent = Record<string, unknown> | DispatchDoneEvent;

/**
 * 默认 workspace 基础路径
 */
const DEFAULT_DATA_ROOT = './data';

/**
 * ThreadManager 配置
 */
export interface ThreadManagerConfig {
    engineFactory?: EngineFactory;
    dataRoot?: string;
}

/**
 * ThreadManager — Thread 生命周期管理
 */
export class ThreadManager {
    private engineFactory: EngineFactory | undefined;
    private lastUsage: QueryUsageResult | null = null;
    private dataRoot: string;
    private artifactCandidates = new Map<string, {
        path: string;
        content: string;
        toolName: string;
    }>();

    constructor(config?: ThreadManagerConfig) {
        this.engineFactory = config?.engineFactory;
        this.dataRoot = config?.dataRoot ?? DEFAULT_DATA_ROOT;
    }

    // ===== CRUD 方法 =====

    /**
     * 创建 Thread
     */
    async create(params: {
        tenantId: string;
        userId: string;
        agentId: string;
        title?: string;
    }): Promise<Thread> {
        const threadId = randomUUID();
        const workspace = `${this.dataRoot}/tenants/${params.tenantId}/agents/${params.agentId}/threads/${threadId}/`;

        // 创建 workspace 目录
        if (!existsSync(workspace)) {
            mkdirSync(workspace, {recursive: true});
        }

        const [thread] = await db
            .insert(sessionsTable)
            .values({
                id: threadId,
                tenantId: params.tenantId,
                userId: params.userId,
                templateId: params.agentId,
                status: 'idle',
                title: params.title ?? null,
                summary: null,
                workspace,
            })
            .returning();

        return this.mapToThread(thread);
    }

    /**
     * 列出 Thread
     */
    async list(
        agentId: string,
        userId: string,
        filters?: {
            status?: string;
            limit?: number;
            offset?: number;
        },
    ): Promise<ThreadListResult> {
        const limit = filters?.limit ?? 50;
        const offset = filters?.offset ?? 0;

        const conditions = [
            eq(sessionsTable.templateId, agentId),
            eq(sessionsTable.userId, userId),
        ];

        if (filters?.status) {
            conditions.push(eq(sessionsTable.status, filters.status));
        }

        // 查询总数
        const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(sessionsTable)
            .where(and(...conditions));

        const count = countResult[0]?.count ?? 0;

        // 查询数据
        const results = await db
            .select()
            .from(sessionsTable)
            .where(and(...conditions))
            .orderBy(desc(sessionsTable.lastActiveAt))
            .limit(limit)
            .offset(offset);

        return {
            data: results.map(r => this.mapToThread(r)),
            meta: {count, limit, offset},
        };
    }

    /**
     * 列出用户最近的 Thread（跨所有 Agent）
     * 用于 Collaborate 首页的"最近协作记录"视图
     */
    async listRecentThreads(
        userId: string,
        tenantId: string,
        limit = 10,
    ): Promise<Array<{
        id: string;
        tenantId: string;
        userId: string;
        templateId: string | null;
        status: string;
        title: string | null;
        summary: string | null;
        workspace: string;
        lastActiveAt: Date | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        agentName: string | null;
        agentIcon: string | null;
    }>> {
        // 查询用户最近的 Thread，包含 Agent 信息
        const results = await db
            .select({
                id: sessionsTable.id,
                tenantId: sessionsTable.tenantId,
                userId: sessionsTable.userId,
                templateId: sessionsTable.templateId,
                status: sessionsTable.status,
                title: sessionsTable.title,
                summary: sessionsTable.summary,
                workspace: sessionsTable.workspace,
                lastActiveAt: sessionsTable.lastActiveAt,
                createdAt: sessionsTable.createdAt,
                updatedAt: sessionsTable.updatedAt,
                agentName: agentTemplates.name,
                agentIcon: agentTemplates.icon,
            })
            .from(sessionsTable)
            .leftJoin(agentTemplates, eq(sessionsTable.templateId, agentTemplates.id))
            .where(
                and(
                    eq(sessionsTable.userId, userId),
                    eq(sessionsTable.tenantId, tenantId),
                ),
            )
            .orderBy(desc(sessionsTable.lastActiveAt))
            .limit(limit);

        return results.map(r => ({
            id: r.id,
            tenantId: r.tenantId,
            userId: r.userId,
            templateId: r.templateId,
            status: r.status,
            title: r.title,
            summary: r.summary,
            workspace: r.workspace,
            lastActiveAt: r.lastActiveAt,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            agentName: r.agentName ?? null,
            agentIcon: r.agentIcon ?? null,
        }));
    }

    /**
     * 获取单个 Thread
     */
    async get(threadId: string): Promise<Thread | null> {
        const [row] = await db
            .select()
            .from(sessionsTable)
            .where(eq(sessionsTable.id, threadId))
            .limit(1);

        return row ? this.mapToThread(row) : null;
    }

    /**
     * 更新 Thread
     */
    async update(
        threadId: string,
        data: {
            title?: string;
            summary?: string;
            status?: string;
        },
    ): Promise<Thread | null> {
        const [updated] = await db
            .update(sessionsTable)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(sessionsTable.id, threadId))
            .returning();

        return updated ? this.mapToThread(updated) : null;
    }

    /**
     * 删除 Thread
     */
    async delete(threadId: string): Promise<boolean> {
        const result = await db
            .delete(sessionsTable)
            .where(eq(sessionsTable.id, threadId))
            .returning();

        return result.length > 0;
    }

    // ===== Dispatch 方法 =====

    /**
     * 向 Thread 发送消息 — 核心方法
     *
     * 流程：
     * 1. 获取 Thread，验证状态
     * 2. 更新状态为 running
     * 3. 获取 Agent 模板，组装 systemPrompt
     * 4. 创建 Engine（每次新建，SDK 自动从 workspace 恢复历史）
     * 5. 执行 query 并 yield 事件
     * 6. 持久化 transcript → destroy Engine
     * 7. 更新状态为 idle
     */
    async* dispatch(
        threadId: string,
        content: string,
        requestContext?: ChatRequestContext,
    ): AsyncGenerator<ThreadDispatchEvent> {
        const thread = await this.get(threadId);
        if (!thread) {
            throw new Error(`Thread 不存在: ${threadId}`);
        }

        const agentId = thread.templateId;
        const ctx = {threadId, tenantId: thread.tenantId, agentId, requestId: requestContext?.requestId};

        // 验证状态
        if (thread.status === 'running') {
            throw new Error(`Thread 正在执行中: ${threadId}`);
        }

        await runAdmissionService.enforceThreadDispatch({
            thread,
            requestId: requestContext?.requestId,
        });

        if (!this.engineFactory) {
            throw new Error('Engine factory 未配置');
        }

        // 更新状态为 running
        await this.update(threadId, {
            status: 'running',
            summary: content.substring(0, 100),
        });

        const startTime = performance.now();
        log.info('Query 开始', {...ctx, contentLength: content.length});

        let tracingProcessor: TracingEventProcessor | null = null;
        let engine: QueryableEngine | null = null;
        let dispatchUsage: QueryUsageResult | undefined;
        let runId: string | null = null;

        try {
            if (!agentId) {
                throw new Error('Thread 没有关联的 Agent 模板');
            }

            // 步骤 1：从数据库加载 Agent 模板配置
            const [template] = await db
                .select()
                .from(agentTemplates)
                .where(eq(agentTemplates.id, agentId))
                .limit(1);

            if (!template) {
                throw new Error(`Agent 模板不存在: ${agentId}`);
            }
            log.debug('Agent 模板已加载', {...ctx, templateName: (template as any).name});

            const agentVersion = await agentVersionService.ensureSnapshot({
                template,
                userId: thread.userId,
                requestId: requestContext?.requestId,
            });

            const run = await runService.start({
                tenantId: thread.tenantId,
                userId: thread.userId,
                agentId,
                agentVersionId: agentVersion.id,
                threadId,
                requestId: requestContext?.requestId ?? randomUUID(),
                metadata: {
                    contentLength: content.length,
                },
            });
            runId = run.id;
            await runFactService.recordEvent({
                tenantId: thread.tenantId,
                runId,
                eventType: 'run.started',
                requestId: requestContext?.requestId ?? run.requestId,
                payloadSummary: {
                    agentId,
                    agentVersionId: agentVersion.id,
                    threadId,
                    inputLength: content.length,
                },
            });

            // 注意：模型策略 PolicyDecision 不在此处写入。
            // 设计原则：PolicyDecision 只记录治理事实（deny / review_required），
            // 不记录"通过的常规调用"——否则会产生大量噪声。
            // 当出现"客户禁用某模型"等真实模型治理决策时再写。
            const modelConfig = template.modelConfig as {provider?: string; model?: string} | null;

            // 步骤 2：准备 Agent 配置（结构化数据，不做字符串拼接）
            // - identity: 替换 CC 身份前缀
            // - skills: Engine 内部写入 .claude/skills/，CC 自动发现
            // - instructions: 写入 workspace/CLAUDE.md，CC 自动读取
            const promptConfig = template.promptConfig as { identity?: string; disableGuard?: boolean; toolInstructions?: string } | null;
            const identityOverride = promptConfig?.identity || (template as any).systemPrompt || undefined;

            // 从 DB 读取 skills 和 documents
            const [fetchedSkills, fetchedDocuments] = await Promise.all([
                this.fetchAgentSkills(agentId),
                this.fetchAgentDocuments(agentId),
            ]);
            const agentInstructions = this.loadAgentInstructions(thread.tenantId, agentId);

            // 组装 instructions（Guard + 行为指令 + 知识库 + 工具约束）→ 写入 CLAUDE.md
            const instructionBlocks: string[] = [];
            if (!promptConfig?.disableGuard) {
                const {PLATFORM_GUARD} = await import('./prompt-assembler.js');
                instructionBlocks.push(PLATFORM_GUARD);
            }
            if (agentInstructions) {
                instructionBlocks.push(agentInstructions);
            }
            if (fetchedDocuments.length > 0) {
                const docsBlock = fetchedDocuments.map(d => `## ${d.name}\n\n${d.content}`).join('\n\n');
                instructionBlocks.push(`# Knowledge Base\n\n${docsBlock}`);
            }
            if (promptConfig?.toolInstructions) {
                instructionBlocks.push(promptConfig.toolInstructions);
            }
            const instructions = instructionBlocks.length > 0 ? instructionBlocks.join('\n\n') : undefined;

            // 转换 skills 为 Engine SkillExtension 格式
            const skillExtensions = fetchedSkills
                .filter(s => s.content)
                .map(s => ({ name: s.name, content: s.content! }));

            log.debug('Agent 配置准备完成', {
                ...ctx,
                identityLength: identityOverride?.length ?? 0,
                skillsCount: skillExtensions.length,
                instructionsLength: instructions?.length ?? 0,
            });

            // 步骤 3：创建 Engine（结构化参数，Engine 内部按原生机制注入）
            const mcpServers = (template.mcpServers as Array<{ name: string; url: string }> || [])
                .map(server => ({name: server.name, url: server.url}));
            const result = await this.engineFactory.createAndLoad({
                identityOverride,
                skills: skillExtensions.length > 0 ? skillExtensions : undefined,
                instructions,
                memoryRoot: `${this.dataRoot}/tenants/${thread.tenantId}/agents/${agentId}`,
                workspace: thread.workspace,
                tools: (template.tools as string[]) || [],
                mcpServers,
                tenantId: thread.tenantId,
                governance: {
                    runId,
                    requestId: requestContext?.requestId ?? run.requestId,
                },
            });

            engine = result.engine;
            const sdkSessionId = result.sdkSessionId;
            log.info('Engine 就绪，开始执行 query', {...ctx, sdkSessionId});

            // 步骤 4：监听 query:complete 事件收集 token 用量
            if (typeof engine.on === 'function') {
                engine.on('query:complete', (payload: unknown) => {
                    dispatchUsage = payload as QueryUsageResult;
                    this.lastUsage = dispatchUsage;
                    log.debug('query:complete 收到 usage', {threadId});
                });
            }

            // 步骤 5：创建 PlanManager（监听 TaskCreate/TaskUpdate 事件，转换为 plan SSE 事件）
            const {PlanManager} = await import('./plan/PlanManager.js');
            const planManager = new PlanManager(threadId, {workspace: thread.workspace});

            // 步骤 6：创建 Tracing 处理器（Langfuse 上报每个 turn 的 generation + tool span）
            const provider = createTracingProviderForRequest();
            if (provider instanceof LangfuseTracingProvider) {
                const modelConfig = template.modelConfig as { model?: string } | null;
                const configuredModel = modelConfig?.model || process.env.NEPTUNE_LLM_MODEL || 'unknown';
                tracingProcessor = new TracingEventProcessor({
                    provider,
                    model: configuredModel,
                    threadId,
                    userId: thread.userId,
                    tenantId: thread.tenantId,
                    agentId: agentId!,
                    requestId: requestContext?.requestId,
                    sdkSessionId,
                    userInput: content,
                    systemPrompt: instructions || identityOverride || '',
                });
            }

            // 步骤 7：执行 query（Engine 内部 AgentLoop：LLM 调用 → 工具执行 → 循环直到完成或达到 maxTurns）
            // 注入回调：Engine 首次 LLM 调用时传出完整 system prompt
            const engineAny = engine as any;
            if (engineAny._onSystemPromptResolved === undefined) {
                engineAny._onSystemPromptResolved = (fullPrompt: string) => {
                    if (tracingProcessor) {
                        tracingProcessor.setFullSystemPrompt(fullPrompt);
                    }
                };
            }

            for await (const event of engine.query(sdkSessionId, content)) {
                await this.recordRunFactsFromRuntimeEvent({
                    tenantId: thread.tenantId,
                    runId,
                    userId: thread.userId,
                    requestId: requestContext?.requestId ?? run.requestId,
                    event,
                });

                // Langfuse 上报：每个事件都经过 tracing 处理器记录
                tracingProcessor?.process(event);

                // Plan 事件处理：拦截 TaskCreate/TaskUpdate 工具调用，转换为 plan_step SSE 事件
                const planEvents = planManager.processSDKEvent(event as Record<string, unknown>);
                for (const planEvent of planEvents) {
                    yield planEvent as unknown as ThreadDispatchEvent;
                }

                // 原始事件透传给 SSE 路由层（经 mapSSEEvent 转换后发送给前端）
                yield event as ThreadDispatchEvent;
            }

            // 步骤 8：Query 完成，更新 Thread 状态
            await this.update(threadId, { status: 'idle' });

            const durationMs = Math.round(performance.now() - startTime);
            const usage = dispatchUsage;
            log.info('Query 完成', {
                ...ctx,
                durationMs,
                ...(usage?.modelUsage
                    ? {
                        model: Object.keys(usage.modelUsage)[0],
                        inputTokens: Object.values(usage.modelUsage)[0]?.inputTokens,
                        outputTokens: Object.values(usage.modelUsage)[0]?.outputTokens,
                    }
                    : {}),
            });

            // 结束 Langfuse trace
            tracingProcessor?.end(usage ? {modelUsage: usage.modelUsage} : undefined, durationMs);

            if (usage?.modelUsage) {
                await this.recordBillingUsage(thread, usage, ctx);
            }

            if (runId) {
                const usageSummary = this.summarizeUsage(usage);
                await runService.complete({
                    runId,
                    tenantId: thread.tenantId,
                    userId: thread.userId,
                    requestId: requestContext?.requestId ?? run.requestId,
                    model: usageSummary.model,
                    inputTokens: usageSummary.inputTokens,
                    outputTokens: usageSummary.outputTokens,
                    metadata: {
                        durationMs,
                    },
                });
                await runFactService.recordEvent({
                    tenantId: thread.tenantId,
                    runId,
                    eventType: 'run.completed',
                    requestId: requestContext?.requestId ?? run.requestId,
                    payloadSummary: {
                        durationMs,
                        model: usageSummary.model,
                        inputTokens: usageSummary.inputTokens,
                        outputTokens: usageSummary.outputTokens,
                    },
                });
            }
            if (runId) {
                this.clearArtifactCandidatesForRun(runId);
            }

            yield {type: 'dispatch_done', usage};

            // 持久化对话历史
            try {
                const engineAny = engine as any;
                if (typeof engineAny._getSessionMessages === 'function') {
                    const messages = engineAny._getSessionMessages(sdkSessionId);
                    if (messages && messages.length > 0) {
                        const transcriptPath = join(thread.workspace, 'transcript.jsonl');
                        const lines = messages.map((msg: unknown) => JSON.stringify(msg)).join('\n') + '\n';
                        writeFileSync(transcriptPath, lines, 'utf-8');
                    }
                }
            } catch (persistError) {
                log.warn('Transcript persist failed', {threadId, detail: (persistError as Error).message});
            }
        } catch (error) {
            const durationMs = Math.round(performance.now() - startTime);
            log.error('Query failed', {...ctx, durationMs, detail: (error as Error).message});
            tracingProcessor?.endWithError();
            if (runId) {
                await runService.fail({
                    runId,
                    tenantId: thread.tenantId,
                    userId: thread.userId,
                    requestId: requestContext?.requestId ?? '',
                    error: {
                        message: (error as Error).message,
                        durationMs,
                    },
                }).catch(() => {});
                await runFactService.recordEvent({
                    tenantId: thread.tenantId,
                    runId,
                    eventType: 'run.failed',
                    requestId: requestContext?.requestId,
                    payloadSummary: {
                        message: (error as Error).message,
                        durationMs,
                    },
                }).catch(() => {});
                this.clearArtifactCandidatesForRun(runId);
            }
            await this.update(threadId, {status: 'error'}).catch(() => {});
            throw error;
        } finally {
            // 始终销毁 Engine（无论成功或失败）
            if (engine) {
                try {
                    await engine.destroy();
                    log.debug('Engine destroyed', ctx);
                } catch (destroyError) {
                    log.warn('Engine destroy failed', {threadId, detail: (destroyError as Error).message});
                }
            }
        }
    }

    private async recordRunFactsFromRuntimeEvent(params: {
        tenantId: string;
        runId: string;
        userId?: string | null;
        requestId?: string;
        event: unknown;
    }): Promise<void> {
        if (!params.event || typeof params.event !== 'object') return;
        const event = params.event as Record<string, unknown>;
        const type = typeof event.type === 'string' ? event.type : '';

        if (type === 'tool_use') {
            const toolUseId = stringValue(event.id) ?? stringValue(event.toolUseId) ?? randomUUID();
            const toolName = stringValue(event.name) || 'unknown_tool';
            const input = recordValue(event.input);

            await runFactService.recordToolStarted({
                tenantId: params.tenantId,
                runId: params.runId,
                requestId: params.requestId,
                toolUseId,
                toolName,
                input,
            }).catch(error => {
                log.warn('Tool invocation record failed', {
                    runId: params.runId,
                    toolUseId,
                    detail: (error as Error).message,
                });
            });

            // 注意：工具调用 PolicyDecision 不在此处写入。
            // 工具放行的 deny 决策由 permission-delegate.onToolAccess 在 Engine 进程内回调时写入；
            // 此处看到的 tool_use 事件已经是被允许执行的工具，无需再写一条 allow（噪声）。

            await runFactService.recordEvent({
                tenantId: params.tenantId,
                runId: params.runId,
                eventType: 'tool.invocation.started',
                requestId: params.requestId,
                payloadSummary: {
                    toolUseId,
                    toolName,
                },
            }).catch(() => {});

            this.rememberArtifactCandidate(params.runId, toolUseId, toolName, input);
            return;
        }

        if (type === 'tool_result') {
            const toolUseId = stringValue(event.toolUseId) || stringValue(event.tool_use_id);
            if (!toolUseId) return;
            const isError = Boolean(event.isError || event.is_error);
            const output = event.content ?? event.output;

            await runFactService.recordToolCompleted({
                tenantId: params.tenantId,
                runId: params.runId,
                requestId: params.requestId,
                toolUseId,
                output,
                isError,
            }).catch(error => {
                log.warn('Tool invocation completion record failed', {
                    runId: params.runId,
                    toolUseId,
                    detail: (error as Error).message,
                });
            });

            await runFactService.recordEvent({
                tenantId: params.tenantId,
                runId: params.runId,
                eventType: isError ? 'tool.invocation.failed' : 'tool.invocation.completed',
                requestId: params.requestId,
                payloadSummary: {
                    toolUseId,
                    isError,
                },
            }).catch(() => {});

            if (!isError) {
                await this.recordArtifactFromSuccessfulToolResult({
                    tenantId: params.tenantId,
                    runId: params.runId,
                    userId: params.userId,
                    requestId: params.requestId,
                    toolUseId,
                }).catch(error => {
                    log.warn('Artifact metadata record failed', {
                        runId: params.runId,
                        toolUseId,
                        detail: (error as Error).message,
                    });
                });
            } else {
                this.artifactCandidates.delete(this.artifactCandidateKey(params.runId, toolUseId));
            }

            return;
        }

        if (type === 'stream_event') {
            const streamEvent = recordValue(event.event);
            if (streamEvent.type === 'content_block_delta') {
                await runFactService.recordEvent({
                    tenantId: params.tenantId,
                    runId: params.runId,
                    eventType: 'run.output.delta',
                    requestId: params.requestId,
                    payloadSummary: {channel: 'assistant'},
                }).catch(() => {});
            }
            return;
        }

        if (type === 'assistant') {
            await runFactService.recordEvent({
                tenantId: params.tenantId,
                runId: params.runId,
                eventType: 'run.output.completed',
                requestId: params.requestId,
                payloadSummary: {source: 'assistant'},
            }).catch(() => {});
            return;
        }

        if (type === 'result' && (event.is_error || event.subtype === 'error')) {
            await runFactService.recordEvent({
                tenantId: params.tenantId,
                runId: params.runId,
                eventType: 'run.failed',
                requestId: params.requestId,
                payloadSummary: {
                    message: stringValue(event.message) || 'runtime result error',
                },
            }).catch(() => {});
        }
    }

    private rememberArtifactCandidate(
        runId: string,
        toolUseId: string,
        toolName: string,
        input: Record<string, unknown>,
    ): void {
        if (toolName !== 'Write') return;
        const path = stringValue(input.file_path) || stringValue(input.filePath) || stringValue(input.path);
        if (!path) return;
        this.artifactCandidates.set(this.artifactCandidateKey(runId, toolUseId), {
            path,
            content: stringValue(input.content) ?? '',
            toolName,
        });
    }

    private async recordArtifactFromSuccessfulToolResult(params: {
        tenantId: string;
        runId: string;
        userId?: string | null;
        requestId?: string;
        toolUseId: string;
    }): Promise<void> {
        const key = this.artifactCandidateKey(params.runId, params.toolUseId);
        const candidate = this.artifactCandidates.get(key);
        this.artifactCandidates.delete(key);
        if (!candidate) return;

        const artifact = await artifactEvidenceService.recordRuntimeArtifact({
            tenantId: params.tenantId,
            runId: params.runId,
            userId: params.userId,
            requestId: params.requestId,
            title: candidate.path.split('/').filter(Boolean).pop() || candidate.path,
            storageUri: `workspace://${candidate.path}`,
            content: candidate.content,
            sourceRef: params.toolUseId,
            metadataSummary: {
                path: candidate.path,
                toolName: candidate.toolName,
                toolUseId: params.toolUseId,
            },
        });

        await artifactEvidenceService.recordEvidenceForArtifact({
            tenantId: params.tenantId,
            runId: params.runId,
            userId: params.userId,
            requestId: params.requestId,
            artifactId: artifact.id,
            evidenceType: 'generated_extract',
            sourceSystem: 'runtime_tool',
            sourceUri: artifact.storageUri,
            sourceHash: artifact.sha256,
            metadataSummary: {
                artifactType: artifact.artifactType,
                sourceType: artifact.sourceType,
                toolUseId: params.toolUseId,
            },
        });
    }

    private clearArtifactCandidatesForRun(runId: string): void {
        for (const key of this.artifactCandidates.keys()) {
            if (key.startsWith(`${runId}:`)) {
                this.artifactCandidates.delete(key);
            }
        }
    }

    private artifactCandidateKey(runId: string, toolUseId: string): string {
        return `${runId}:${toolUseId}`;
    }

    private async recordBillingUsage(
        thread: Thread,
        usage: QueryUsageResult,
        ctx: {threadId: string; tenantId: string; agentId: string | null; requestId?: string},
    ): Promise<void> {
        try {
            for (const [model, modelUsage] of Object.entries(usage.modelUsage)) {
                await costAggregator.recordUsage(thread.tenantId, thread.id, thread.userId, {
                    model,
                    inputTokens: modelUsage.inputTokens + modelUsage.cacheReadInputTokens + modelUsage.cacheCreationInputTokens,
                    outputTokens: modelUsage.outputTokens,
                });
            }
        } catch (error) {
            log.warn('Usage billing record failed', {
                ...ctx,
                detail: (error as Error).message,
            });
        }
    }

    private summarizeUsage(usage?: QueryUsageResult): {
        model?: string;
        inputTokens: number;
        outputTokens: number;
    } {
        if (!usage?.modelUsage) {
            return {inputTokens: 0, outputTokens: 0};
        }

        const entries = Object.entries(usage.modelUsage);
        const [firstModel] = entries[0] ?? [];
        return entries.reduce((summary, [model, modelUsage]) => ({
            model: summary.model ?? model,
            inputTokens: summary.inputTokens +
                modelUsage.inputTokens +
                modelUsage.cacheReadInputTokens +
                modelUsage.cacheCreationInputTokens,
            outputTokens: summary.outputTokens + modelUsage.outputTokens,
        }), {
            model: firstModel,
            inputTokens: 0,
            outputTokens: 0,
        } as {model?: string; inputTokens: number; outputTokens: number});
    }

    /**
     * 向 Agent 发送消息 — 自动查找或创建 Thread
     */
    async* dispatchToAgent(
        tenantId: string,
        userId: string,
        agentId: string,
        content: string,
        requestContext?: Omit<ChatRequestContext, 'threadId'>,
    ): AsyncGenerator<ThreadDispatchEvent> {
        // 查找最新的 idle thread
        const threads = await db
            .select()
            .from(sessionsTable)
            .where(
                and(
                    eq(sessionsTable.templateId, agentId),
                    eq(sessionsTable.userId, userId),
                    eq(sessionsTable.tenantId, tenantId),
                    eq(sessionsTable.status, 'idle'),
                ),
            )
            .orderBy(desc(sessionsTable.lastActiveAt))
            .limit(1);

        let threadId: string;

        if (threads.length > 0) {
            threadId = threads[0].id;
        } else {
            // 创建新 thread
            const newThread = await this.create({
                tenantId,
                userId,
                agentId,
            });
            threadId = newThread.id;
        }

        yield* this.dispatch(
            threadId,
            content,
            requestContext ? {...requestContext, threadId} : undefined,
        );
    }

    // ===== 兼容方法 =====

    /**
     * 获取最后一次 Query 的 Usage
     */
    getLastUsage(): QueryUsageResult | null {
        return this.lastUsage;
    }

    /**
     * 获取 Thread 的 workspace 路径
     */
    async getWorkspace(threadId: string): Promise<string | null> {
        const thread = await this.get(threadId);
        return thread?.workspace ?? null;
    }

    /**
     * 基于过滤器查询 Thread — 兼容旧接口
     */
    async listByFilters(filters: {
        tenantId?: string;
        userId?: string;
        agentId?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<ThreadListResult> {
        const conditions = [];

        if (filters.tenantId) {
            conditions.push(eq(sessionsTable.tenantId, filters.tenantId));
        }
        if (filters.userId) {
            conditions.push(eq(sessionsTable.userId, filters.userId));
        }
        if (filters.agentId) {
            conditions.push(eq(sessionsTable.templateId, filters.agentId));
        }
        if (filters.status) {
            conditions.push(eq(sessionsTable.status, filters.status));
        }

        const limit = filters.limit ?? 50;
        const offset = filters.offset ?? 0;

        // 查询总数
        const countResult = await db
            .select({count: sql<number>`count(*)::int`})
            .from(sessionsTable)
            .where(conditions.length > 0 ? and(...conditions) : undefined);

        const count = countResult[0]?.count ?? 0;

        // 查询数据
        const results = await db
            .select()
            .from(sessionsTable)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(sessionsTable.lastActiveAt))
            .limit(limit)
            .offset(offset);

        return {
            data: results.map(r => this.mapToThread(r)),
            meta: {count, limit, offset},
        };
    }

    // ===== 内部方法 =====

    /**
     * 查询 Agent 关联的 Skills
     *
     * @param agentId Agent 模板 ID
     * @returns Skills 列表
     */
    private async fetchAgentSkills(agentId: string): Promise<Skill[]> {
        // 通过 agent_skills 关联表查询
        const agentSkillRelations = await db
            .select({
                skillId: agentSkills.skillId,
            })
            .from(agentSkills)
            .where(eq(agentSkills.agentId, agentId));

        if (agentSkillRelations.length === 0) {
            return [];
        }

        const skillIds = agentSkillRelations.map(r => r.skillId);

        // 查询 skills 表
        const skillsResult = await db
            .select({
                id: skills.id,
                name: skills.name,
                content: skills.content,
            })
            .from(skills)
            .where(and(
                sql`${skills.id} = ANY(${skillIds})`,
                eq(skills.status, 'active'),
            ));

        return skillsResult.map(s => ({
            name: s.name,
            content: s.content || undefined,
        }));
    }

    /**
     * 查询 Agent 关联的 Documents
     *
     * @param agentId Agent 模板 ID
     * @returns Documents 列表（包含内容）
     */
    private async fetchAgentDocuments(agentId: string): Promise<Document[]> {
        const docsResult = await db
            .select({
                id: documentsTable.id,
                name: documentsTable.name,
                type: documentsTable.type,
                path: documentsTable.path,
            })
            .from(documentsTable)
            .where(and(
                eq(documentsTable.templateId, agentId),
                eq(documentsTable.category, 'knowledge'),
            ));

        // 读取文档内容
        const documents: Document[] = [];
        for (const doc of docsResult) {
            try {
                const content = readFileSync(doc.path, 'utf-8');
                documents.push({
                    id: doc.id,
                    name: doc.name,
                    type: doc.type,
                    content,
                });
            } catch (error) {
                // 文件不存在或读取失败，跳过
                log.warn('Document read failed', {path: doc.path, detail: (error as Error).message});
            }
        }

        return documents;
    }

    /**
     * 组装 System Prompt — 核心链路
     *
     * 从多个数据源读取内容，通过 PromptAssembler 拼接为完整的 System Prompt：
     * - Block 1: 平台安全规则（硬编码）
     * - Block 2: Agent 身份（DB: agent_templates.promptConfig.identity）
     * - Block 3: 行为指令（文件: {dataRoot}/agents/{id}/agent.md）
     * - Block 4: 技能（DB: agent_skills + skills 表）
     * - Block 5: 知识库（DB: documents 表 + 文件内容）
     * - Block 6: 工具约束（DB: agent_templates.promptConfig.toolInstructions）
     *
     * 组装后的 prompt 传给 Engine，Engine 会在前面追加 CC 框架前缀
     */
    private async assembleSystemPromptForAgent(
        template: any,
        agentId: string,
        tenantId: string,
        options?: { excludeIdentity?: boolean },
    ): Promise<string> {
        // 并行查询 skills 和 documents（减少 DB 等待时间）
        const [fetchedSkills, fetchedDocuments] = await Promise.all([
            this.fetchAgentSkills(agentId),
            this.fetchAgentDocuments(agentId),
        ]);
        log.debug('Prompt 数据源加载完成', {
            agentId,
            skillsCount: fetchedSkills.length,
            documentsCount: fetchedDocuments.length,
        });

        // 读取 agent.md 行为指令（文件系统）
        const agentInstructions = this.loadAgentInstructions(tenantId, agentId);
        if (agentInstructions) {
            log.debug('agent.md 行为指令已加载', { agentId, instructionsLength: agentInstructions.length });
        }

        // 转换为 PromptAssembler 需要的格式
        const assemblerTemplate: PromptAssemblerTemplate = {
            systemPrompt: template.systemPrompt,
            promptConfig: template.promptConfig,
            tools: template.tools as string[] | undefined,
            mcpServers: template.mcpServers as Array<{ name: string; url: string }> | undefined,
        };

        // 调用 PromptAssembler 组装最终 prompt
        return assembleSystemPrompt({
            template: assemblerTemplate,
            skills: fetchedSkills,
            documents: fetchedDocuments,
            agentInstructions,
            excludeIdentity: options?.excludeIdentity,
        });
    }

    /**
     * 读取 Agent 行为指令文件（agent.md）
     *
     * 路径: {dataRoot}/tenants/{tenantId}/agents/{agentId}/agent.md
     * 文件不存在时返回空字符串（优雅降级）
     */
    private loadAgentInstructions(tenantId: string, agentId: string): string {
        const filePath = resolve(this.dataRoot, 'tenants', tenantId, 'agents', agentId, 'agent.md');
        if (!existsSync(filePath)) return '';

        try {
            const content = readFileSync(filePath, 'utf-8');
            const maxChars = 20000; // ~5000 tokens
            if (content.length > maxChars) {
                return content.slice(0, maxChars) + '\n\n... [instructions truncated]';
            }
            return content;
        } catch {
            return '';
        }
    }

    /**
     * 映射数据库行到 Thread 类型
     */
    private mapToThread(row: any): Thread {
        return {
            id: row.id,
            tenantId: row.tenantId,
            userId: row.userId,
            templateId: row.templateId,
            status: row.status,
            title: row.title,
            summary: row.summary,
            workspace: row.workspace,
            lastActiveAt: row.lastActiveAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
}

function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value ? value : undefined;
}

function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

/**
 * 单例实例（延迟初始化）
 * dataRoot 可通过 DATA_ROOT 环境变量覆盖（测试环境使用）
 * engineFactory 仅在 NEPTUNE_LLM_API_KEY 存在时注入（测试环境不需要）
 */
let _threadManager: ThreadManager | null = null;

export function getThreadManager(): ThreadManager {
    if (!_threadManager) {
        // 仅在 NEPTUNE_LLM_API_KEY 存在时注入 EngineFactory
        // 测试环境不需要真实 Engine，dispatch() 会因缺少 factory 而抛错
        let engineFactory: EngineFactory | undefined;
        const engineMode = process.env.NEPTUNE_ENGINE_MODE || process.env.NEPTUNE_ENGINE_DRIVER;
        const useControlledEngine = engineMode === 'controlled' || process.env.NEPTUNE_MOCK_LLM === '1';

        if (useControlledEngine) {
            try {
                const {ControlledEngineFactory} = require('./controlled-engine-factory.js') as typeof import('./controlled-engine-factory.js');
                engineFactory = new ControlledEngineFactory();
                log.info('Controlled EngineFactory enabled');
            } catch (error) {
                log.warn('Controlled EngineFactory load failed, dispatch unavailable', {
                    detail: (error as Error).message,
                });
            }
        }

        const apiKey = process.env.NEPTUNE_LLM_API_KEY;
        if (!engineFactory && apiKey) {
            // 动态 import 避免测试环境加载 @neptune/engine 模块
            try {
                const {ClaudeCodeEngineFactory} = require('./engine-factory.js') as typeof import('./engine-factory.js');
                engineFactory = new ClaudeCodeEngineFactory({
                    apiKey,
                    baseURL: process.env.NEPTUNE_LLM_BASE_URL,
                    defaultModel: process.env.NEPTUNE_LLM_MODEL,
                });
            } catch {
                log.warn('EngineFactory load failed, dispatch unavailable');
            }
        }

        _threadManager = new ThreadManager({
            dataRoot: resolve(process.env.DATA_ROOT || DEFAULT_DATA_ROOT),
            engineFactory,
        });
    }
    return _threadManager;
}

/**
 * 重置单例（仅用于测试）
 */
export function resetThreadManager(): void {
    _threadManager = null;
}

/**
 * 便捷导出 — 使用 getter 确保延迟初始化
 */
export const threadManager = new Proxy({} as ThreadManager, {
    get(_, prop) {
        return (getThreadManager() as any)[prop];
    },
});
