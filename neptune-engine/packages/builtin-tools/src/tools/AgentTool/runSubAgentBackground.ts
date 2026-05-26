/**
 * runSubAgentBackground — async background sub-agent launch（P0.3a 协议化）
 *
 * 设计目的：
 * - cc 用 LocalAgentTask 807 行业务实现 background sub-agent；
 *   substrate 用 TaskQueue + RunStore + AgentLoop.runWithStore 协议组合替代（~80 行）
 * - 立即返回 { agentId, runId, taskId }，sub-agent 后台异步跑
 * - 完成 / 失败 / 取消都通过 TaskQueue.update 反映状态
 * - events 持久化到 RunStore，cross-instance resume 友好
 *
 * 与 cc 行为对齐：
 * - launched 立即返（caller 不阻塞）
 * - 后台 promise 跑 sub-agent，错误捕获更新 task.status
 * - 取消信号联动：parent abort → background controller abort
 *
 * 协议替代证明（与 cc LocalAgentTask 同等能力）：
 * - 立即返回 launched ✓ (resolve agentId/runId/taskId 即返)
 * - 后台 messages 实时持久化 ✓ (runWithStore appendEvent 每个 LoopEvent)
 * - 进度查询 ✓ (TaskQueue.get(taskId) + RunStore.loadEvents(runId))
 * - 完成通知 ✓ (TaskQueue.update + RunStore.updateStatus + ctx.hooks)
 * - 取消 ✓ (controller.abort + TaskQueue.update status='cancelled')
 * - Result 文件路径 ✓ (RunStore 内 events.jsonl 路径 / metadata.outputFile)
 * - Partial result 提取 ✓ (RunStore.loadSnapshot 重建 messages → extractPartialResult)
 */

import {randomUUID} from 'crypto'
import type {
	AgentManifest,
	AgentLoopParams,
	LoopEvent,
	Message,
	RunStore,
	StreamingProviderAdapter,
	TaskQueue,
	ToolUseContext as EngineToolUseContext,
	UsageSnapshot,
	Tool as EngineTool,
} from '@neptune/engine'
import {AgentLoop, EMPTY_USAGE} from '@neptune/engine'
import type {Tool} from '../../tool.js'

// ============================================================
// 类型
// ============================================================

export interface RunSubAgentBackgroundInput {
	manifest: AgentManifest
	prompt: string
	model: string
	provider: StreamingProviderAdapter
	parentSignal?: AbortSignal
	tools: Tool[]
	parentContext: EngineToolUseContext
	agentId: string
	startTime: number
	maxTurns?: number
	/** RunStore（必传 — async 路径强依赖）。 */
	runStore: RunStore
	/** TaskQueue（可选 — 注入后任务可被其他 agent 查询）。 */
	taskQueue?: TaskQueue
	/** Caller 标识（task.createdBy / agentContext）。 */
	createdBy?: string
	/** 任务描述（caller 提供给 LLM 看的简短说明）。 */
	description?: string
}

export interface AsyncLaunchResult {
	agentId: string
	runId: string
	taskId?: string
	/** 如果 RunStore 有持久化路径，可以暴露给 caller（caller 自决怎么读）。 */
	outputFileHint?: string
	/** 后台 promise（caller 通常不 await，但测试场景可以 await 等完成）。 */
	background: Promise<BackgroundResult>
}

export interface BackgroundResult {
	reason: string
	finalMessages: Message[]
	cumulativeUsage: UsageSnapshot
	totalToolUseCount: number
	error?: Error
}

// ============================================================
// 主函数
// ============================================================

