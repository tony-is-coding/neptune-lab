/**
 * sdk-with-server.ts — SDK + 极简 HTTP server（state 外化 + SSE 流）
 *
 * 用 Node 内建 http 模块，0 外部 deps。
 *
 * 端点：
 *   POST /runs            { prompt } → 创建 run，后台异步跑
 *                                       响应 { runId }
 *   GET  /runs/:id        → 返回 run.json + events 数量
 *   GET  /runs/:id/events → SSE 流：实时 yield events（含历史 + 新）
 *
 * 用法：
 *   ANTHROPIC_API_KEY=sk-... bun run examples/sdk-with-server.ts
 *   curl -X POST http://localhost:3000/runs -d '{"prompt":"hello"}'
 *   curl http://localhost:3000/runs/<runId>/events
 */

import {createServer, type IncomingMessage, type ServerResponse} from 'node:http'
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

const port = parseInt(process.env.PORT ?? '3000', 10)
const provider = new AnthropicStreamingProvider({apiKey})
const store = new FileRunStore('./runs')

async function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = []
		req.on('data', (c: Buffer) => chunks.push(c))
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
		req.on('error', reject)
	})
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
	res.writeHead(status, {'Content-Type': 'application/json'})
	res.end(JSON.stringify(body))
}

async function runInBackground(runId: string, prompt: string): Promise<void> {
	const userMessage: Message = {
		type: 'user',
		uuid: randomUUID() as unknown as Message['uuid'],
		message: {role: 'user', content: prompt},
	}
	const ctx = createToolUseContext()
	const gen = AgentLoop.runWithStore({
		provider,
		model: 'claude-sonnet-4-20250514',
		messages: [userMessage],
		context: ctx,
		runStore: store,
		runId,
	})
	try {
		// 消费 generator，让 events 持久化（不需要返给 caller）
		for await (const _e of gen) {
			// 持久化由 runWithStore 内部完成
		}
	} catch (err) {
		console.error(`[run ${runId}] error:`, err)
	}
}

const server = createServer(async (req, res) => {
	const url = new URL(req.url ?? '/', `http://localhost:${port}`)

	// POST /runs
	if (req.method === 'POST' && url.pathname === '/runs') {
		try {
			const body = JSON.parse(await readBody(req)) as {prompt?: string}
			if (!body.prompt) return sendJson(res, 400, {error: 'prompt required'})
			const run = await store.create({metadata: {prompt: body.prompt}})
			void runInBackground(run.id, body.prompt)
			return sendJson(res, 200, {runId: run.id})
		} catch (err) {
			return sendJson(res, 500, {error: String(err)})
		}
	}

	// GET /runs/:id
	const runMatch = url.pathname.match(/^\/runs\/([^/]+)$/)
	if (req.method === 'GET' && runMatch) {
		const runId = runMatch[1]!
		const run = await store.load(runId)
		if (!run) return sendJson(res, 404, {error: 'not found'})
		const events = await store.loadEvents(runId)
		return sendJson(res, 200, {run, eventCount: events.length})
	}

	// GET /runs/:id/events (SSE)
	const eventsMatch = url.pathname.match(/^\/runs\/([^/]+)\/events$/)
	if (req.method === 'GET' && eventsMatch) {
		const runId = eventsMatch[1]!
		res.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
		})
		// 把已有 events 全部冲刷，然后 poll 新的
		let cursor = 0
		const interval = setInterval(async () => {
			try {
				const events = await store.loadEvents(runId, {fromIndex: cursor})
				for (const event of events) {
					res.write(`data: ${JSON.stringify(event)}\n\n`)
				}
				cursor += events.length
				const run = await store.load(runId)
				if (run && (run.status === 'completed' || run.status === 'failed' || run.status === 'aborted')) {
					res.write(`event: done\ndata: ${JSON.stringify(run)}\n\n`)
					clearInterval(interval)
					res.end()
				}
			} catch (err) {
				clearInterval(interval)
				res.end()
			}
		}, 250)
		req.on('close', () => clearInterval(interval))
		return
	}

	sendJson(res, 404, {error: 'not found'})
})

server.listen(port, () => {
	console.log(`[server] listening on http://localhost:${port}`)
	console.log(`  POST /runs            { prompt } → { runId }`)
	console.log(`  GET  /runs/:id        → { run, eventCount }`)
	console.log(`  GET  /runs/:id/events → SSE stream`)
})
