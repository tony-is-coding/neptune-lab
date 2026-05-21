import { type Tools, type ToolUseContext } from '../Tool.js';
import { type Output as FileReadToolOutput } from '@neptune/builtin-tools/tools/FileReadTool/FileReadTool.js';
import type { IDESelection } from '../types/ide.js';
import type { TodoList } from './todo/types.js';
import { type Task } from './tasks.js';
import { type MemoryFileInfo } from './claudemd.js';
import type { DiagnosticFile } from '../services/diagnosticTracking.js';
import type { AttachmentMessage, Message, MessageOrigin } from 'src/types/message.js';
import { type QueuedCommand } from 'src/types/textInputTypes.js';
import { type UUID } from 'crypto';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type { Command } from '../types/command.js';
import type { DiscoverySignal } from '../services/skillSearch/signals.js';
import { type FileStateCache } from './fileStateCache.js';
import type { TaskType, TaskStatus } from '../Task.js';
import type { QuerySource } from '../constants/querySource.js';
import { type DeferredToolsDeltaScanContext } from './toolSearch.js';
import type { MCPServerConnection } from '../services/mcp/types.js';
import type { HookEvent, SyncHookJSONOutput } from 'src/entrypoints/agentSdkTypes.js';
import { type HookBlockingError } from './hooks.js';
export declare const TODO_REMINDER_CONFIG: {
    readonly TURNS_SINCE_WRITE: 10;
    readonly TURNS_BETWEEN_REMINDERS: 10;
};
export declare const PLAN_MODE_ATTACHMENT_CONFIG: {
    readonly TURNS_BETWEEN_ATTACHMENTS: 5;
    readonly FULL_REMINDER_EVERY_N_ATTACHMENTS: 5;
};
export declare const AUTO_MODE_ATTACHMENT_CONFIG: {
    readonly TURNS_BETWEEN_ATTACHMENTS: 5;
    readonly FULL_REMINDER_EVERY_N_ATTACHMENTS: 5;
};
export declare const RELEVANT_MEMORIES_CONFIG: {
    readonly MAX_SESSION_BYTES: number;
};
export declare const VERIFY_PLAN_REMINDER_CONFIG: {
    readonly TURNS_BETWEEN_REMINDERS: 10;
};
export type FileAttachment = {
    type: 'file';
    filename: string;
    content: FileReadToolOutput;
    /**
     * Whether the file was truncated due to size limits
     */
    truncated?: boolean;
    /** Path relative to CWD at creation time, for stable display */
    displayPath: string;
};
export type CompactFileReferenceAttachment = {
    type: 'compact_file_reference';
    filename: string;
    /** Path relative to CWD at creation time, for stable display */
    displayPath: string;
};
export type PDFReferenceAttachment = {
    type: 'pdf_reference';
    filename: string;
    pageCount: number;
    fileSize: number;
    /** Path relative to CWD at creation time, for stable display */
    displayPath: string;
};
export type AlreadyReadFileAttachment = {
    type: 'already_read_file';
    filename: string;
    content: FileReadToolOutput;
    /**
     * Whether the file was truncated due to size limits
     */
    truncated?: boolean;
    /** Path relative to CWD at creation time, for stable display */
    displayPath: string;
};
export type AgentMentionAttachment = {
    type: 'agent_mention';
    agentType: string;
};
export type AsyncHookResponseAttachment = {
    type: 'async_hook_response';
    processId: string;
    hookName: string;
    hookEvent: HookEvent | 'StatusLine' | 'FileSuggestion';
    toolName?: string;
    response: SyncHookJSONOutput;
    stdout: string;
    stderr: string;
    exitCode?: number;
};
export type HookAttachment = HookCancelledAttachment | {
    type: 'hook_blocking_error';
    blockingError: HookBlockingError;
    hookName: string;
    toolUseID: string;
    hookEvent: HookEvent;
} | HookNonBlockingErrorAttachment | HookErrorDuringExecutionAttachment | {
    type: 'hook_stopped_continuation';
    message: string;
    hookName: string;
    toolUseID: string;
    hookEvent: HookEvent;
} | HookSuccessAttachment | {
    type: 'hook_additional_context';
    content: string[];
    hookName: string;
    toolUseID: string;
    hookEvent: HookEvent;
} | HookSystemMessageAttachment | HookPermissionDecisionAttachment;
export type HookPermissionDecisionAttachment = {
    type: 'hook_permission_decision';
    decision: 'allow' | 'deny';
    toolUseID: string;
    hookEvent: HookEvent;
};
export type HookSystemMessageAttachment = {
    type: 'hook_system_message';
    content: string;
    hookName: string;
    toolUseID: string;
    hookEvent: HookEvent;
};
export type HookCancelledAttachment = {
    type: 'hook_cancelled';
    hookName: string;
    toolUseID: string;
    hookEvent: HookEvent;
    command?: string;
    durationMs?: number;
};
export type HookErrorDuringExecutionAttachment = {
    type: 'hook_error_during_execution';
    content: string;
    hookName: string;
    toolUseID: string;
    hookEvent: HookEvent;
    command?: string;
    durationMs?: number;
};
export type HookSuccessAttachment = {
    type: 'hook_success';
    content: string;
    hookName: string;
    toolUseID: string;
    hookEvent: HookEvent;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    command?: string;
    durationMs?: number;
};
export type HookNonBlockingErrorAttachment = {
    type: 'hook_non_blocking_error';
    hookName: string;
    stderr: string;
    stdout: string;
    exitCode: number;
    toolUseID: string;
    hookEvent: HookEvent;
    command?: string;
    durationMs?: number;
};
export type Attachment = 
/**
 * User at-mentioned the file
 */
