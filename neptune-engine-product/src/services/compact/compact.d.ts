import type { UUID } from 'crypto';
import type { QuerySource } from '../../constants/querySource.js';
import type { CanUseToolFn } from '../../types/permissions.js';
import type { ToolUseContext } from '../../Tool.js';
import type { AgentId } from '../../types/ids.js';
import type { AssistantMessage, AttachmentMessage, HookResultMessage, Message, PartialCompactDirection, SystemCompactBoundaryMessage, SystemMessage, UserMessage } from '../../types/message.js';
import { type CacheSafeParams } from '../../utils/forkedAgent.js';
import { getTokenUsage } from '../../utils/tokens.js';
export declare const POST_COMPACT_MAX_FILES_TO_RESTORE = 5;
export declare const POST_COMPACT_TOKEN_BUDGET = 50000;
export declare const POST_COMPACT_MAX_TOKENS_PER_FILE = 5000;
export declare const POST_COMPACT_MAX_TOKENS_PER_SKILL = 5000;
export declare const POST_COMPACT_SKILLS_TOKEN_BUDGET = 25000;
/**
 * Strip image blocks from user messages before sending for compaction.
 * Images are not needed for generating a conversation summary and can
 * cause the compaction API call itself to hit the prompt-too-long limit,
 * especially in CCD sessions where users frequently attach images.
 * Replaces image blocks with a text marker so the summary still notes
 * that an image was shared.
 *
 * Note: Only user messages contain images (either directly attached or within
 * tool_result content from tools). Assistant messages contain text, tool_use,
 * and thinking blocks but not images.
 */
export declare function stripImagesFromMessages(messages: Message[]): Message[];
/**
 * Strip attachment types that are re-injected post-compaction anyway.
 * skill_discovery/skill_listing are re-surfaced by resetSentSkillNames()
 * + the next turn's discovery signal, so feeding them to the summarizer
 * wastes tokens and pollutes the summary with stale skill suggestions.
 *
 * No-op when EXPERIMENTAL_SKILL_SEARCH is off (the attachment types
 * don't exist on external builds).
 */
export declare function stripReinjectedAttachments(messages: Message[]): Message[];
export declare const ERROR_MESSAGE_NOT_ENOUGH_MESSAGES = "Not enough messages to compact.";
/**
 * Drops the oldest API-round groups from messages until tokenGap is covered.
 * Falls back to dropping 20% of groups when the gap is unparseable (some
 * Vertex/Bedrock error formats). Returns null when nothing can be dropped
 * without leaving an empty summarize set.
 *
 * This is the last-resort escape hatch for CC-1180 — when the compact request
 * itself hits prompt-too-long, the user is otherwise stuck. Dropping the
 * oldest context is lossy but unblocks them. The reactive-compact path
 * (compactMessages.ts) has the proper retry loop that peels from the tail;
 * this helper is the dumb-but-safe fallback for the proactive/manual path
 * that wasn't migrated in bfdb472f's unification.
 */
export declare function truncateHeadForPTLRetry(messages: Message[], ptlResponse: AssistantMessage): Message[] | null;
export declare const ERROR_MESSAGE_PROMPT_TOO_LONG = "Conversation too long. Press esc twice to go up a few messages and try again.";
export declare const ERROR_MESSAGE_USER_ABORT = "API Error: Request was aborted.";
export declare const ERROR_MESSAGE_INCOMPLETE_RESPONSE = "Compaction interrupted \u00B7 This may be due to network issues \u2014 please try again.";
export interface CompactionResult {
    boundaryMarker: SystemMessage;
    summaryMessages: UserMessage[];
    attachments: AttachmentMessage[];
    hookResults: HookResultMessage[];
    messagesToKeep?: Message[];
    userDisplayMessage?: string;
    preCompactTokenCount?: number;
    postCompactTokenCount?: number;
    truePostCompactTokenCount?: number;
    compactionUsage?: ReturnType<typeof getTokenUsage>;
}
/**
 * Diagnosis context passed from autoCompactIfNeeded into compactConversation.
 * Lets the tengu_compact event disambiguate same-chain loops (H2) from
 * cross-agent (H1/H5) and manual-vs-auto (H3) compactions without joins.
 */
export type RecompactionInfo = {
    isRecompactionInChain: boolean;
    turnsSincePreviousCompact: number;
    previousCompactTurnId?: string;
    autoCompactThreshold: number;
    querySource?: QuerySource;
};
/**
 * Build the base post-compact messages array from a CompactionResult.
 * This ensures consistent ordering across all compaction paths.
 * Order: boundaryMarker, summaryMessages, messagesToKeep, attachments, hookResults
 */
