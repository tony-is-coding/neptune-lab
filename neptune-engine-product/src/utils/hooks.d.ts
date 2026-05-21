import type { AgentId } from '../types/ids.js';
import { type HookCallback, type PromptRequest, type PromptResponse, type PermissionRequestResult } from '../types/hooks.js';
import type { HookEvent, HookInput, PermissionUpdate, ExitReason } from 'src/entrypoints/agentSdkTypes.js';
import type { StatusLineCommandInput } from '../types/statusLine.js';
import type { ElicitResult } from '@modelcontextprotocol/sdk/types.js';
import type { FileSuggestionCommandInput } from '../types/fileSuggestion.js';
import type { HookResultMessage } from 'src/types/message.js';
import type { HookCommand } from './settings/types.js';
import type { PermissionResult } from './permissions/PermissionResult.js';
import { type Tools, type ToolUseContext } from '../Tool.js';
import type { Message, AssistantMessage } from '../types/message.js';
import { type FunctionHook } from './hooks/sessionHooks.js';
import type { AppState } from '../state/AppState.js';
export declare function getSessionEndHookTimeoutMs(): number;
/**
 * Checks if a hook should be skipped due to lack of workspace trust.
 *
 * ALL hooks require workspace trust because they execute arbitrary commands from
 * .claude/settings.json. This is a defense-in-depth security measure.
 *
 * Context: Hooks are captured via captureHooksConfigSnapshot() before the trust
 * dialog is shown. While most hooks won't execute until after trust is established
 * through normal program flow, enforcing trust for ALL hooks prevents:
 * - Future bugs where a hook might accidentally execute before trust
 * - Any codepath that might trigger hooks before trust dialog
 * - Security issues from hook execution in untrusted workspaces
 *
 * Historical vulnerabilities that prompted this check:
 * - SessionEnd hooks executing when user declines trust dialog
 * - SubagentStop hooks executing when subagent completes before trust
 *
 * @returns true if hook should be skipped, false if it should execute
 */
export declare function shouldSkipHookDueToTrust(): boolean;
/**
 * Creates the base hook input that's common to all hook types
 */
export declare function createBaseHookInput(permissionMode?: string, sessionId?: string, agentInfo?: {
    agentId?: string;
    agentType?: string;
}): {
    session_id: string;
    transcript_path: string;
    cwd: string;
    permission_mode?: string;
    agent_id?: string;
    agent_type?: string;
};
export interface HookBlockingError {
    blockingError: string;
    command: string;
}
/** Re-export ElicitResult from MCP SDK as ElicitationResponse for backward compat. */
export type ElicitationResponse = ElicitResult;
export interface HookResult {
    message?: HookResultMessage;
    systemMessage?: string;
    blockingError?: HookBlockingError;
    outcome: 'success' | 'blocking' | 'non_blocking_error' | 'cancelled';
    preventContinuation?: boolean;
    stopReason?: string;
    permissionBehavior?: 'ask' | 'deny' | 'allow' | 'passthrough';
    hookPermissionDecisionReason?: string;
    additionalContext?: string;
    initialUserMessage?: string;
    updatedInput?: Record<string, unknown>;
    updatedMCPToolOutput?: unknown;
    permissionRequestResult?: PermissionRequestResult;
    elicitationResponse?: ElicitationResponse;
    watchPaths?: string[];
    elicitationResultResponse?: ElicitationResponse;
    retry?: boolean;
    hook: HookCommand | HookCallback | FunctionHook;
}
export type AggregatedHookResult = {
    message?: HookResultMessage;
    blockingError?: HookBlockingError;
    preventContinuation?: boolean;
    stopReason?: string;
    hookPermissionDecisionReason?: string;
    hookSource?: string;
    permissionBehavior?: PermissionResult['behavior'];
    additionalContexts?: string[];
    initialUserMessage?: string;
    updatedInput?: Record<string, unknown>;
    updatedMCPToolOutput?: unknown;
    permissionRequestResult?: PermissionRequestResult;
    watchPaths?: string[];
    elicitationResponse?: ElicitationResponse;
    elicitationResultResponse?: ElicitationResponse;
    retry?: boolean;
};
/**
 * A hook paired with optional plugin context.
 * Used when returning matched hooks so we can apply plugin env vars at execution time.
 */
