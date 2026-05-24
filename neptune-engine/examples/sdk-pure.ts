/**
 * sdk-pure.ts — 纯 SDK 调用（in-process，无 store，无 server）
 *
 * 用法：ANTHROPIC_API_KEY=sk-... bun run examples/sdk-pure.ts
 */

import {randomUUID} from 'crypto'
import {AgentLoop} from '../src/engine/agent-loop/loop/AgentLoop.js'
import {AnthropicStreamingProvider} from '../src/engine/agent-loop/provider/AnthropicStreamingProvider.js'
import {createToolUseContext} from '../src/engine/agent-loop/dispatcher/ToolUseContext.js'
import type {Message} from '../src/engine/types/message.js'

const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) {
	console.error('Set ANTHROPIC_API_KEY env var')
	process.exit(1)
}

const provider = new AnthropicStreamingProvider({apiKey})
const ctx = createToolUseContext()

const userMessage: Message = {
	type: 'user',
	uuid: randomUUID() as unknown as Message['uuid'],
	message: {role: 'user', content: 'Hello! Reply in one short sentence.'},
}

const gen = AgentLoop.run({
	provider,
	model: 'claude-sonnet-4-20250514',
	messages: [userMessage],
	context: ctx,
})

for await (const event of gen) {
	if (event.type === 'assistant_message') {
		console.log('[assistant]', JSON.stringify(event.message.message?.content, null, 2))
	}
}
