/**
 * probe-anthropic-compat.ts — 验证 substrate AnthropicStreamingProvider
 *                            与任意 anthropic-compatible 端点的协议兼容性
 *
 * 跑 1 次 LLM 调用，输出协议层面的诊断信息：
 * - 认证 header 是否正确
 * - SSE 事件能否被 ParsedSSEEvent 正确解析
 * - response 是否含真 LLM 输出文本
 *
 * 配置（与 examples/_provider.ts 一致的 3 类正交 env）：
 *   AUTH_MODE=apikey|bearer       (默认 apikey)
 *   API_KEY=... 或 AUTH_TOKEN=...
 *   BASE_URL=...                  (可选，缺省走 Anthropic 官方)
 *   MODEL=...                     (必填)
 *
 * 也接受 Anthropic SDK 标准 env（ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN /
 * ANTHROPIC_BASE_URL），方便 0 改动接入 cc-switch / claude code 等已有工具链。
 *
 * 用法示例：
 *   # Anthropic 官方
 *   AUTH_MODE=apikey API_KEY=<api-key> MODEL=claude-sonnet-4-20250514 \
 *     bun run scripts/probe-anthropic-compat.ts
 *
 *   # 自定义 anthropic-compatible 端点 (x-api-key)
 *   API_KEY=... BASE_URL=https://your-proxy/anthropic MODEL=... \
 *     bun run scripts/probe-anthropic-compat.ts
 *
 *   # Bearer 认证网关
 *   AUTH_MODE=bearer AUTH_TOKEN=... BASE_URL=https://gateway/v1 MODEL=... \
 *     bun run scripts/probe-anthropic-compat.ts
 */

import {randomUUID} from 'crypto'
import type {Message} from '../src/engine/types/message.js'
import {resolveProvider} from '../examples/_provider.js'

// resolveProvider 处理所有 env 解析与错误提示
const {provider, model, scripted} = resolveProvider()

if (scripted) {
	console.error('❌ Probe 是真协议探针，不应启用 USE_SCRIPTED_PROVIDER。')
	console.error('   请改用 examples scripted smoke：bash scripts/smoke-scripted.sh')
	process.exit(1)
}

console.log('==> probe config')
console.log(`    BASE_URL  = ${process.env.BASE_URL || process.env.ANTHROPIC_BASE_URL || '(default Anthropic)'}`)
console.log(`    MODEL     = ${model}`)
console.log(`    AUTH_MODE = ${(process.env.AUTH_MODE || 'apikey').toLowerCase()}`)
console.log('')

const userMessage: Message = {
	type: 'user',
	uuid: randomUUID() as unknown as Message['uuid'],
	// content blocks 数组形式（部分严格 anthropic-compat 网关只接受此形式；
	//  Anthropic 官方两种都接受，统一用数组形式覆盖最广兼容性）
	message: {role: 'user', content: [{type: 'text', text: 'Reply with exactly one word: hello'}]} as never,
}

console.log('==> sending one-turn request, parsing SSE events...')
console.log('')

let eventCount = 0
const textChunks: string[] = []
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
console.log(`    events received:   ${eventCount}`)
console.log(`    saw message_start: ${saw_message_start}`)
console.log(`    saw message_stop:  ${saw_message_stop}`)
console.log(`    text output:       "${textChunks.join('')}"`)
console.log(`    error event:       ${errorEvent ? 'yes' : 'no'}`)

if (errorEvent) {
	console.log('')
	console.log('❌ probe FAILED — provider yielded error event')
	console.log('   常见原因：')
	console.log('   - 401: 认证值无效或权限不足')
	console.log('   - 404: model 名错误，或端点路径不匹配 anthropic 协议')
	console.log('   - 协议不匹配：上游模型可能不走 anthropic 协议（比如只支持 OpenAI Chat Completions）')
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
console.log('✅ probe PASS — substrate AnthropicStreamingProvider 与目标端点协议兼容')
