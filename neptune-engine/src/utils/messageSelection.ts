import type {ContentBlockParam, TextBlockParam} from '@anthropic-ai/sdk/resources/index.mjs'
import type {
	Message,
	UserMessage,
} from '../types/message.js'
import {
	BASH_STDERR_TAG,
	BASH_STDOUT_TAG,
	LOCAL_COMMAND_STDERR_TAG,
	LOCAL_COMMAND_STDOUT_TAG,
	TASK_NOTIFICATION_TAG,
	TEAMMATE_MESSAGE_TAG,
	TICK_TAG,
} from '../constants/xml.js'
import {
	isSyntheticMessage,
	isToolUseResultMessage,
} from './messages.js'

function isTextBlock(block: ContentBlockParam): block is TextBlockParam {
	return block.type === 'text'
}

/**
 * Filter function to select user messages that should be selectable in the UI.
 * Messages are excluded if they are:
 * - Not user type
 * - Tool results
 * - Synthetic messages
 * - Meta messages
 * - Compact summaries or transcript-only messages
 * - Terminal/command output messages
 */
export function selectableUserMessagesFilter(
	message: Message,
): message is UserMessage {
	if (message.type !== 'user') {
		return false
	}
	if (
		Array.isArray(message.message!.content) &&
		message.message!.content[0]?.type === 'tool_result'
	) {
		return false
	}
	if (isSyntheticMessage(message)) {
		return false
	}
	if (message.isMeta) {
		return false
	}
	if (message.isCompactSummary || message.isVisibleInTranscriptOnly) {
		return false
	}

	const content = message.message!.content
	const lastBlock =
		typeof content === 'string' ? null : content![content!.length - 1]
	const messageText =
		typeof content === 'string'
			? content.trim()
			: lastBlock && isTextBlock(lastBlock)
				? lastBlock.text.trim()
				: ''

	// Filter out non-user-authored messages (command outputs, task notifications, ticks).
	if (
		messageText.indexOf(`<${LOCAL_COMMAND_STDOUT_TAG}>`) !== -1 ||
		messageText.indexOf(`<${LOCAL_COMMAND_STDERR_TAG}>`) !== -1 ||
		messageText.indexOf(`<${BASH_STDOUT_TAG}>`) !== -1 ||
		messageText.indexOf(`<${BASH_STDERR_TAG}>`) !== -1 ||
		messageText.indexOf(`<${TASK_NOTIFICATION_TAG}>`) !== -1 ||
		messageText.indexOf(`<${TICK_TAG}>`) !== -1 ||
		messageText.indexOf(`<${TEAMMATE_MESSAGE_TAG}`) !== -1
	) {
		return false
	}
	return true
}
