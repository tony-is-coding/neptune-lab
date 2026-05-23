type UserMessageLike = {
	type: 'user'
	sourceToolUseID?: string
	[key: string]: unknown
}
type AttachmentMessageLike = {type: 'attachment'; [key: string]: unknown}
type SystemMessageLike = {type: 'system'; [key: string]: unknown}
type TaggableMessage = UserMessageLike | AttachmentMessageLike | SystemMessageLike

type AssistantMessageLike = {
	message: {
		content?: unknown
	}
}

type ToolUseBlockLike = {
	type: 'tool_use'
	name?: string
	id?: unknown
}

/**
 * Tags user messages with a sourceToolUseID so they stay transient until the tool resolves.
 * This prevents the "is running" message from being duplicated in the UI.
 */
export function tagMessagesWithToolUseID(
	messages: TaggableMessage[],
	toolUseID: string | undefined,
): TaggableMessage[] {
	if (!toolUseID) {
		return messages
	}
	return messages.map(m => {
		if (m.type === 'user') {
			return {...m, sourceToolUseID: toolUseID}
		}
		return m
	})
}

/**
 * Extracts the tool use ID from a parent message for a given tool name.
 */
export function getToolUseIDFromParentMessage(
	parentMessage: AssistantMessageLike,
	toolName: string,
): string | undefined {
	const toolUseBlock = Array.isArray(parentMessage.message.content)
		? parentMessage.message.content.find(
				(block): block is ToolUseBlockLike =>
					isToolUseBlockLike(block) && block.name === toolName,
			)
		: undefined
	return toolUseBlock && typeof toolUseBlock.id === 'string'
		? toolUseBlock.id
		: undefined
}

function isToolUseBlockLike(block: unknown): block is ToolUseBlockLike {
	return (
		typeof block === 'object' &&
		block !== null &&
		'type' in block &&
		block.type === 'tool_use'
	)
}
