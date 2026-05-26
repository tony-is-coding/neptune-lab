/**
 * sdk-pure.ts — 纯 SDK 调用（in-process，无 store，无 server）
 *
 * 用法：
 *   # 真 API（Anthropic）
 *   ANTHROPIC_API_KEY=sk-ant-... MODEL=claude-sonnet-4-20250514 bun run examples/sdk-pure.ts
 *
 *   # 真 API（DeepSeek anthropic-compatible endpoint）
 *   DEEPSEEK_API_KEY=... BASE_URL=https://api.deepseek.com/anthropic MODEL=deepseek-v4-flash \
 *     bun run examples/sdk-pure.ts
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
	message: {role: 'user', content: 'Hello! Reply in one short sentence.'},
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
