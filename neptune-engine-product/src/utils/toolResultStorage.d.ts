/**
 * Utility for persisting large tool results to disk instead of truncating them.
 */
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import type { Message } from '../types/message.js';
export declare const TOOL_RESULTS_SUBDIR = "tool-results";
export declare const PERSISTED_OUTPUT_TAG = "<persisted-output>";
export declare const PERSISTED_OUTPUT_CLOSING_TAG = "</persisted-output>";
export declare const TOOL_RESULT_CLEARED_MESSAGE = "[Old tool result content cleared]";
/**
 * Resolve the effective persistence threshold for a tool.
 * GrowthBook override wins when present; otherwise falls back to the declared
 * per-tool cap clamped by the global default.
 *
 * Defensive: GrowthBook's cache returns `cached !== undefined ? cached : default`,
 * so a flag served as `null` leaks through. We guard with optional chaining and a
 * typeof check so any non-object flag value (null, string, number) falls through
 * to the hardcoded default instead of throwing on index or returning 0.
 */
export declare function getPersistenceThreshold(toolName: string, declaredMaxResultSizeChars: number): number;
export type PersistedToolResult = {
    filepath: string;
    originalSize: number;
    isJson: boolean;
    preview: string;
    hasMore: boolean;
};
export type PersistToolResultError = {
    error: string;
};
/**
 * Get the tool results directory for this session (projectDir/sessionId/tool-results)
 */
export declare function getToolResultsDir(): string;
export declare const PREVIEW_SIZE_BYTES = 2000;
/**
 * Get the filepath where a tool result would be persisted.
 */
export declare function getToolResultPath(id: string, isJson: boolean): string;
/**
 * Ensure the session-specific tool results directory exists
 */
export declare function ensureToolResultsDir(): Promise<void>;
/**
 * Persist a tool result to disk and return information about the persisted file
 *
 * @param content - The tool result content to persist (string or array of content blocks)
 * @param toolUseId - The ID of the tool use that produced the result
 * @returns Information about the persisted file including filepath and preview
 */
export declare function persistToolResult(content: NonNullable<ToolResultBlockParam['content']>, toolUseId: string): Promise<PersistedToolResult | PersistToolResultError>;
/**
 * Build a message for large tool results with preview
 */
export declare function buildLargeToolResultMessage(result: PersistedToolResult): string;
/**
 * Process a tool result for inclusion in a message.
 * Maps the result to the API format and persists large results to disk.
 */
export declare function processToolResultBlock<T>(tool: {
    name: string;
    maxResultSizeChars: number;
    mapToolResultToToolResultBlockParam: (result: T, toolUseID: string) => ToolResultBlockParam;
}, toolUseResult: T, toolUseID: string): Promise<ToolResultBlockParam>;
/**
 * Process a pre-mapped tool result block. Applies persistence for large results
 * without re-calling mapToolResultToToolResultBlockParam.
 */
export declare function processPreMappedToolResultBlock(toolResultBlock: ToolResultBlockParam, toolName: string, maxResultSizeChars: number): Promise<ToolResultBlockParam>;
/**
 * True when a tool_result's content is empty or effectively empty. Covers:
 * undefined/null/'', whitespace-only strings, empty arrays, and arrays whose
 * only blocks are text blocks with empty/whitespace text. Non-text blocks
 * (images, tool_reference) are treated as non-empty.
 */
export declare function isToolResultContentEmpty(content: ToolResultBlockParam['content']): boolean;
/**
 * Generate a preview of content, truncating at a newline boundary when possible.
 */
export declare function generatePreview(content: string, maxBytes: number): {
    preview: string;
    hasMore: boolean;
};
/**
 * Type guard to check if persist result is an error
 */
export declare function isPersistError(result: PersistedToolResult | PersistToolResultError): result is PersistToolResultError;
/**
 * Per-conversation-thread state for the aggregate tool result budget.
 * State must be stable to preserve prompt cache:
 *   - seenIds: results that have passed through the budget check (replaced
 *     or not). Once seen, a result's fate is frozen for the conversation.
 *   - replacements: subset of seenIds that were persisted to disk and
 *     replaced with previews, mapped to the exact preview string shown to
 *     the model. Re-application is a Map lookup — no file I/O, guaranteed
 *     byte-identical, cannot fail.
 *
 * Lifecycle: one instance per conversation thread, carried on ToolUseContext.
 * Main thread: REPL provisions once, never resets — stale entries after
 * /clear, rewind, resume, or compact are never looked up (tool_use_ids are
 * UUIDs) so they're harmless. Subagents: createSubagentContext clones the
 * parent's state by default (cache-sharing forks like agentSummary need
 * identical decisions), or resumeAgentBackground threads one reconstructed
 * from sidechain records.
 */
export type ContentReplacementState = {
    seenIds: Set<string>;
    replacements: Map<string, string>;
};
export declare function createContentReplacementState(): ContentReplacementState;
/**
 * Clone replacement state for a cache-sharing fork (e.g. agentSummary).
 * The fork needs state identical to the source at fork time so
 * enforceToolResultBudget makes the same choices → same wire prefix →
 * prompt cache hit. Mutating the clone does not affect the source.
 */
export declare function cloneContentReplacementState(source: ContentReplacementState): ContentReplacementState;
/**
 * Resolve the per-message aggregate budget limit. GrowthBook override
 * (tengu_hawthorn_window) wins when present and a finite positive number;
 * otherwise falls back to the hardcoded constant. Defensive typeof/finite
 * check: GrowthBook's cache returns `cached !== undefined ? cached : default`,
 * so a flag served as null/string/NaN leaks through.
 */