type MatchedHook = {
    hook: HookCommand | HookCallback | FunctionHook;
    pluginRoot?: string;
    pluginId?: string;
    skillRoot?: string;
    hookSource?: string;
};
/**
 * Get hook commands that match the given query
 * @param appState The current app state (optional for backwards compatibility)
 * @param sessionId The current session ID (main session or agent ID)
 * @param hookEvent The hook event
 * @param hookInput The hook input for matching
 * @returns Array of matched hooks with optional plugin context
 */
export declare function getMatchingHooks(appState: AppState | undefined, sessionId: string, hookEvent: HookEvent, hookInput: HookInput, tools?: Tools): Promise<MatchedHook[]>;
/**
 * Format a list of blocking errors from a PreTool hook's configured commands.
 * @param hookName The name of the hook (e.g., 'PreToolUse:Write', 'PreToolUse:Edit', 'PreToolUse:Bash')
 * @param blockingErrors Array of blocking errors from hooks
 * @returns Formatted blocking message
 */
export declare function getPreToolHookBlockingMessage(hookName: string, blockingError: HookBlockingError): string;
/**
 * Format a list of blocking errors from a Stop hook's configured commands.
 * @param blockingErrors Array of blocking errors from hooks
 * @returns Formatted message to give feedback to the model
 */
export declare function getStopHookMessage(blockingError: HookBlockingError): string;
/**
 * Format a blocking error from a TeammateIdle hook.
 * @param blockingError The blocking error from the hook
 * @returns Formatted message to give feedback to the model
 */
export declare function getTeammateIdleHookMessage(blockingError: HookBlockingError): string;
/**
 * Format a blocking error from a TaskCreated hook.
 * @param blockingError The blocking error from the hook
 * @returns Formatted message to give feedback to the model
 */
export declare function getTaskCreatedHookMessage(blockingError: HookBlockingError): string;
/**
 * Format a blocking error from a TaskCompleted hook.
 * @param blockingError The blocking error from the hook
 * @returns Formatted message to give feedback to the model
 */
export declare function getTaskCompletedHookMessage(blockingError: HookBlockingError): string;
/**
 * Format a list of blocking errors from a UserPromptSubmit hook's configured commands.
 * @param blockingErrors Array of blocking errors from hooks
 * @returns Formatted blocking message
 */
export declare function getUserPromptSubmitHookBlockingMessage(blockingError: HookBlockingError): string;
export type HookOutsideReplResult = {
    command: string;
    succeeded: boolean;
    output: string;
    blocked: boolean;
    watchPaths?: string[];
    systemMessage?: string;
};
export declare function hasBlockingResult(results: HookOutsideReplResult[]): boolean;
/**
 * Execute pre-tool hooks if configured
 * @param toolName The name of the tool (e.g., 'Write', 'Edit', 'Bash')
 * @param toolUseID The ID of the tool use
 * @param toolInput The input that will be passed to the tool
 * @param permissionMode Optional permission mode from toolPermissionContext
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @param toolUseContext Optional ToolUseContext for prompt-based hooks
 * @returns Async generator that yields progress messages and returns blocking errors
 */
export declare function executePreToolHooks<ToolInput>(toolName: string, toolUseID: string, toolInput: ToolInput, toolUseContext: ToolUseContext, permissionMode?: string, signal?: AbortSignal, timeoutMs?: number, requestPrompt?: (sourceName: string, toolInputSummary?: string | null) => (request: PromptRequest) => Promise<PromptResponse>, toolInputSummary?: string | null): AsyncGenerator<AggregatedHookResult>;
/**
 * Execute post-tool hooks if configured
 * @param toolName The name of the tool (e.g., 'Write', 'Edit', 'Bash')
 * @param toolUseID The ID of the tool use
 * @param toolInput The input that was passed to the tool
 * @param toolResponse The response from the tool
 * @param toolUseContext ToolUseContext for prompt-based hooks
 * @param permissionMode Optional permission mode from toolPermissionContext
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @returns Async generator that yields progress messages and blocking errors for automated feedback
 */
