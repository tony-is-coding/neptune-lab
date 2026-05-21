import type { BetaUsage as Usage } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { ContentBlockParam, ToolResultBlockParam, ToolUseBlock, ToolUseBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import { type UUID } from 'crypto';
import type { AgentId } from 'src/types/ids.js';
import type { Progress } from '../Tool.js';
import type { AssistantMessage, AttachmentMessage, Message, MessageOrigin, NormalizedAssistantMessage, NormalizedMessage, NormalizedUserMessage, PartialCompactDirection, ProgressMessage, RequestStartEvent, StopHookInfo, StreamEvent, SystemAgentsKilledMessage, SystemAPIErrorMessage, SystemApiMetricsMessage, SystemAwaySummaryMessage, SystemBridgeStatusMessage, SystemCompactBoundaryMessage, SystemInformationalMessage, SystemLocalCommandMessage, SystemMemorySavedMessage, SystemMessage, SystemMessageLevel, SystemMicrocompactBoundaryMessage, SystemPermissionRetryMessage, SystemScheduledTaskFireMessage, SystemStopHookSummaryMessage, SystemTurnDurationMessage, TombstoneMessage, ToolUseSummaryMessage, UserMessage } from '../types/message.js';
import { type Attachment } from './attachments.js';
import type { APIError } from '@anthropic-ai/sdk';
import type { BetaContentBlock, BetaMessage, BetaToolUseBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { HookEvent, SDKAssistantMessageError } from 'src/entrypoints/agentSdkTypes.js';
import type { DeepImmutable } from 'src/types/utils.js';
import type { SpinnerMode } from '../types/spinner.js';
import { type Tools } from '../Tool.js';
import type { PermissionMode } from '../types/permissions.js';
/**
 * Appends a memory correction hint to a rejection/cancellation message
 * when auto-memory is enabled and the GrowthBook flag is on.
 */
export declare function withMemoryCorrectionHint(message: string): string;
/**
 * Derive a short stable message ID (6-char base36 string) from a UUID.
 * Used for snip tool referencing — injected into API-bound messages as [id:...] tags.
 * Deterministic: same UUID always produces the same short ID.
 */
export declare function deriveShortMessageId(uuid: string): string;
export declare const INTERRUPT_MESSAGE = "[Request interrupted by user]";
export declare const INTERRUPT_MESSAGE_FOR_TOOL_USE = "[Request interrupted by user for tool use]";
export declare const CANCEL_MESSAGE = "The user doesn't want to take this action right now. STOP what you are doing and wait for the user to tell you how to proceed.";
export declare const REJECT_MESSAGE = "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.";
export declare const REJECT_MESSAGE_WITH_REASON_PREFIX = "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). To tell you how to proceed, the user said:\n";
export declare const SUBAGENT_REJECT_MESSAGE = "Permission for this tool use was denied. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). Try a different approach or report the limitation to complete your task.";
export declare const SUBAGENT_REJECT_MESSAGE_WITH_REASON_PREFIX = "Permission for this tool use was denied. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). The user said:\n";
export declare const PLAN_REJECTION_PREFIX = "The agent proposed a plan that was rejected by the user. The user chose to stay in plan mode rather than proceed with implementation.\n\nRejected plan:\n";
/**
 * Shared guidance for permission denials, instructing the model on appropriate workarounds.
 */
export declare const DENIAL_WORKAROUND_GUIDANCE: string;
export declare function AUTO_REJECT_MESSAGE(toolName: string): string;
export declare function DONT_ASK_REJECT_MESSAGE(toolName: string): string;
export declare const NO_RESPONSE_REQUESTED = "No response requested.";
export declare const SYNTHETIC_TOOL_RESULT_PLACEHOLDER = "[Tool result missing due to internal error]";
/**
 * Check if a tool result message is a classifier denial.
 * Used by the UI to render a short summary instead of the full message.
 */
export declare function isClassifierDenial(content: string): boolean;
/**
 * Build a rejection message for auto mode classifier denials.
 * Encourages continuing with other tasks and suggests permission rules.
 *
 * @param reason - The classifier's reason for denying the action
 */
export declare function buildYoloRejectionMessage(reason: string): string;
/**
 * Build a message for when the auto mode classifier is temporarily unavailable.
 * Tells the agent to wait and retry, and suggests working on other tasks.
 */
export declare function buildClassifierUnavailableMessage(toolName: string, classifierModel: string): string;
export declare const SYNTHETIC_MODEL = "<synthetic>";
export declare const SYNTHETIC_MESSAGES: Set<string>;
export declare function isSyntheticMessage(message: Message): boolean;
export declare function getLastAssistantMessage(messages: Message[]): AssistantMessage | undefined;
export declare function hasToolCallsInLastAssistantTurn(messages: Message[]): boolean;
export declare function createAssistantMessage({ content, usage, isVirtual, }: {
    content: string | BetaContentBlock[];
    usage?: Usage;
    isVirtual?: true;
}): AssistantMessage;
export declare function createAssistantAPIErrorMessage({ content, apiError, error, errorDetails, }: {
    content: string;
    apiError?: AssistantMessage['apiError'];
    error?: SDKAssistantMessageError;
    errorDetails?: string;
}): AssistantMessage;
export declare function createUserMessage({ content, isMeta, isVisibleInTranscriptOnly, isVirtual, isCompactSummary, summarizeMetadata, toolUseResult, mcpMeta, uuid, timestamp, imagePasteIds, sourceToolAssistantUUID, permissionMode, origin, }: {
    content: string | ContentBlockParam[];
    isMeta?: true;
    isVisibleInTranscriptOnly?: true;
    isVirtual?: true;
    isCompactSummary?: true;
    toolUseResult?: unknown;
    /** MCP protocol metadata to pass through to SDK consumers (never sent to model) */
    mcpMeta?: {
        _meta?: Record<string, unknown>;
        structuredContent?: Record<string, unknown>;
    };
    uuid?: UUID | string;
    timestamp?: string;
    imagePasteIds?: number[];
    sourceToolAssistantUUID?: UUID;
    permissionMode?: PermissionMode;
    summarizeMetadata?: {
        messagesSummarized: number;
        userContext?: string;
        direction?: PartialCompactDirection;
    };
    origin?: MessageOrigin;
}): UserMessage;
export declare function prepareUserContent({ inputString, precedingInputBlocks, }: {
    inputString: string;
    precedingInputBlocks: ContentBlockParam[];
}): string | ContentBlockParam[];
export declare function createUserInterruptionMessage({ toolUse, }: {
    toolUse?: boolean;
}): UserMessage;
/**
 * Creates a new synthetic user caveat message for local commands (eg. bash, slash).
 * We need to create a new message each time because messages must have unique uuids.
 */
export declare function createSyntheticUserCaveatMessage(): UserMessage;
/**
 * Formats the command-input breadcrumb the model sees when a slash command runs.
 */
export declare function formatCommandInputTags(commandName: string, args: string): string;
/**
 * Builds the breadcrumb trail the SDK set_model control handler injects
 * so the model can see mid-conversation switches. Same shape the CLI's
 * /model command produces via processSlashCommand.
 */
export declare function createModelSwitchBreadcrumbs(modelArg: string, resolvedDisplay: string): UserMessage[];
export declare function createProgressMessage<P extends Progress>({ toolUseID, parentToolUseID, data, }: {
    toolUseID: string;
    parentToolUseID: string;
    data: P;
}): ProgressMessage<P>;
export declare function createToolResultStopMessage(toolUseID: string): ToolResultBlockParam;
export declare function extractTag(html: string, tagName: string): string | null;
export declare function isNotEmptyMessage(message: Message): boolean;
export declare function deriveUUID(parentUUID: UUID, index: number): UUID;
export declare function normalizeMessages(messages: AssistantMessage[]): NormalizedAssistantMessage[];
export declare function normalizeMessages(messages: UserMessage[]): NormalizedUserMessage[];
export declare function normalizeMessages(messages: (AssistantMessage | UserMessage)[]): (NormalizedAssistantMessage | NormalizedUserMessage)[];
export declare function normalizeMessages(messages: Message[]): NormalizedMessage[];
type ToolUseRequestMessage = NormalizedAssistantMessage & {
    message: {
        content: [ToolUseBlock];
    };
};
export declare function isToolUseRequestMessage(message: Message): message is ToolUseRequestMessage;
type ToolUseResultMessage = NormalizedUserMessage & {
    message: {
        content: [ToolResultBlockParam];
    };
};
export declare function isToolUseResultMessage(message: Message): message is ToolUseResultMessage;
export declare function reorderMessagesInUI(messages: (NormalizedUserMessage | NormalizedAssistantMessage | AttachmentMessage | SystemMessage)[], syntheticStreamingToolUseMessages: NormalizedAssistantMessage[]): (NormalizedUserMessage | NormalizedAssistantMessage | AttachmentMessage | SystemMessage)[];
export declare function hasUnresolvedHooks(messages: NormalizedMessage[], toolUseID: string, hookEvent: HookEvent): boolean;
export declare function getToolResultIDs(normalizedMessages: NormalizedMessage[]): {
    [toolUseID: string]: boolean;
};
export declare function getSiblingToolUseIDs(message: NormalizedMessage, messages: Message[]): Set<string>;
export type MessageLookups = {
    siblingToolUseIDs: Map<string, Set<string>>;
    progressMessagesByToolUseID: Map<string, ProgressMessage[]>;
    inProgressHookCounts: Map<string, Map<HookEvent, number>>;
    resolvedHookCounts: Map<string, Map<HookEvent, number>>;
    /** Maps tool_use_id to the user message containing its tool_result */
    toolResultByToolUseID: Map<string, NormalizedMessage>;
    /** Maps tool_use_id to the ToolUseBlockParam */
    toolUseByToolUseID: Map<string, ToolUseBlockParam>;
    /** Total count of normalized messages (for truncation indicator text) */
    normalizedMessageCount: number;
    /** Set of tool use IDs that have a corresponding tool_result */
    resolvedToolUseIDs: Set<string>;
    /** Set of tool use IDs that have an errored tool_result */
    erroredToolUseIDs: Set<string>;
};
/**
 * Build pre-computed lookups for efficient O(1) access to message relationships.
 * Call once per render, then use the lookups for all messages.
 *
 * This avoids O(n²) behavior from calling getProgressMessagesForMessage,
 * getSiblingToolUseIDs, and hasUnresolvedHooks for each message.
 */
export declare function buildMessageLookups(normalizedMessages: NormalizedMessage[], messages: Message[]): MessageLookups;
/** Empty lookups for static rendering contexts that don't need real lookups. */
export declare const EMPTY_LOOKUPS: MessageLookups;
/**
 * Shared empty Set singleton. Reused on bail-out paths to avoid allocating
 * a fresh Set per message per render. Mutation is prevented at compile time
 * by the ReadonlySet<string> type — Object.freeze here is convention only
 * (it freezes own properties, not Set internal state).
 * All consumers are read-only (iteration / .has / .size).
 */
export declare const EMPTY_STRING_SET: ReadonlySet<string>;
/**
 * Build lookups from subagent/skill progress messages so child tool uses
 * render with correct resolved/in-progress/queued state.
 *
 * Each progress message must have a `message` field of type
 * `AssistantMessage | NormalizedUserMessage`.
 */
export declare function buildSubagentLookups(messages: {
    message: AssistantMessage | NormalizedUserMessage;
}[]): {
    lookups: MessageLookups;
    inProgressToolUseIDs: Set<string>;
};
/**
 * Get sibling tool use IDs using pre-computed lookup. O(1).
 */
export declare function getSiblingToolUseIDsFromLookup(message: NormalizedMessage, lookups: MessageLookups): ReadonlySet<string>;
/**
 * Get progress messages for a message using pre-computed lookup. O(1).
 */
export declare function getProgressMessagesFromLookup(message: NormalizedMessage, lookups: MessageLookups): ProgressMessage[];
/**
 * Check for unresolved hooks using pre-computed lookup. O(1).
 */
export declare function hasUnresolvedHooksFromLookup(toolUseID: string, hookEvent: HookEvent, lookups: MessageLookups): boolean;
export declare function getToolUseIDs(normalizedMessages: NormalizedMessage[]): Set<string>;
/**
 * Reorders messages so that attachments bubble up until they hit either:
 * - A tool call result (user message with tool_result content)
 * - Any assistant message
 */
export declare function reorderAttachmentsForAPI(messages: Message[]): Message[];
export declare function isSystemLocalCommandMessage(message: Message): message is SystemLocalCommandMessage;
/**
 * Strips tool_reference blocks from tool_result content in a user message.
 * tool_reference blocks are only valid when the tool search beta is enabled.
 * When tool search is disabled, we need to remove these blocks to avoid API errors.
 */
export declare function stripToolReferenceBlocksFromUserMessage(message: UserMessage): UserMessage;
/**
 * Strips the 'caller' field from tool_use blocks in an assistant message.
 * The 'caller' field is only valid when the tool search beta is enabled.
 * When tool search is disabled, we need to remove this field to avoid API errors.
 *
 * NOTE: This function only strips the 'caller' field - it does NOT normalize
 * tool inputs (that's done by normalizeToolInputForAPI in normalizeMessagesForAPI).
 * This is intentional: this helper is used for model-specific post-processing
 * AFTER normalizeMessagesForAPI has already run, so inputs are already normalized.
 */
export declare function stripCallerFieldFromAssistantMessage(message: AssistantMessage): AssistantMessage;
export declare function normalizeMessagesForAPI(messages: Message[], tools?: Tools): (UserMessage | AssistantMessage)[];
export declare function mergeUserMessagesAndToolResults(a: UserMessage, b: UserMessage): UserMessage;
export declare function mergeAssistantMessages(a: AssistantMessage, b: AssistantMessage): AssistantMessage;
export declare function mergeUserMessages(a: UserMessage, b: UserMessage): UserMessage;
export declare function mergeUserContentBlocks(a: ContentBlockParam[], b: ContentBlockParam[]): ContentBlockParam[];
export declare function normalizeContentFromAPI(contentBlocks: BetaMessage['content'], tools: Tools, agentId?: AgentId): BetaMessage['content'];
export declare function isEmptyMessageText(text: string): boolean;
export declare function stripPromptXMLTags(content: string): string;
export declare function getToolUseID(message: NormalizedMessage): string | null;
export declare function filterUnresolvedToolUses(messages: Message[]): Message[];
export declare function getAssistantMessageText(message: Message): string | null;
export declare function getUserMessageText(message: Message | NormalizedMessage): string | null;
export declare function textForResubmit(msg: UserMessage): {
    text: string;
    mode: 'bash' | 'prompt';
} | null;
/**
 * Extract text from an array of content blocks, joining text blocks with the
 * given separator. Works with ContentBlock, ContentBlockParam, BetaContentBlock,
 * and their readonly/DeepImmutable variants via structural typing.
 */
export declare function extractTextContent(blocks: readonly {
    readonly type: string;
}[], separator?: string): string;
export declare function getContentText(content: string | DeepImmutable<Array<ContentBlockParam>>): string | null;
export type StreamingToolUse = {
    index: number;
    contentBlock: BetaToolUseBlock;
    unparsedToolInput: string;
};
export type StreamingThinking = {
    thinking: string;
    isStreaming: boolean;
    streamingEndedAt?: number;
};
/**
 * Handles messages from a stream, updating response length for deltas and appending completed messages
 */
export declare function handleMessageFromStream(message: Message | TombstoneMessage | StreamEvent | RequestStartEvent | ToolUseSummaryMessage, onMessage: (message: Message) => void, onUpdateLength: (newContent: string) => void, onSetStreamMode: (mode: SpinnerMode) => void, onStreamingToolUses: (f: (streamingToolUse: StreamingToolUse[]) => StreamingToolUse[]) => void, onTombstone?: (message: Message) => void, onStreamingThinking?: (f: (current: StreamingThinking | null) => StreamingThinking | null) => void, onApiMetrics?: (metrics: {
    ttftMs: number;
}) => void, onStreamingText?: (f: (current: string | null) => string | null) => void): void;
export declare function wrapInSystemReminder(content: string): string;
export declare function wrapMessagesInSystemReminder(messages: UserMessage[]): UserMessage[];
export declare const PLAN_PHASE4_CONTROL = "### Phase 4: Final Plan\nGoal: Write your final plan to the plan file (the only file you can edit).\n- Begin with a **Context** section: explain why this change is being made \u2014 the problem or need it addresses, what prompted it, and the intended outcome\n- Include only your recommended approach, not all alternatives\n- Ensure that the plan file is concise enough to scan quickly, but detailed enough to execute effectively\n- Include the paths of critical files to be modified\n- Reference existing functions and utilities you found that should be reused, with their file paths\n- Include a verification section describing how to test the changes end-to-end (run the code, use MCP tools, run tests)";
export declare function normalizeAttachmentForAPI(attachment: Attachment): UserMessage[];
export declare function createSystemMessage(content: string, level: SystemMessageLevel, toolUseID?: string, preventContinuation?: boolean): SystemInformationalMessage;
export declare function createPermissionRetryMessage(commands: string[]): SystemPermissionRetryMessage;
export declare function createBridgeStatusMessage(url: string, upgradeNudge?: string): SystemBridgeStatusMessage;
export declare function createScheduledTaskFireMessage(content: string): SystemScheduledTaskFireMessage;
export declare function createStopHookSummaryMessage(hookCount: number, hookInfos: StopHookInfo[], hookErrors: string[], preventedContinuation: boolean, stopReason: string | undefined, hasOutput: boolean, level: SystemMessageLevel, toolUseID?: string, hookLabel?: string, totalDurationMs?: number): SystemStopHookSummaryMessage;
export declare function createTurnDurationMessage(durationMs: number, budget?: {
    tokens: number;
    limit: number;
    nudges: number;
}, messageCount?: number): SystemTurnDurationMessage;
export declare function createAwaySummaryMessage(content: string): SystemAwaySummaryMessage;
export declare function createMemorySavedMessage(writtenPaths: string[]): SystemMemorySavedMessage;
export declare function createAgentsKilledMessage(): SystemAgentsKilledMessage;
export declare function createApiMetricsMessage(metrics: {
    ttftMs: number;
    otps: number;
    isP50?: boolean;
    hookDurationMs?: number;
    turnDurationMs?: number;
    toolDurationMs?: number;
    classifierDurationMs?: number;
    toolCount?: number;
    hookCount?: number;
    classifierCount?: number;
    configWriteCount?: number;
}): SystemApiMetricsMessage;
export declare function createCommandInputMessage(content: string): SystemLocalCommandMessage;
export declare function createCompactBoundaryMessage(trigger: 'manual' | 'auto', preTokens: number, lastPreCompactMessageUuid?: UUID, userContext?: string, messagesSummarized?: number): SystemCompactBoundaryMessage;
export declare function createMicrocompactBoundaryMessage(trigger: 'auto', preTokens: number, tokensSaved: number, compactedToolIds: string[], clearedAttachmentUUIDs: string[]): SystemMicrocompactBoundaryMessage;
export declare function createSystemAPIErrorMessage(error: APIError, retryInMs: number, retryAttempt: number, maxRetries: number): SystemAPIErrorMessage;
/**
 * Checks if a message is a compact boundary marker
 */
export declare function isCompactBoundaryMessage(message: Message | NormalizedMessage): message is SystemCompactBoundaryMessage;
/**
 * Finds the index of the last compact boundary marker in the messages array
 * @returns The index of the last compact boundary, or -1 if none found
 */
export declare function findLastCompactBoundaryIndex<T extends Message | NormalizedMessage>(messages: T[]): number;
/**
 * Returns messages from the last compact boundary onward (including the boundary).
 * If no boundary exists, returns all messages.
 *
 * Also filters snipped messages by default (when HISTORY_SNIP is enabled) —
 * the REPL keeps full history for UI scrollback, so model-facing paths need
 * both compact-slice AND snip-filter applied. Pass `{ includeSnipped: true }`
 * to opt out (e.g., REPL.tsx fullscreen compact handler which preserves
 * snipped messages in scrollback).
 *
 * Note: The boundary itself is a system message and will be filtered by normalizeMessagesForAPI.
 */
export declare function getMessagesAfterCompactBoundary<T extends Message | NormalizedMessage>(messages: T[], options?: {
    includeSnipped?: boolean;
}): T[];
export declare function shouldShowUserMessage(message: NormalizedMessage, isTranscriptMode: boolean): boolean;
export declare function isThinkingMessage(message: Message): boolean;
/**
 * Count total calls to a specific tool in message history
 * Stops early at maxCount for efficiency
 */
export declare function countToolCalls(messages: Message[], toolName: string, maxCount?: number): number;
/**
 * Check if the most recent tool call succeeded (has result without is_error)
 * Searches backwards for efficiency.
 */
export declare function hasSuccessfulToolCall(messages: Message[], toolName: string): boolean;
/**
 * Filter out assistant messages with only whitespace-only text content.
 *
 * The API requires "text content blocks must contain non-whitespace text".
 * This can happen when the model outputs whitespace (like "\n\n") before a thinking block,
 * but the user cancels mid-stream, leaving only the whitespace text.
 *
 * This function removes such messages entirely rather than keeping a placeholder,
 * since whitespace-only content has no semantic value.
 *
 * Also used by conversationRecovery to filter these from the main state during session resume.
 */
export declare function filterWhitespaceOnlyAssistantMessages(messages: (UserMessage | AssistantMessage)[]): (UserMessage | AssistantMessage)[];
export declare function filterWhitespaceOnlyAssistantMessages(messages: Message[]): Message[];
/**
 * Filter orphaned thinking-only assistant messages.
 *
 * During streaming, each content block is yielded as a separate message with the same
 * message.id. When messages are loaded for resume, interleaved user messages or attachments
 * can prevent proper merging by message.id, leaving orphaned assistant messages that contain
 * only thinking blocks. These cause "thinking blocks cannot be modified" API errors.
 *
 * A thinking-only message is "orphaned" if there is NO other assistant message with the
 * same message.id that contains non-thinking content (text, tool_use, etc). If such a
 * message exists, the thinking block will be merged with it in normalizeMessagesForAPI().
 */
export declare function filterOrphanedThinkingOnlyMessages(messages: (UserMessage | AssistantMessage)[]): (UserMessage | AssistantMessage)[];
export declare function filterOrphanedThinkingOnlyMessages(messages: Message[]): Message[];
/**
 * Strip signature-bearing blocks (thinking, redacted_thinking, connector_text)
 * from all assistant messages. Their signatures are bound to the API key that
 * generated them; after a credential change (e.g. /login) they're invalid and
 * the API rejects them with a 400.
 */
export declare function stripSignatureBlocks(messages: Message[]): Message[];
/**
 * Creates a tool use summary message for SDK emission.
 * Tool use summaries provide human-readable progress updates after tool batches complete.
 */
export declare function createToolUseSummaryMessage(summary: string, precedingToolUseIds: string[]): ToolUseSummaryMessage;
/**
 * Defensive validation: ensure tool_use/tool_result pairing is correct.
 *
 * Handles both directions:
 * - Forward: inserts synthetic error tool_result blocks for tool_use blocks missing results
 * - Reverse: strips orphaned tool_result blocks referencing non-existent tool_use blocks
 *
 * Logs when this activates to help identify the root cause.
 *
 * Strict mode: when getStrictToolResultPairing() is true (HFI opts in at
 * startup), any mismatch throws instead of repairing. For training-data
 * collection, a model response conditioned on synthetic placeholders is
 * tainted — fail the trajectory rather than waste labeler time on a turn
 * that will be rejected at submission anyway.
 */
export declare function ensureToolResultPairing(messages: (UserMessage | AssistantMessage)[]): (UserMessage | AssistantMessage)[];
/**
 * Strip advisor blocks from messages. The API rejects server_tool_use blocks
 * with name "advisor" unless the advisor beta header is present.
 */
export declare function stripAdvisorBlocks(messages: (UserMessage | AssistantMessage)[]): (UserMessage | AssistantMessage)[];
export declare function wrapCommandText(raw: string, origin: MessageOrigin | undefined): string;
export {};
//# sourceMappingURL=messages.d.ts.map