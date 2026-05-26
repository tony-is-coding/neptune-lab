/**
 * sdk-with-fs-store.ts — SDK + FileRunStore（state 外化 + resume 验证）
 *
 * 用法：
 *   # 第一次跑：创建新 run（真 API）
 *   ANTHROPIC_API_KEY=sk-ant-... MODEL=claude-sonnet-4-20250514 bun run examples/sdk-with-fs-store.ts
 *   # → 输出 runId
 *
 *   # 用同 runId resume
 *   ANTHROPIC_API_KEY=sk-ant-... MODEL=claude-sonnet-4-20250514 \
 *     bun run examples/sdk-with-fs-store.ts --resume <runId>
 *
 *   # CI / 离线 smoke（0 API 消耗）
 *   USE_SCRIPTED_PROVIDER=true bun run examples/sdk-with-fs-store.ts
 */

import {randomUUID} from 'crypto'
import {AgentLoop} from '../src/engine/agent-loop/loop/AgentLoop.js'
import {createToolUseContext} from '../src/engine/agent-loop/dispatcher/ToolUseContext.js'
import {FileRunStore} from '../src/engine/run/index.js'
import type {Message} from '../src/engine/types/message.js'
import {resolveProvider} from './_provider.js'

const {provider, model} = resolveProvider()
const ctx = createToolUseContext()
const store = new FileRunStore('./runs')

const resumeIdx = process.argv.indexOf('--resume')
const isResume = resumeIdx >= 0 && process.argv[resumeIdx + 1]

if (isResume) {
	const runId = process.argv[resumeIdx + 1]!
	console.log(`[resume] runId=${runId}`)
	const gen = AgentLoop.resume(runId, {
		provider,
		model,
		context: ctx,
		runStore: store,
	})
	for await (const event of gen) {
		if (event.type === 'assistant_message') {
			console.log('[assistant]', summarize(event.message.message?.content))
		}
	}
	console.log(`[done] run dir: ./runs/${runId}/`)
} else {
	const run = await store.create({metadata: {label: 'demo', startedAt: Date.now()}})
	console.log(`[start] runId=${run.id}`)

	const userMessage: Message = {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'user', content: 'List 3 prime numbers under 20.'},
	}

	const gen = AgentLoop.runWithStore({
		provider,
		model,
		messages: [userMessage],
		context: ctx,
		runStore: store,
		runId: run.id,
	})

	for await (const event of gen) {
		if (event.type === 'assistant_message') {
			console.log('[assistant]', summarize(event.message.message?.content))
		}
	}

	console.log(`[done] run dir: ./runs/${run.id}/`)
	console.log(`[hint] resume with: bun run examples/sdk-with-fs-store.ts --resume ${run.id}`)
}

function summarize(content: unknown): string {
	if (typeof content === 'string') return content.slice(0, 200)
	if (Array.isArray(content)) {
		return content
			.map((b: {type?: string; text?: string}) => (b.type === 'text' ? b.text : `[${b.type}]`))
			.join(' ')
			.slice(0, 200)
	}
	return JSON.stringify(content).slice(0, 200)
}