export declare function executePostToolHooks<ToolInput, ToolResponse>(toolName: string, toolUseID: string, toolInput: ToolInput, toolResponse: ToolResponse, toolUseContext: ToolUseContext, permissionMode?: string, signal?: AbortSignal, timeoutMs?: number): AsyncGenerator<AggregatedHookResult>;
/**
 * Execute post-tool-use-failure hooks if configured
 * @param toolName The name of the tool (e.g., 'Write', 'Edit', 'Bash')
 * @param toolUseID The ID of the tool use
 * @param toolInput The input that was passed to the tool
 * @param error The error message from the failed tool call
 * @param toolUseContext ToolUseContext for prompt-based hooks
 * @param isInterrupt Whether the tool was interrupted by user
 * @param permissionMode Optional permission mode from toolPermissionContext
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @returns Async generator that yields progress messages and blocking errors
 */
export declare function executePostToolUseFailureHooks<ToolInput>(toolName: string, toolUseID: string, toolInput: ToolInput, error: string, toolUseContext: ToolUseContext, isInterrupt?: boolean, permissionMode?: string, signal?: AbortSignal, timeoutMs?: number): AsyncGenerator<AggregatedHookResult>;
export declare function executePermissionDeniedHooks<ToolInput>(toolName: string, toolUseID: string, toolInput: ToolInput, reason: string, toolUseContext: ToolUseContext, permissionMode?: string, signal?: AbortSignal, timeoutMs?: number): AsyncGenerator<AggregatedHookResult>;
/**
 * Execute notification hooks if configured
 * @param notificationData The notification data to pass to hooks
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @returns Promise that resolves when all hooks complete
 */
export declare function executeNotificationHooks(notificationData: {
    message: string;
    title?: string;
    notificationType: string;
}, timeoutMs?: number): Promise<void>;
export declare function executeStopFailureHooks(lastMessage: AssistantMessage, toolUseContext?: ToolUseContext, timeoutMs?: number): Promise<void>;
/**
 * Execute stop hooks if configured
 * @param toolUseContext ToolUseContext for prompt-based hooks
 * @param permissionMode permission mode from toolPermissionContext
 * @param signal AbortSignal to cancel hook execution
 * @param stopHookActive Whether this call is happening within another stop hook
 * @param isSubagent Whether the current execution context is a subagent
 * @param messages Optional conversation history for prompt/function hooks
 * @returns Async generator that yields progress messages and blocking errors
 */
export declare function executeStopHooks(permissionMode?: string, signal?: AbortSignal, timeoutMs?: number, stopHookActive?: boolean, subagentId?: AgentId, toolUseContext?: ToolUseContext, messages?: Message[], agentType?: string, requestPrompt?: (sourceName: string, toolInputSummary?: string | null) => (request: PromptRequest) => Promise<PromptResponse>): AsyncGenerator<AggregatedHookResult>;
/**
 * Execute TeammateIdle hooks when a teammate is about to go idle.
 * If a hook blocks (exit code 2), the teammate should continue working instead of going idle.
 * @param teammateName The name of the teammate going idle
 * @param teamName The team this teammate belongs to
 * @param permissionMode Optional permission mode
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @returns Async generator that yields progress messages and blocking errors
 */
export declare function executeTeammateIdleHooks(teammateName: string, teamName: string, permissionMode?: string, signal?: AbortSignal, timeoutMs?: number): AsyncGenerator<AggregatedHookResult>;
/**
 * Execute TaskCreated hooks when a task is being created.
 * If a hook blocks (exit code 2), the task creation should be prevented and feedback returned.
 * @param taskId The ID of the task being created
 * @param taskSubject The subject/title of the task
 * @param taskDescription Optional description of the task
 * @param teammateName Optional name of the teammate creating the task
 * @param teamName Optional team name
 * @param permissionMode Optional permission mode
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @param toolUseContext Optional ToolUseContext for resolving appState and sessionId
 * @returns Async generator that yields progress messages and blocking errors
 */
