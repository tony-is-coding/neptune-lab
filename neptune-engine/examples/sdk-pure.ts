/**
 * sdk-pure.ts — 纯 SDK 调用（in-process，无 store，无 server）
 *
 * Provider 配置完全由 env 注入，见 _provider.ts 的 ASCII 全景图与场景示例。
 *
 * 快速用法：
 *   # 真 API（任意 anthropic-compatible 端点）
 *   API_KEY=... [BASE_URL=...] MODEL=... bun run examples/sdk-pure.ts
 *
 *   # CI / 离线 smoke（0 API 消耗）
 *   USE_SCRIPTED_PROVIDER=true bun run examples/sdk-pure.ts
 */

import {randomUUID} from 'crypto'
import {AgentLoop} from '../src/engine/agent-loop/loop/AgentLoop.js'
import {createToolUseContext} from '../src/engine/agent-loop/dispatcher/ToolUseContext.js'
import type {Message} from '../src/engine/types/message.js'
import {resolveProvider} from './_provider.js'

const {provider, model} = resolveProvider()
const ctx = createToolUseContext()

const userMessage: Message = {
	type: 'user',
	uuid: randomUUID() as unknown as Message['uuid'],
	// content blocks 数组形式（部分严格 anthropic-compat 网关只接受此形式；
	// Anthropic 官方两种都接受，统一用数组形式覆盖最广兼容性）
	message: {role: 'user', content: [{type: 'text', text: 'Hello! Reply in one short sentence.'}]} as never,
}

const gen = AgentLoop.run({
	provider,
	model,
	messages: [userMessage],
	context: ctx,
})

for await (const event of gen) {
	if (event.type === 'assistant_message') {
		console.log('[assistant]', JSON.stringify(event.message.message?.content, null, 2))
	}
}