export declare function getPerMessageBudgetLimit(): number;
/**
 * Provision replacement state for a new conversation thread.
 *
 * Encapsulates the feature-flag gate + reconstruct-vs-fresh choice:
 *   - Flag off → undefined (query.ts skips enforcement entirely)
 *   - No initialMessages (cold start) → fresh
 *   - initialMessages present → reconstruct (freeze all candidate IDs so the
 *     budget never replaces content the model already saw unreplaced). Empty
 *     or absent records freeze everything; non-empty records additionally
 *     populate the replacements Map for byte-identical re-apply.
 */
export declare function provisionContentReplacementState(initialMessages?: Message[], initialContentReplacements?: ContentReplacementRecord[]): ContentReplacementState | undefined;
/**
 * Serializable record of one content-replacement decision. Written to the
 * transcript as a ContentReplacementEntry so decisions survive resume.
 * Discriminated by `kind` so future replacement mechanisms (user text,
 * offloaded images) can share the same transcript entry type.
 *
 * `replacement` is the exact string the model saw — stored rather than
 * derived on resume so code changes to the preview template, size formatting,
 * or path layout can't silently break prompt cache.
 */
export type ContentReplacementRecord = {
    kind: 'tool-result';
    toolUseId: string;
    replacement: string;
};
export type ToolResultReplacementRecord = Extract<ContentReplacementRecord, {
    kind: 'tool-result';
}>;
/**
 * Enforce the per-message budget on aggregate tool result size.
 *
 * For each user message whose tool_result blocks together exceed the
 * per-message limit (see getPerMessageBudgetLimit), the largest FRESH
 * (never-before-seen) results in THAT message are persisted to disk and
 * replaced with previews.
 * Messages are evaluated independently — a 150K result in one message and
 * a 150K result in another are both under budget and untouched.
 *
 * State is tracked by tool_use_id in `state`. Once a result is seen its
 * fate is frozen: previously-replaced results get the same replacement
 * re-applied every turn from the cached preview string (zero I/O,
 * byte-identical), and previously-unreplaced results are never replaced
 * later (would break prompt cache).
 *
 * Each turn adds at most one new user message with tool_result blocks,
 * so the per-message loop typically does the budget check at most once;
 * all prior messages just re-apply cached replacements.
 *
 * @param state — MUTATED: seenIds and replacements are updated in place
 *   to record choices made this call. The caller holds a stable reference
 *   across turns; returning a new object would require error-prone ref
 *   updates after every query.
 *
 * Returns `{ messages, newlyReplaced }`:
 *   - messages: same array instance when no replacement is needed
 *   - newlyReplaced: replacements made THIS call (not re-applies).
 *     Caller persists these to the transcript for resume reconstruction.
 */
export declare function enforceToolResultBudget(messages: Message[], state: ContentReplacementState, skipToolNames?: ReadonlySet<string>): Promise<{
    messages: Message[];
    newlyReplaced: ToolResultReplacementRecord[];
}>;
/**
 * Query-loop integration point for the aggregate budget.
 *
 * Gates on `state` (undefined means feature disabled → no-op return),
 * applies enforcement, and fires an optional transcript-write callback
 * for new replacements. The caller (query.ts) owns the persistence gate
 * — it passes a callback only for querySources that read records back on
 * resume (repl_main_thread*, agent:*); ephemeral runForkedAgent callers
 * (agentSummary, sessionMemory, /btw, compact) pass undefined.
 *
 * @returns messages with replacements applied, or the input array unchanged
 *   when the feature is off or no replacement occurred.
 */
export declare function applyToolResultBudget(messages: Message[], state: ContentReplacementState | undefined, writeToTranscript?: (records: ToolResultReplacementRecord[]) => void, skipToolNames?: ReadonlySet<string>): Promise<Message[]>;
/**
 * Reconstruct replacement state from content-replacement records loaded from
 * the transcript. Used on resume so the budget makes the same choices it
 * made in the original session (prompt cache stability).
 *
 * Accepts the full ContentReplacementRecord[] from LogOption (may include
 * future non-tool-result kinds); only tool-result records are applied here.
 *
 *   - replacements: populated directly from the stored replacement strings.
 *     Records for IDs not in messages (e.g. after compact) are skipped —
 *     they're inert anyway.
 *   - seenIds: every candidate tool_use_id in the loaded messages. A result
 *     being in the transcript means it was sent to the model, so it was seen.
 *     This freezes unreplaced results against future replacement.
 *   - inheritedReplacements: gap-fill for fork-subagent resume. A fork's
 *     original run applies parent-inherited replacements via mustReapply
 *     (never persisted — not newlyReplaced). On resume the sidechain has
 *     the original content but no record, so records alone would classify
 *     it as frozen. The parent's live state still has the mapping; copy
 *     it for IDs in messages that records don't cover. No-op for non-fork
 *     resumes (parent IDs aren't in the subagent's messages).
 */
export declare function reconstructContentReplacementState(messages: Message[], records: ContentReplacementRecord[], inheritedReplacements?: ReadonlyMap<string, string>): ContentReplacementState;
/**
 * AgentTool-resume variant: encapsulates the feature-flag gate + parent
 * gap-fill so both AgentTool.call and resumeAgentBackground share one
 * implementation. Returns undefined when parentState is undefined (feature
 * off); otherwise reconstructs from sidechain records with parent's live
 * replacements filling gaps for fork-inherited mustReapply entries.
 *
 * Kept out of AgentTool.tsx — that file is at the feature() DCE complexity
 * cliff and cannot tolerate even +1 net source line without silently
 * breaking feature('TRANSCRIPT_CLASSIFIER') eval in tests.
 */
export declare function reconstructForSubagentResume(parentState: ContentReplacementState | undefined, resumedMessages: Message[], sidechainRecords: ContentReplacementRecord[]): ContentReplacementState | undefined;
//# sourceMappingURL=toolResultStorage.d.ts.map