export declare function executeTaskCreatedHooks(taskId: string, taskSubject: string, taskDescription?: string, teammateName?: string, teamName?: string, permissionMode?: string, signal?: AbortSignal, timeoutMs?: number, toolUseContext?: ToolUseContext): AsyncGenerator<AggregatedHookResult>;
/**
 * Execute TaskCompleted hooks when a task is being marked as completed.
 * If a hook blocks (exit code 2), the task completion should be prevented and feedback returned.
 * @param taskId The ID of the task being completed
 * @param taskSubject The subject/title of the task
 * @param taskDescription Optional description of the task
 * @param teammateName Optional name of the teammate completing the task
 * @param teamName Optional team name
 * @param permissionMode Optional permission mode
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @param toolUseContext Optional ToolUseContext for resolving appState and sessionId
 * @returns Async generator that yields progress messages and blocking errors
 */
export declare function executeTaskCompletedHooks(taskId: string, taskSubject: string, taskDescription?: string, teammateName?: string, teamName?: string, permissionMode?: string, signal?: AbortSignal, timeoutMs?: number, toolUseContext?: ToolUseContext): AsyncGenerator<AggregatedHookResult>;
/**
 * Execute start hooks if configured
 * @param prompt The user prompt that will be passed to the tool
 * @param permissionMode Permission mode from toolPermissionContext
 * @param toolUseContext ToolUseContext for prompt-based hooks
 * @returns Async generator that yields progress messages and hook results
 */
export declare function executeUserPromptSubmitHooks(prompt: string, permissionMode: string, toolUseContext: ToolUseContext, requestPrompt?: (sourceName: string, toolInputSummary?: string | null) => (request: PromptRequest) => Promise<PromptResponse>): AsyncGenerator<AggregatedHookResult>;
/**
 * Execute session start hooks if configured
 * @param source The source of the session start (startup, resume, clear)
 * @param sessionId Optional The session id to use as hook input
 * @param agentType Optional The agent type (from --agent flag) running this session
 * @param model Optional The model being used for this session
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @returns Async generator that yields progress messages and hook results
 */
export declare function executeSessionStartHooks(source: 'startup' | 'resume' | 'clear' | 'compact', sessionId?: string, agentType?: string, model?: string, signal?: AbortSignal, timeoutMs?: number, forceSyncExecution?: boolean): AsyncGenerator<AggregatedHookResult>;
/**
 * Execute setup hooks if configured
 * @param trigger The trigger type ('init' or 'maintenance')
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @param forceSyncExecution If true, async hooks will not be backgrounded
 * @returns Async generator that yields progress messages and hook results
 */
export declare function executeSetupHooks(trigger: 'init' | 'maintenance', signal?: AbortSignal, timeoutMs?: number, forceSyncExecution?: boolean): AsyncGenerator<AggregatedHookResult>;
/**
 * Execute subagent start hooks if configured
 * @param agentId The unique identifier for the subagent
 * @param agentType The type/name of the subagent being started
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @returns Async generator that yields progress messages and hook results
 */
export declare function executeSubagentStartHooks(agentId: string, agentType: string, signal?: AbortSignal, timeoutMs?: number): AsyncGenerator<AggregatedHookResult>;
/**
 * Execute pre-compact hooks if configured
 * @param compactData The compact data to pass to hooks
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @returns Object with optional newCustomInstructions and userDisplayMessage
 */
export declare function executePreCompactHooks(compactData: {
    trigger: 'manual' | 'auto';
    customInstructions: string | null;
}, signal?: AbortSignal, timeoutMs?: number): Promise<{
    newCustomInstructions?: string;
    userDisplayMessage?: string;
}>;
/**
 * Execute post-compact hooks if configured
 * @param compactData The compact data to pass to hooks, including the summary
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @returns Object with optional userDisplayMessage
 */
