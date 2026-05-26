/**
 * SendMessageTool prompt — 教 LLM 如何在 agent teams 内通信
 *
 * 设计目的（B5 / P0.5）：
 * - cc SendMessageTool prompt 充满 swarm/UDS/bridge/TCP 业务路由说明，substrate 不抄
 * - substrate 仅描述 TeammateChannel 协议的核心 4 类操作：单播 / 广播 / structured shutdown / plan_approval
 */

import {SEND_MESSAGE_TOOL_NAME} from './constants.js'

export const DESCRIPTION = `Send a message to a teammate in the current agent team.`

export function getPrompt(): string {
	return `Use the ${SEND_MESSAGE_TOOL_NAME} tool to communicate with other agents in the same team.

Recipients:
- A specific teammate name (e.g., "alice") → unicast
- "*" → broadcast to all teammates except yourself

Message types:
1. Plain text — typical case. Provide \`message\` as a string and a 5-10 word \`summary\` for the UI.
2. Structured messages (object form):
   - {type: 'shutdown_request', request_id, reason?} — ask a teammate to gracefully exit
   - {type: 'shutdown_response', request_id, approve, reason?} — respond to shutdown_request
   - {type: 'plan_approval_response', request_id, approve, feedback?} — team lead approves/rejects a plan

When NOT to use this tool:
- If you can solve the task yourself with regular tools — don't spam teammates.
- If the recipient is not in your team's teammate roster (use ListPeers / DiscoverSkills first if available).

Notes:
- Plain text messages are read by the recipient's runtime when they next check their inbox.
- Broadcast skips the sender; the response includes the list of recipients reached.
- Structured messages cannot be broadcast (must target a single teammate).`
}
