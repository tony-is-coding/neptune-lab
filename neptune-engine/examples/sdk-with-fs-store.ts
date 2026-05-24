/**
 * sdk-with-fs-store.ts — SDK + FileRunStore（state 外化 + resume 验证）
 *
 * 用法：
 *   # 第一次跑：创建新 run
 *   ANTHROPIC_API_KEY=sk-... bun run examples/sdk-with-fs-store.ts
 *   # → 输出 runId
 *
 *   # 用同 runId resume
 *   ANTHROPIC_API_KEY=sk-... bun run examples/sdk-with-fs-store.ts --resume <runId>
 */

import {randomUUID} from 'crypto'
import {AgentLoop} from '../src/engine/agent-loop/loop/AgentLoop.js'
import {AnthropicStreamingProvider} from '../src/engine/agent-loop/provider/AnthropicStreamingProvider.js'
import {createToolUseContext} from '../src/engine/agent-loop/dispatcher/ToolUseContext.js'
import {FileRunStore} from '../src/engine/run/index.js'
import type {Message} from '../src/engine/types/message.js'

const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) {
	console.error('Set ANTHROPIC_API_KEY env var')
	process.exit(1)
}

const provider = new AnthropicStreamingProvider({apiKey})
const ctx = createToolUseContext()
const store = new FileRunStore('./runs')

const resumeIdx = process.argv.indexOf('--resume')
const isResume = resumeIdx >= 0 && process.argv[resumeIdx + 1]

if (isResume) {
	const runId = process.argv[resumeIdx + 1]!
	console.log(`[resume] runId=${runId}`)
	const gen = AgentLoop.resume(runId, {
		provider,
		model: 'claude-sonnet-4-20250514',
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
		model: 'claude-sonnet-4-20250514',
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