FileAttachment | CompactFileReferenceAttachment | PDFReferenceAttachment | AlreadyReadFileAttachment
/**
 * An at-mentioned file was edited
 */
 | {
    type: 'edited_text_file';
    filename: string;
    snippet: string;
} | {
    type: 'edited_image_file';
    filename: string;
    content: FileReadToolOutput;
} | {
    type: 'directory';
    path: string;
    content: string;
    /** Path relative to CWD at creation time, for stable display */
    displayPath: string;
} | {
    type: 'selected_lines_in_ide';
    ideName: string;
    lineStart: number;
    lineEnd: number;
    filename: string;
    content: string;
    /** Path relative to CWD at creation time, for stable display */
    displayPath: string;
} | {
    type: 'opened_file_in_ide';
    filename: string;
} | {
    type: 'todo_reminder';
    content: TodoList;
    itemCount: number;
} | {
    type: 'task_reminder';
    content: Task[];
    itemCount: number;
} | {
    type: 'nested_memory';
    path: string;
    content: MemoryFileInfo;
    /** Path relative to CWD at creation time, for stable display */
    displayPath: string;
} | {
    type: 'relevant_memories';
    memories: {
        path: string;
        content: string;
        mtimeMs: number;
        /**
         * Pre-computed header string (age + path prefix).  Computed once
         * at attachment-creation time so the rendered bytes are stable
         * across turns — recomputing memoryAge(mtimeMs) at render time
         * calls Date.now(), so "saved 3 days ago" becomes "saved 4 days
         * ago" across turns → different bytes → prompt cache bust.
         * Optional for backward compat with resumed sessions; render
         * path falls back to recomputing if missing.
         */
        header?: string;
        /**
         * lineCount when the file was truncated by readMemoriesForSurfacing,
         * else undefined. Threaded to the readFileState write so
         * getChangedFiles skips truncated memories (partial content would
         * yield a misleading diff).
         */
        limit?: number;
    }[];
} | {
    type: 'dynamic_skill';
    skillDir: string;
    skillNames: string[];
    /** Path relative to CWD at creation time, for stable display */
    displayPath: string;
} | {
    type: 'skill_listing';
    content: string;
    skillCount: number;
    isInitial: boolean;
} | {
    type: 'skill_discovery';
    skills: {
        name: string;
        description: string;
        shortId?: string;
    }[];
    signal: DiscoverySignal;
    source: 'native' | 'aki' | 'both';
} | {
    type: 'queued_command';
    prompt: string | Array<ContentBlockParam>;
    source_uuid?: UUID;
    imagePasteIds?: number[];
    /** Original queue mode — 'prompt' for user messages, 'task-notification' for system events */
    commandMode?: string;
    /** Provenance carried from QueuedCommand so mid-turn drains preserve it */
    origin?: MessageOrigin;
    /** Carried from QueuedCommand.isMeta — distinguishes human-typed from system-injected */
    isMeta?: boolean;
} | {
    type: 'output_style';
    style: string;
} | {
    type: 'diagnostics';
    files: DiagnosticFile[];
    isNew: boolean;
} | {
    type: 'plan_mode';
    reminderType: 'full' | 'sparse';
    isSubAgent?: boolean;
    planFilePath: string;
    planExists: boolean;
} | {
    type: 'plan_mode_reentry';
    planFilePath: string;
} | {
    type: 'plan_mode_exit';
    planFilePath: string;
    planExists: boolean;
} | {
    type: 'auto_mode';
    reminderType: 'full' | 'sparse';
} | {
    type: 'auto_mode_exit';
} | {
    type: 'critical_system_reminder';
    content: string;
} | {
    type: 'plan_file_reference';
    planFilePath: string;
    planContent: string;
} | {
    type: 'mcp_resource';
    server: string;
    uri: string;
    name: string;
    description?: string;
    content: ReadResourceResult;
} | {
    type: 'command_permissions';
    allowedTools: string[];
    model?: string;
} | AgentMentionAttachment | {
    type: 'task_status';
    taskId: string;
    taskType: TaskType;
    status: TaskStatus;
    description: string;
    deltaSummary: string | null;
    outputFilePath?: string;
} | AsyncHookResponseAttachment | {
    type: 'token_usage';
    used: number;
    total: number;
    remaining: number;
} | {
    type: 'budget_usd';
    used: number;
    total: number;
    remaining: number;
} | {
    type: 'output_token_usage';
    turn: number;
    session: number;
    budget: number | null;
} | {
    type: 'structured_output';
    data: unknown;
} | TeammateMailboxAttachment | TeamContextAttachment | HookAttachment | {
    type: 'invoked_skills';
    skills: Array<{
        name: string;
        path: string;
        content: string;
    }>;
} | {
    type: 'verify_plan_reminder';
} | {
    type: 'max_turns_reached';
    maxTurns: number;
    turnCount: number;
} | {
    type: 'current_session_memory';
    content: string;
    path: string;
    tokenCount: number;
} | {
    type: 'teammate_shutdown_batch';
    count: number;
} | {
    type: 'compaction_reminder';
} | {
    type: 'context_efficiency';
} | {
    type: 'date_change';
    newDate: string;
} | {
    type: 'ultrathink_effort';
    level: 'high';
} | {
    type: 'deferred_tools_delta';
    addedNames: string[];
    addedLines: string[];
    removedNames: string[];
} | {
    type: 'agent_listing_delta';
    addedTypes: string[];
    addedLines: string[];
    removedTypes: string[];
    /** True when this is the first announcement in the conversation */
    isInitial: boolean;
    /** Whether to include the "launch multiple agents concurrently" note (non-pro subscriptions) */
    showConcurrencyNote: boolean;
} | {
    type: 'mcp_instructions_delta';
    addedNames: string[];
    addedBlocks: string[];
    removedNames: string[];
} | {
    type: 'companion_intro';
    name: string;
    species: string;
} | {
    type: 'bagel_console';
    errorCount: number;
    warningCount: number;
    sample: string;
};
export type TeammateMailboxAttachment = {
    type: 'teammate_mailbox';
    messages: Array<{
        from: string;
        text: string;
        timestamp: string;
        color?: string;
        summary?: string;
    }>;
};
export type TeamContextAttachment = {
    type: 'team_context';
    agentId: string;
    agentName: string;
    teamName: string;
    teamConfigPath: string;
    taskListPath: string;
};
/**
 * This is janky
 * TODO: Generate attachments when we create messages
 */