export declare function executePostCompactHooks(compactData: {
    trigger: 'manual' | 'auto';
    compactSummary: string;
}, signal?: AbortSignal, timeoutMs?: number): Promise<{
    userDisplayMessage?: string;
}>;
/**
 * Execute session end hooks if configured
 * @param reason The reason for ending the session
 * @param options Optional parameters including app state functions and signal
 * @returns Promise that resolves when all hooks complete
 */
export declare function executeSessionEndHooks(reason: ExitReason, options?: {
    getAppState?: () => AppState;
    setAppState?: (updater: (prev: AppState) => AppState) => void;
    signal?: AbortSignal;
    timeoutMs?: number;
}): Promise<void>;
/**
 * Execute permission request hooks if configured
 * These hooks are called when a permission dialog would be displayed to the user.
 * Hooks can approve or deny the permission request programmatically.
 * @param toolName The name of the tool requesting permission
 * @param toolUseID The ID of the tool use
 * @param toolInput The input that would be passed to the tool
 * @param toolUseContext ToolUseContext for the request
 * @param permissionMode Optional permission mode from toolPermissionContext
 * @param permissionSuggestions Optional permission suggestions (the "always allow" options)
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @returns Async generator that yields progress messages and returns aggregated result
 */
export declare function executePermissionRequestHooks<ToolInput>(toolName: string, toolUseID: string, toolInput: ToolInput, toolUseContext: ToolUseContext, permissionMode?: string, permissionSuggestions?: PermissionUpdate[], signal?: AbortSignal, timeoutMs?: number, requestPrompt?: (sourceName: string, toolInputSummary?: string | null) => (request: PromptRequest) => Promise<PromptResponse>, toolInputSummary?: string | null): AsyncGenerator<AggregatedHookResult>;
export type ConfigChangeSource = 'user_settings' | 'project_settings' | 'local_settings' | 'policy_settings' | 'skills';
/**
 * Execute config change hooks when configuration files change during a session.
 * Fired by file watchers when settings, skills, or commands change on disk.
 * Enables enterprise admins to audit/log configuration changes for security.
 *
 * Policy settings are enterprise-managed and must never be blockable by hooks.
 * Hooks still fire (for audit logging) but blocking results are ignored — callers
 * will always see an empty result for policy sources.
 *
 * @param source The type of config that changed
 * @param filePath Optional path to the changed file
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 */
export declare function executeConfigChangeHooks(source: ConfigChangeSource, filePath?: string, timeoutMs?: number): Promise<HookOutsideReplResult[]>;
export declare function executeCwdChangedHooks(oldCwd: string, newCwd: string, timeoutMs?: number): Promise<{
    results: HookOutsideReplResult[];
    watchPaths: string[];
    systemMessages: string[];
}>;
export declare function executeFileChangedHooks(filePath: string, event: 'change' | 'add' | 'unlink', timeoutMs?: number): Promise<{
    results: HookOutsideReplResult[];
    watchPaths: string[];
    systemMessages: string[];
}>;
export type InstructionsLoadReason = 'session_start' | 'nested_traversal' | 'path_glob_match' | 'include' | 'compact';
export type InstructionsMemoryType = 'User' | 'Project' | 'Local' | 'Managed';
/**
 * Check if InstructionsLoaded hooks are configured (without executing them).
 * Callers should check this before invoking executeInstructionsLoadedHooks to avoid
 * building hook inputs for every instruction file when no hook is configured.
 *
 * Checks both settings-file hooks (getHooksConfigFromSnapshot) and registered
 * hooks (plugin hooks + SDK callback hooks via registerHookCallbacks). Session-
 * derived hooks (structured output enforcement etc.) are internal and not checked.
 */
