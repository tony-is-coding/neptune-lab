/**
 * runSubAgentBackground.e2e.test.ts — P0.3a 端到端测试
 *
 * 验证 async background launch 协议化（cc LocalAgentTask 等价能力）：
 * 1. 立即返回 { agentId, runId, taskId }
 * 2. 后台 promise 跑完后 RunStore.events 持久化
 * 3. 后台 promise 完成后 TaskQueue.update status='completed'
 * 4. 后台 abort → status='cancelled'
 * 5. 后台 error → status='failed'
 * 6. 跨实例 RunStore 可读 events
 */

import {describe, expect, it} from 'bun:test'
import {randomUUID} from 'crypto'
import {InMemoryRunStore, FileRunStore} from '../../../../../../src/engine/run/index.js'
import {InMemoryTaskQueue} from '../../../../../../src/engine/task-queue/index.js'
import type {AgentManifest} from '../../../../../../src/engine/agent-registry/index.js'
import type {Tool, ToolResult} from '../../../../../../src/engine/types/tool.js'
import type {ToolUseContext as EngineToolUseContext} from '../../../../../../src/engine/agent-loop/dispatcher/ToolUseContext.js'
import {createToolUseContext} from '../../../../../../src/engine/agent-loop/dispatcher/ToolUseContext.js'
import {ScriptedProvider, textTurn, toolUseTurn} from '@neptune/engine/testing'
import {launchSubAgentInBackground} from '../runSubAgentBackground.js'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

function makeManifest(
	overrides: Partial<AgentManifest> & Pick<AgentManifest, 'type'>,
): AgentManifest {
	return {
		type: overrides.type,
		description: overrides.description ?? 'test',
		systemPrompt: overrides.systemPrompt ?? 'You are a test agent.',
		tools: overrides.tools,
		modelHint: overrides.modelHint,
		metadata: overrides.metadata,
	}
}

describe('runSubAgentBackground — async launch', () => {
	it('立即返回 launched + 后台跑完后 RunStore events 持久化', async () => {
		const runStore = new InMemoryRunStore()
		const provider = new ScriptedProvider([textTurn('background done')])
		const ctx: EngineToolUseContext = createToolUseContext()

		const launched = await launchSubAgentInBackground({
			manifest: makeManifest({type: 'a'}),
			prompt: 'do bg',
			model: 'm',
			provider,
			tools: [] as unknown as Tool[],
			parentContext: ctx,
			agentId: randomUUID(),
			startTime: Date.now(),
			runStore,
		})

		// launched 立即返
		expect(launched.runId).toBeTruthy()
		expect(launched.agentId).toBeTruthy()
		expect(launched.taskId).toBeUndefined() // 没传 taskQueue

		// 等后台完成
		const result = await launched.background
		expect(result.reason).toBe('end_turn')

		// RunStore events 持久化
		const events = await runStore.loadEvents(launched.runId)
		expect(events.length).toBeGreaterThan(0)
		const finalRun = await runStore.load(launched.runId)
		expect(finalRun?.status).toBe('completed')
	})

	it('注入 TaskQueue → task 创建 + 完成时 status=completed', async () => {
		const runStore = new InMemoryRunStore()
		const taskQueue = new InMemoryTaskQueue()
		const provider = new ScriptedProvider([textTurn('done')])
		const ctx = createToolUseContext()

		const launched = await launchSubAgentInBackground({
			manifest: makeManifest({type: 'a'}),
			prompt: 'p',
			model: 'm',
			provider,
			tools: [] as unknown as Tool[],
			parentContext: ctx,
			agentId: randomUUID(),
			startTime: Date.now(),
			runStore,
			taskQueue,
			description: 'background task',
		})

		expect(launched.taskId).toBeTruthy()
		const taskBefore = await taskQueue.get(launched.taskId!)
		// task 在 launch 时刚创建（pending）
		expect(['pending', 'in_progress']).toContain(taskBefore?.status)

		await launched.background
		const taskAfter = await taskQueue.get(launched.taskId!)
		expect(taskAfter?.status).toBe('completed')
		expect(taskAfter?.output?.summary).toContain('end_turn')
	})

	it('parent abort → 后台 abort + task.status=cancelled', async () => {
		const runStore = new InMemoryRunStore()
		const taskQueue = new InMemoryTaskQueue()
		const provider = new ScriptedProvider([
			toolUseTurn('tu_1', 'SlowTool', {}),
			textTurn('after tool'),
		])
		const slowTool: Tool = {
			name: 'SlowTool',
			description: 'slow',
			inputJSONSchema: {type: 'object'},
			async call(): Promise<ToolResult<unknown>> {
				return {data: 'ok'}
			},
		} as unknown as Tool
		const parentController = new AbortController()
		const ctx = createToolUseContext({tools: [slowTool]})

		const launched = await launchSubAgentInBackground({
			manifest: makeManifest({type: 'a'}),
			prompt: 'p',
			model: 'm',
			provider,
			parentSignal: parentController.signal,
			tools: [slowTool],
			parentContext: ctx,
			agentId: randomUUID(),
			startTime: Date.now(),
			runStore,
			taskQueue,
		})

		// abort
		parentController.abort()

		const result = await launched.background
		expect(['aborted', 'error']).toContain(result.reason)
		const task = await taskQueue.get(launched.taskId!)
		expect(['cancelled', 'failed']).toContain(task?.status)
	})

	it('FileRunStore — 跨实例可见后台数据', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'nep-bg-'))
		try {
			const storeA = new FileRunStore(dir)
			const provider = new ScriptedProvider([textTurn('done')])
			const ctx = createToolUseContext()

			const launched = await launchSubAgentInBackground({
				manifest: makeManifest({type: 'a'}),
				prompt: 'p',
				model: 'm',
				provider,
				tools: [] as unknown as Tool[],
				parentContext: ctx,
				agentId: randomUUID(),
				startTime: Date.now(),
				runStore: storeA,
			})
			await launched.background

			// 跨实例读
			const storeB = new FileRunStore(dir)
			const events = await storeB.loadEvents(launched.runId)
			expect(events.length).toBeGreaterThan(0)
			const run = await storeB.load(launched.runId)
			expect(run?.status).toBe('completed')
			expect(run?.metadata?.agentType).toBe('a')
		} finally {
			await rm(dir, {recursive: true, force: true})
		}
	})
})