export declare function getAttachments(input: string | null, toolUseContext: ToolUseContext, ideSelection: IDESelection | null, queuedCommands: QueuedCommand[], messages?: Message[], querySource?: QuerySource, options?: {
    skipSkillDiscovery?: boolean;
}): Promise<Attachment[]>;
export declare function getQueuedCommandAttachments(queuedCommands: QueuedCommand[]): Promise<Attachment[]>;
export declare function getAgentPendingMessageAttachments(toolUseContext: ToolUseContext): Attachment[];
/**
 * Detects when the local date has changed since the last turn (user coding
 * past midnight) and emits an attachment to notify the model.
 *
 * The date_change attachment is appended at the tail of the conversation,
 * so the model learns the new date without mutating the cached prefix.
 * messages[0] (from getUserContext → prependUserContext) intentionally
 * keeps the stale date — clearing that cache would regenerate the prefix
 * and turn the entire conversation into cache_creation on the next turn
 * (~920K effective tokens per midnight crossing per overnight session).
 *
 * Exported for testing — regression guard for the cache-clear removal.
 */
export declare function getDateChangeAttachments(messages: Message[] | undefined): Attachment[];
export declare function getDeferredToolsDeltaAttachment(tools: Tools, model: string, messages: Message[] | undefined, scanContext?: DeferredToolsDeltaScanContext): Attachment[];
/**
 * Diff the current filtered agent pool against what's already been announced
 * in this conversation (reconstructed from prior agent_listing_delta
 * attachments). Returns [] if nothing changed or the gate is off.
 *
 * The agent list was embedded in AgentTool's description, causing ~10.2% of
 * fleet cache_creation: MCP async connect, /reload-plugins, or
 * permission-mode change → description changes → full tool-schema cache bust.
 * Moving the list here keeps the tool description static.
 *
 * Exported for compact.ts — re-announces the full set after compaction eats
 * prior deltas.
 */