export async function launchSubAgentInBackground(
	input: RunSubAgentBackgroundInput,
): Promise<AsyncLaunchResult> {
	const {
		manifest,
		prompt,
		model,
		provider,
		parentSignal,
		tools,
		parentContext,
		agentId,
		startTime,
		maxTurns,
		runStore,
		taskQueue,
		createdBy,
		description,
	} = input

	// 1. 创建 RunStore.run（先于 TaskQueue 创建，让 task.metadata 可携带 runId）
	const run = await runStore.create({
		metadata: {
			agentId,
			agentType: manifest.type,
			parentRunId: (parentContext as {runId?: string}).runId,
			...(description !== undefined && {description}),
			startTime,
		},
	})
	const runId = run.id

	// 2. 创建 TaskQueue.task（可选）
	let taskId: string | undefined
	if (taskQueue) {
		const task = await taskQueue.create({
			title: description ?? `agent:${manifest.type}`,
			...(description !== undefined && {description}),
			createdBy: createdBy ?? 'parent',
			metadata: {
				agentId,
				runId,
				agentType: manifest.type,
				kind: 'sub-agent-background',
			},
		})
		taskId = task.id
	}

	// 3. 独立 child controller（与同步 spawn 路径相同）
	const childController = new AbortController()
	const onParentAbort = (): void => {
		if (!childController.signal.aborted) childController.abort()
	}
	if (parentSignal) {
		if (parentSignal.aborted) {
			childController.abort()
		} else {
			parentSignal.addEventListener('abort', onParentAbort, {once: true})
		}
	}

	// 4. 构造 sub-agent context（继承 parent kernel bag）
	const subContext: EngineToolUseContext = {
		...parentContext,
		abortController: childController,
		agentId,
		options: {
			...parentContext.options,
			tools: tools as unknown as EngineTool[],
		},
	}

	// 5. 用户消息
	const userMessage: Message = {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'user', content: prompt},
	}

	// 6. AgentLoopParams
	const loopParams: AgentLoopParams = {
		messages: [userMessage],
		systemPrompt: manifest.systemPrompt,
		tools: tools as unknown as EngineTool[],
		model,
		signal: childController.signal,
		context: subContext,
		provider,
		runStore,
		runId,
		...(maxTurns !== undefined && {maxTurns}),
	}

	// 7. fire-and-forget background promise
	const background = (async (): Promise<BackgroundResult> => {
		const messages: Message[] = []
		let cumulativeUsage: UsageSnapshot = {...EMPTY_USAGE}
		let reason = 'end_turn'
		let toolUseCount = 0
		let bgError: Error | undefined
		try {
			const gen = AgentLoop.runWithStore(loopParams)
			while (true) {
				const next = await gen.next()
				if (next.done) {
					const r = next.value
					reason = r.reason
					cumulativeUsage = r.cumulativeUsage
					if (r.error) bgError = r.error
					messages.push(...r.finalMessages)
					break
				}
				const event = next.value as LoopEvent
				if (event.type === 'tool_update' && event.update.kind === 'started') {
					toolUseCount++
				}
			}
		} catch (err) {
			bgError = err instanceof Error ? err : new Error(String(err))
			reason = 'error'
		} finally {
			// 解绑 signal listener
			if (parentSignal) {
				try {
					parentSignal.removeEventListener('abort', onParentAbort)
				} catch {
					// ignore
				}
			}
			// TaskQueue 状态更新（best-effort）
			if (taskQueue && taskId) {
				try {
					const status =
						reason === 'end_turn' || reason === 'stop_sequence'
							? 'completed'
							: reason === 'aborted'
								? 'cancelled'
								: 'failed'
					await taskQueue.update(taskId, {
						status,
						output: {
							summary: bgError ? bgError.message : `agent:${manifest.type} ${reason}`,
							metadata: {
								reason,
								totalToolUseCount: toolUseCount,
								usage: cumulativeUsage,
								durationMs: Date.now() - startTime,
							},
						},
					})
				} catch {
					// task 更新失败不阻断
				}
			}
		}
		return {
			reason,
			finalMessages: messages,
			cumulativeUsage,
			totalToolUseCount: toolUseCount,
			...(bgError && {error: bgError}),
		}
	})()

	// 把背景 error 静默吃掉（避免 UnhandledPromiseRejection）— caller 通过 TaskQueue/RunStore 查
	background.catch(() => {
		// 已经在 finally 中更新过 task status，error 不再传播
	})

	return {
		agentId,
		runId,
		...(taskId !== undefined && {taskId}),
		outputFileHint: `runStore:${runId}/events.jsonl`,
		background,
	}
}