export declare function hasInstructionsLoadedHook(): boolean;
/**
 * Execute InstructionsLoaded hooks when an instruction file (CLAUDE.md or
 * .claude/rules/*.md) is loaded into context. Fire-and-forget — this hook is
 * for observability/audit only and does not support blocking.
 *
 * Dispatch sites:
 * - Eager load at session start (getMemoryFiles in claudemd.ts)
 * - Eager reload after compaction (getMemoryFiles cache cleared by
 *   runPostCompactCleanup; next call reports load_reason: 'compact')
 * - Lazy load when Claude touches a file that triggers nested CLAUDE.md or
 *   conditional rules with paths: frontmatter (memoryFilesToAttachments in
 *   attachments.ts)
 */
export declare function executeInstructionsLoadedHooks(filePath: string, memoryType: InstructionsMemoryType, loadReason: InstructionsLoadReason, options?: {
    globs?: string[];
    triggerFilePath?: string;
    parentFilePath?: string;
    timeoutMs?: number;
}): Promise<void>;
/** Result of an elicitation hook execution (non-REPL path). */
export type ElicitationHookResult = {
    elicitationResponse?: ElicitationResponse;
    blockingError?: HookBlockingError;
};
/** Result of an elicitation-result hook execution (non-REPL path). */
export type ElicitationResultHookResult = {
    elicitationResultResponse?: ElicitationResponse;
    blockingError?: HookBlockingError;
};
export declare function executeElicitationHooks({ serverName, message, requestedSchema, permissionMode, signal, timeoutMs, mode, url, elicitationId, }: {
    serverName: string;
    message: string;
    requestedSchema?: Record<string, unknown>;
    permissionMode?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
    mode?: 'form' | 'url';
    url?: string;
    elicitationId?: string;
}): Promise<ElicitationHookResult>;
export declare function executeElicitationResultHooks({ serverName, action, content, permissionMode, signal, timeoutMs, mode, elicitationId, }: {
    serverName: string;
    action: 'accept' | 'decline' | 'cancel';
    content?: Record<string, unknown>;
    permissionMode?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
    mode?: 'form' | 'url';
    elicitationId?: string;
}): Promise<ElicitationResultHookResult>;
/**
 * Execute status line command if configured
 * @param statusLineInput The structured status input that will be converted to JSON
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @returns The status line text to display, or undefined if no command configured
 */
export declare function executeStatusLineCommand(statusLineInput: StatusLineCommandInput, signal?: AbortSignal, timeoutMs?: number, // Short timeout for status line
logResult?: boolean): Promise<string | undefined>;
/**
 * Execute file suggestion command if configured
 * @param fileSuggestionInput The structured input that will be converted to JSON
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @returns Array of file paths, or empty array if no command configured
 */
export declare function executeFileSuggestionCommand(fileSuggestionInput: FileSuggestionCommandInput, signal?: AbortSignal, timeoutMs?: number): Promise<string[]>;
/**
 * Check if WorktreeCreate hooks are configured (without executing them).
 *
 * Checks both settings-file hooks (getHooksConfigFromSnapshot) and registered
 * hooks (plugin hooks + SDK callback hooks via registerHookCallbacks).
 *
 * Must mirror the managedOnly filtering in getHooksConfig() — when
 * shouldAllowManagedHooksOnly() is true, plugin hooks (pluginRoot set) are
 * skipped at execution, so we must also skip them here. Otherwise this returns
 * true but executeWorktreeCreateHook() finds no matching hooks and throws,
 * blocking the git-worktree fallback.
 */
export declare function hasWorktreeCreateHook(): boolean;
/**
 * Execute WorktreeCreate hooks.
 * Returns the worktree path from hook stdout.
 * Throws if hooks fail or produce no output.
 * Callers should check hasWorktreeCreateHook() before calling this.
 */
export declare function executeWorktreeCreateHook(name: string): Promise<{
    worktreePath: string;
}>;
/**
 * Execute WorktreeRemove hooks if configured.
 * Returns true if hooks were configured and ran, false if no hooks are configured.
 *
 * Checks both settings-file hooks (getHooksConfigFromSnapshot) and registered
 * hooks (plugin hooks + SDK callback hooks via registerHookCallbacks).
 */
export declare function executeWorktreeRemoveHook(worktreePath: string): Promise<boolean>;
export {};
//# sourceMappingURL=hooks.d.ts.map