export declare function getAgentListingDeltaAttachment(toolUseContext: ToolUseContext, messages: Message[] | undefined): Attachment[];
export declare function getMcpInstructionsDeltaAttachment(mcpClients: MCPServerConnection[], tools: Tools, model: string, messages: Message[] | undefined): Attachment[];
/**
 * Computes the directories to process for nested memory file loading.
 * Returns two lists:
 * - nestedDirs: Directories between CWD and targetPath (processed for CLAUDE.md + all rules)
 * - cwdLevelDirs: Directories from root to CWD (processed for conditional rules only)
 *
 * @param targetPath The target file path
 * @param originalCwd The original current working directory
 * @returns Object with nestedDirs and cwdLevelDirs arrays, both ordered from parent to child
 */
export declare function getDirectoriesToProcess(targetPath: string, originalCwd: string): {
    nestedDirs: string[];
    cwdLevelDirs: string[];
};
/** Exported for testing — regression guard for LRU-eviction re-injection. */
export declare function memoryFilesToAttachments(memoryFiles: MemoryFileInfo[], toolUseContext: ToolUseContext, triggerFilePath?: string): Attachment[];
export declare function getChangedFiles(toolUseContext: ToolUseContext): Promise<Attachment[]>;
/**
 * Scan messages for past relevant_memories attachments.  Returns both the
 * set of surfaced paths (for selector de-dup) and cumulative byte count
 * (for session-total throttle).  Scanning messages rather than tracking
 * in toolUseContext means compact naturally resets both — old attachments
 * are gone from the compacted transcript, so re-surfacing is valid again.
 */