export declare function buildPostCompactMessages(result: CompactionResult): Message[];
/**
 * Annotate a compact boundary with relink metadata for messagesToKeep.
 * Preserved messages keep their original parentUuids on disk (dedup-skipped);
 * the loader uses this to patch head→anchor and anchor's-other-children→tail.
 *
 * `anchorUuid` = what sits immediately before keep[0] in the desired chain:
 *   - suffix-preserving (reactive/session-memory): last summary message
 *   - prefix-preserving (partial compact): the boundary itself
 */
export declare function annotateBoundaryWithPreservedSegment(boundary: SystemCompactBoundaryMessage, anchorUuid: UUID, messagesToKeep: readonly Message[] | undefined): SystemCompactBoundaryMessage;
/**
 * Merges user-supplied custom instructions with hook-provided instructions.
 * User instructions come first; hook instructions are appended.
 * Empty strings normalize to undefined.
 */
export declare function mergeHookInstructions(userInstructions: string | undefined, hookInstructions: string | undefined): string | undefined;
/**
 * Creates a compact version of a conversation by summarizing older messages
 * and preserving recent conversation history.
 */
export declare function compactConversation(messages: Message[], context: ToolUseContext, cacheSafeParams: CacheSafeParams, suppressFollowUpQuestions: boolean, customInstructions?: string, isAutoCompact?: boolean, recompactionInfo?: RecompactionInfo): Promise<CompactionResult>;
/**
 * Performs a partial compaction around the selected message index.
 * Direction 'from': summarizes messages after the index, keeps earlier ones.
 *   Prompt cache for kept (earlier) messages is preserved.
 * Direction 'up_to': summarizes messages before the index, keeps later ones.
 *   Prompt cache is invalidated since the summary precedes the kept messages.
 */
export declare function partialCompactConversation(allMessages: Message[], pivotIndex: number, context: ToolUseContext, cacheSafeParams: CacheSafeParams, userFeedback?: string, direction?: PartialCompactDirection): Promise<CompactionResult>;
export declare function createCompactCanUseTool(): CanUseToolFn;
/**
 * Creates attachment messages for recently accessed files to restore them after compaction.
 * This prevents the model from having to re-read files that were recently accessed.
 * Re-reads files using FileReadTool to get fresh content with proper validation.
 * Files are selected based on recency, but constrained by both file count and token budget limits.
 *
 * Files already present as Read tool results in preservedMessages are skipped —
 * re-injecting identical content the model can already see in the preserved tail
 * is pure waste (up to 25K tok/compact). Mirrors the diff-against-preserved
 * pattern that getDeferredToolsDeltaAttachment uses at the same call sites.
 *
 * @param readFileState The current file state tracking recently read files
 * @param toolUseContext The tool use context for calling FileReadTool
 * @param maxFiles Maximum number of files to restore (default: 5)
 * @param preservedMessages Messages kept post-compact; Read results here are skipped
 * @returns Array of attachment messages for the most recently accessed files that fit within token budget
 */
export declare function createPostCompactFileAttachments(readFileState: Record<string, {
    content: string;
    timestamp: number;
}>, toolUseContext: ToolUseContext, maxFiles: number, preservedMessages?: Message[]): Promise<AttachmentMessage[]>;
/**
 * Creates a plan file attachment if a plan file exists for the current session.
 * This ensures the plan is preserved after compaction.
 */
export declare function createPlanAttachmentIfNeeded(agentId?: AgentId): AttachmentMessage | null;
/**
 * Creates an attachment for invoked skills to preserve their content across compaction.
 * Only includes skills scoped to the given agent (or main session when agentId is null/undefined).
 * This ensures skill guidelines remain available after the conversation is summarized
 * without leaking skills from other agent contexts.
 */
export declare function createSkillAttachmentIfNeeded(agentId?: string): AttachmentMessage | null;
/**
 * Creates a plan_mode attachment if the user is currently in plan mode.
 * This ensures the model continues to operate in plan mode after compaction
 * (otherwise it would lose the plan mode instructions since those are
 * normally only injected on tool-use turns via getAttachmentMessages).
 */
export declare function createPlanModeAttachmentIfNeeded(context: ToolUseContext): Promise<AttachmentMessage | null>;
/**
 * Creates attachments for async agents so the model knows about them after
 * compaction. Covers both agents still running in the background (so the model
 * doesn't spawn a duplicate) and agents that have finished but whose results
 * haven't been retrieved yet.
 */
export declare function createAsyncAgentAttachmentsIfNeeded(context: ToolUseContext): Promise<AttachmentMessage[]>;
//# sourceMappingURL=compact.d.ts.map