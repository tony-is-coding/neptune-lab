/**
 * probe-opencode-go.ts — 验证 substrate AnthropicStreamingProvider 能否接入 OpenCode Go
 *
 * 这是一个最小验证脚本，跑 1 次 LLM 调用，输出协议层面的诊断信息：
 * - 认证 header 是否正确
 * - SSE 事件是否能被 ParsedSSEEvent 正确解析
 * - response 是否含真 LLM 输出文本
 *
 * 用法：
 *   OPENCODE_API_KEY=oc-... bun run scripts/probe-opencode-go.ts
 *
 * 可选：
 *   MODEL=qwen3.5-plus bun run scripts/probe-opencode-go.ts  # 默认 minimax-m2.7
 */

import {randomUUID} from 'crypto'
import {AnthropicStreamingProvider} from '../src/engine/agent-loop/provider/AnthropicStreamingProvider.js'
import type {Message} from '../src/engine/types/message.js'

const apiKey = process.env.OPENCODE_API_KEY || process.env.AUTH_TOKEN
if (!apiKey) {
	console.error('❌ Set OPENCODE_API_KEY=oc-... (or AUTH_TOKEN=...)')
	process.exit(1)
}

const model = process.env.MODEL || 'minimax-m2.7'
const baseURL = process.env.BASE_URL || 'https://opencode.ai/zen/go/v1'

console.log('==> probe config')
console.log(`    BASE_URL  = ${baseURL}`)
console.log(`    MODEL     = ${model}`)
console.log(`    AUTH_MODE = Bearer (authToken via Anthropic SDK)`)
console.log(`    KEY       = ${apiKey.slice(0, 6)}... (len=${apiKey.length})`)
console.log('')

const provider = new AnthropicStreamingProvider({
	authToken: apiKey,
	baseURL,
	defaultModel: model,
})

const userMessage: Message = {
	type: 'user',
	uuid: randomUUID() as unknown as Message['uuid'],
	message: {role: 'user', content: 'Reply with exactly one word: hello'},
}

console.log('==> sending one-turn request, parsing SSE events...')
console.log('')

let eventCount = 0
let textChunks: string[] = []
let saw_message_start = false
let saw_message_stop = false
let errorEvent: unknown = null

try {
	for await (const event of provider.queryStream({
		model,
		messages: [userMessage],
		systemPrompt: 'You are a probe. Reply concisely.',
		maxTokens: 100,
	})) {
		eventCount++
		console.log(`[event #${eventCount}] type=${event.type}`)

		if (event.type === 'message_start') {
			saw_message_start = true
			const msg = (event as Record<string, unknown>).message as Record<string, unknown>
			console.log(`    model=${msg?.model}  id=${msg?.id}`)
		} else if (event.type === 'content_block_complete') {
			const block = (event as Record<string, unknown>).block as Record<string, unknown>
			if (block?.type === 'text') {
				textChunks.push(String(block.text ?? ''))
				console.log(`    text="${block.text}"`)
			} else {
				console.log(`    block.type=${block?.type}`)
			}
		} else if (event.type === 'message_delta') {
			const usage = (event as Record<string, unknown>).usage as Record<string, unknown> | undefined
			console.log(`    stop_reason=${(event as Record<string, unknown>).stop_reason}  usage=${JSON.stringify(usage)}`)
		} else if (event.type === 'message_stop') {
			saw_message_stop = true
		} else if (event.type === 'error') {
			errorEvent = event
			const err = (event as Record<string, unknown>).error as Error | undefined
			console.log(`    ❌ ERROR: ${err?.message ?? '(no message)'}`)
			console.log(`    full event: ${JSON.stringify(event, (_k, v) => v instanceof Error ? {name: v.name, message: v.message, stack: v.stack?.split('\n').slice(0, 5).join('\n')} : v, 2)}`)
		}
	}
} catch (err) {
	console.log(`❌ unexpected throw: ${err instanceof Error ? err.message : String(err)}`)
	process.exit(2)
}

console.log('')
console.log('==> verdict')
console.log(`    events received: ${eventCount}`)
console.log(`    saw message_start: ${saw_message_start}`)
console.log(`    saw message_stop:  ${saw_message_stop}`)
console.log(`    text output:       "${textChunks.join('')}"`)
console.log(`    error event:       ${errorEvent ? 'yes' : 'no'}`)

if (errorEvent) {
	console.log('')
	console.log('❌ probe FAILED — provider yielded error event')
	console.log('   常见原因：')
	console.log('   - 401: API key 无效或未订阅')
	console.log('   - 404: model 名错误，请确认是 anthropic-compat 模型')
	console.log('   - 协议不匹配：OpenCode Go 该 model 可能不走 anthropic 协议')
	process.exit(3)
}

if (!saw_message_start || !saw_message_stop) {
	console.log('')
	console.log('⚠️  probe PARTIAL — 缺少 message_start 或 message_stop 事件，SSE 协议可能与 Anthropic 不完全一致')
	process.exit(4)
}

if (textChunks.join('').trim().length === 0) {
	console.log('')
	console.log('⚠️  probe PARTIAL — 收到事件但无文本输出')
	process.exit(5)
}

console.log('')
console.log('✅ probe PASS — substrate AnthropicStreamingProvider 与 OpenCode Go 端到端兼容')