export declare function collectSurfacedMemories(messages: ReadonlyArray<Message>): {
    paths: Set<string>;
    totalBytes: number;
};
/**
 * Reads a set of relevance-ranked memory files for injection as
 * <system-reminder> attachments. Enforces both MAX_MEMORY_LINES and
 * MAX_MEMORY_BYTES via readFileInRange's truncateOnByteLimit option.
 * Truncation surfaces partial
 * content with a note rather than dropping the file — findRelevantMemories
 * already picked this as most-relevant, so the frontmatter + opening context
 * is worth surfacing even if later lines are cut.
 *
 * Exported for direct testing without mocking the ranker + GB gates.
 */
export declare function readMemoriesForSurfacing(selected: ReadonlyArray<{
    path: string;
    mtimeMs: number;
}>, signal?: AbortSignal): Promise<Array<{
    path: string;
    content: string;
    mtimeMs: number;
    header: string;
    limit?: number;
}>>;
/**
 * Header string for a relevant-memory block.  Exported so messages.ts
 * can fall back for resumed sessions where the stored header is missing.
 */
export declare function memoryHeader(path: string, mtimeMs: number): string;
/**
 * A memory relevance-selector prefetch handle. The promise is started once
 * per user turn and runs while the main model streams and tools execute.
 * At the collect point (post-tools), the caller reads settledAt to
 * consume-if-ready or skip-and-retry-next-iteration — the prefetch never
 * blocks the turn.
 *
 * Disposable: query.ts binds with `using`, so [Symbol.dispose] fires on all
 * generator exit paths (return, throw, .return() closure) — aborting the
 * in-flight request and emitting terminal telemetry without instrumenting
 * each of the ~13 return sites inside the while loop.
 */
export type MemoryPrefetch = {
    promise: Promise<Attachment[]>;
    /** Set by promise.finally(). null until the promise settles. */
    settledAt: number | null;
    /** Set by the collect point in query.ts. -1 until consumed. */
    consumedOnIteration: number;
    [Symbol.dispose](): void;
};
/**
 * Starts the relevant memory search as an async prefetch.
 * Extracts the last real user prompt from messages (skipping isMeta system
 * injections) and kicks off a non-blocking search. Returns a Disposable
 * handle with settlement tracking. Bound with `using` in query.ts.
 */
export declare function startRelevantMemoryPrefetch(messages: ReadonlyArray<Message>, toolUseContext: ToolUseContext): MemoryPrefetch | undefined;
/**
 * Tools that succeeded (and never errored) since the previous real turn
 * boundary.  The memory selector uses this to suppress docs about tools
 * that are working — surfacing reference material for a tool the model
 * is already calling successfully is noise.
 *
 * Any error → tool excluded (model is struggling, docs stay available).
 * No result yet → also excluded (outcome unknown).
 *
 * tool_use lives in assistant content; tool_result in user content
 * (toolUseResult set, isMeta undefined).  Both are within the scan window.
 * Backward scan sees results before uses so we collect both by id and
 * resolve after.
 */
export declare function collectRecentSuccessfulTools(messages: ReadonlyArray<Message>, lastUserMessage: Message): readonly string[];
/**
 * Filters prefetched memory attachments to exclude memories the model already
 * has in context via FileRead/Write/Edit tool calls (any iteration this turn)
 * or a previous turn's memory surfacing — both tracked in the cumulative
 * readFileState. Survivors are then marked in readFileState so subsequent
 * turns won't re-surface them.
 *
 * The mark-after-filter ordering is load-bearing: readMemoriesForSurfacing
 * used to write to readFileState during the prefetch, which meant the filter
 * saw every prefetch-selected path as "already in context" and dropped them
 * all (self-referential filter). Deferring the write to here, after the
 * filter runs, breaks that cycle while still deduping against tool calls
 * from any iteration.
 */
