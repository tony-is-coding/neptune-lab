/**
 * engine/types/message.ts - 重新导出 src/types/message.ts 的类型
 *
 * 此文件作为 engine/ 内部的类型声明层，避免从 engine/ 向外穿透到 src/types/
 * engine/ 内的文件应该从这里导入类型，而不是直接从 src/types/ 导入
 */

// 重新导出消息类型
export type {
	Message,
	MessageType,
	MessageContent,
	ContentItem,
	TypedMessageContent,
	AssistantMessage,
	AttachmentMessage,
	ProgressMessage,
	SystemLocalCommandMessage,
	SystemMessage,
	UserMessage,
	NormalizedUserMessage,
	RequestStartEvent,
	StreamEvent,
	SystemCompactBoundaryMessage,
	TombstoneMessage,
	ToolUseSummaryMessage,
} from '../../types/message.js'