export declare function filterDuplicateMemoryAttachments(attachments: Attachment[], readFileState: FileStateCache): Attachment[];
export declare function resetSentSkillNames(): void;
/**
 * Suppress the next skill-listing injection. Called by conversationRecovery
 * on --resume when a skill_listing attachment already exists in the
 * transcript.
 *
 * `sentSkillNames` is module-scope — process-local. Each `claude -p` spawn
 * starts with an empty Map, so without this every resume re-injects the
 * full ~600-token listing even though it's already in the conversation from
 * the prior process. Shows up on every --resume; particularly loud for
 * daemons that respawn frequently.
 *
 * Trade-off: skills added between sessions won't be announced until the
 * next non-resume session. Acceptable — skill_listing was never meant to
 * cover cross-process deltas, and the agent can still call them (they're
 * in the Skill tool's runtime registry regardless).
 */
export declare function suppressNextSkillListing(): void;
/**
 * Filter skills to bundled (Anthropic-curated) + MCP (user-connected) only.
 * Used when skill-search is enabled to resolve the turn-0 gap for subagents:
 * these sources are small, intent-signaled, and won't hit the truncation budget.
 * User/project/plugin skills (the long tail — 200+) go through discovery instead.
 *
 * Falls back to bundled-only if bundled+mcp exceeds FILTERED_LISTING_MAX.
 */
export declare function filterToBundledAndMcp(commands: Command[]): Command[];
export declare function extractAtMentionedFiles(content: string): string[];
export declare function extractMcpResourceMentions(content: string): string[];
export declare function extractAgentMentions(content: string): string[];
interface AtMentionedFileLines {
    filename: string;
    lineStart?: number;
    lineEnd?: number;
}
export declare function parseAtMentionedFileLines(mention: string): AtMentionedFileLines;
export declare function getAttachmentMessages(input: string | null, toolUseContext: ToolUseContext, ideSelection: IDESelection | null, queuedCommands: QueuedCommand[], messages?: Message[], querySource?: QuerySource, options?: {
    skipSkillDiscovery?: boolean;
}): AsyncGenerator<AttachmentMessage, void>;
/**
 * Generates a file attachment by reading a file with proper validation and truncation.
 * This is the core file reading logic shared between @-mentioned files and post-compact restoration.
 *
 * @param filename The absolute path to the file to read
 * @param toolUseContext The tool use context for calling FileReadTool
 * @param options Optional configuration for file reading
 * @returns A new_file attachment or null if the file couldn't be read
 */
/**
 * Check if a PDF file should be represented as a lightweight reference
 * instead of being inlined. Returns a PDFReferenceAttachment for large PDFs
 * (more than PDF_AT_MENTION_INLINE_THRESHOLD pages), or null otherwise.
 */
export declare function tryGetPDFReference(filename: string): Promise<PDFReferenceAttachment | null>;
export declare function generateFileAttachment(filename: string, toolUseContext: ToolUseContext, successEventName: string, errorEventName: string, mode: 'compact' | 'at-mention', options?: {
    offset?: number;
    limit?: number;
}): Promise<FileAttachment | CompactFileReferenceAttachment | PDFReferenceAttachment | AlreadyReadFileAttachment | null>;
export declare function createAttachmentMessage(attachment: Attachment): AttachmentMessage<Attachment>;
/**
 * Count human turns since plan mode exit (plan_mode_exit attachment).
 * Returns 0 if no plan_mode_exit attachment found.
 *
 * tool_result messages are type:'user' without isMeta, so filter by
 * toolUseResult to avoid counting them — otherwise the 10-turn reminder
 * interval fires every ~10 tool calls instead of ~10 human turns.
 */
export declare function getVerifyPlanReminderTurnCount(messages: Message[]): number;
export declare function getCompactionReminderAttachment(messages: Message[], model: string): Attachment[];
/**
 * Context-efficiency nudge. Injected after every N tokens of growth without
 * a snip. Pacing is handled entirely by shouldNudgeForSnips — the 10k
 * interval resets on prior nudges, snip markers, snip boundaries, and
 * compact boundaries.
 */
export declare function getContextEfficiencyAttachment(messages: Message[]): Attachment[];
export {};
//# sourceMappingURL=attachments.d.ts.map