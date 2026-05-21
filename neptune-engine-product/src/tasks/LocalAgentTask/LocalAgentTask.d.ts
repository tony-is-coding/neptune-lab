import type { AppState } from '../../state/AppState.js';
import type { SetAppState, Task, TaskStateBase } from '../../Task.js';
import type { Tools } from '../../Tool.js';
import type { AgentToolResult } from '@neptune/builtin-tools/tools/AgentTool/agentToolUtils.js';
import type { AgentDefinition } from '@neptune/builtin-tools/tools/AgentTool/loadAgentsDir.js';
import type { Message } from '../../types/message.js';
import type { TaskState } from '../types.js';
export type ToolActivity = {
    toolName: string;
    input: Record<string, unknown>;
    /** Pre-computed activity description from the tool, e.g. "Reading src/foo.ts" */
    activityDescription?: string;
    /** Pre-computed: true if this is a search operation (Grep, Glob, etc.) */
    isSearch?: boolean;
    /** Pre-computed: true if this is a read operation (Read, cat, etc.) */
    isRead?: boolean;
};
export type AgentProgress = {
    toolUseCount: number;
    tokenCount: number;
    lastActivity?: ToolActivity;
    recentActivities?: ToolActivity[];
    summary?: string;
};
export type ProgressTracker = {
    toolUseCount: number;
    latestInputTokens: number;
    cumulativeOutputTokens: number;
    recentActivities: ToolActivity[];
};
export declare function createProgressTracker(): ProgressTracker;
export declare function getTokenCountFromTracker(tracker: ProgressTracker): number;
/**
 * Resolver function that returns a human-readable activity description
 * for a given tool name and input. Used to pre-compute descriptions
 * from Tool.getActivityDescription() at recording time.
 */
export type ActivityDescriptionResolver = (toolName: string, input: Record<string, unknown>) => string | undefined;
export declare function updateProgressFromMessage(tracker: ProgressTracker, message: Message, resolveActivityDescription?: ActivityDescriptionResolver, tools?: Tools): void;
export declare function getProgressUpdate(tracker: ProgressTracker): AgentProgress;
/**
 * Creates an ActivityDescriptionResolver from a tools list.
 * Looks up the tool by name and calls getActivityDescription if available.
 */
export declare function createActivityDescriptionResolver(tools: Tools): ActivityDescriptionResolver;
export type LocalAgentTaskState = TaskStateBase & {
    type: 'local_agent';
    agentId: string;
    prompt: string;
    selectedAgent?: AgentDefinition;
    agentType: string;
    model?: string;
    abortController?: AbortController;
    unregisterCleanup?: () => void;
    error?: string;
    result?: AgentToolResult;
    progress?: AgentProgress;
    retrieved: boolean;
    messages?: Message[];
    lastReportedToolCount: number;
    lastReportedTokenCount: number;
    isBackgrounded: boolean;
    pendingMessages: string[];
    retain: boolean;
    diskLoaded: boolean;
    evictAfter?: number;
};
export declare function isLocalAgentTask(task: unknown): task is LocalAgentTaskState;
/**
 * A local_agent task that the CoordinatorTaskPanel manages (not main-session).
 * For ants, these render in the panel instead of the background-task pill.
 * This is the ONE predicate that all pill/panel filters must agree on — if
 * the gate changes, change it here.
 */
export declare function isPanelAgentTask(t: unknown): t is LocalAgentTaskState;
export declare function queuePendingMessage(taskId: string, msg: string, setAppState: (f: (prev: AppState) => AppState) => void): void;
/**
 * Append a message to task.messages so it appears in the viewed transcript
 * immediately. Caller constructs the Message (breaks the messages.ts cycle).
 * queuePendingMessage and resumeAgentBackground route the prompt to the
 * agent's API input but don't touch the display.
 */
export declare function appendMessageToLocalAgent(taskId: string, message: Message, setAppState: (f: (prev: AppState) => AppState) => void): void;
export declare function drainPendingMessages(taskId: string, getAppState: () => AppState, setAppState: (f: (prev: AppState) => AppState) => void): string[];
/**
 * Enqueue an agent notification to the message queue.
 */
export declare function enqueueAgentNotification({ taskId, description, status, error, setAppState, finalMessage, usage, toolUseId, worktreePath, worktreeBranch, }: {
    taskId: string;
    description: string;
    status: 'completed' | 'failed' | 'killed';
    error?: string;
    setAppState: SetAppState;
    finalMessage?: string;
    usage?: {
        totalTokens: number;
        toolUses: number;
        durationMs: number;
    };
    toolUseId?: string;
    worktreePath?: string;
    worktreeBranch?: string;
}): void;
/**
 * LocalAgentTask - Handles background agent execution.
 *
 * Replaces the AsyncAgent implementation from src/tools/AgentTool/asyncAgentUtils.ts
 * with a unified Task interface.
 */
export declare const LocalAgentTask: Task;
/**
 * Kill an agent task. No-op if already killed/completed.
 */
export declare function killAsyncAgent(taskId: string, setAppState: SetAppState): void;
/**
 * Kill all running agent tasks.
 * Used by ESC cancellation in coordinator mode to stop all subagents.
 */
export declare function killAllRunningAgentTasks(tasks: Record<string, TaskState>, setAppState: SetAppState): void;
/**
 * Mark a task as notified without enqueueing a notification.
 * Used by chat:killAgents bulk kill to suppress per-agent async notifications
 * when a single aggregate message is sent instead.
 */
export declare function markAgentsNotified(taskId: string, setAppState: SetAppState): void;
/**
 * Update progress for an agent task.
 * Preserves the existing summary field so that background summarization
 * results are not clobbered by progress updates from assistant messages.
 */
export declare function updateAgentProgress(taskId: string, progress: AgentProgress, setAppState: SetAppState): void;
/**
 * Update the background summary for an agent task.
 * Called by the periodic summarization service to store a 1-2 sentence progress summary.
 */
export declare function updateAgentSummary(taskId: string, summary: string, setAppState: SetAppState): void;
/**
 * Complete an agent task with result.
 */
export declare function completeAgentTask(result: AgentToolResult, setAppState: SetAppState): void;
/**
 * Fail an agent task with error.
 */
export declare function failAgentTask(taskId: string, error: string, setAppState: SetAppState): void;
/**
 * Register an agent task.
 * Called by AgentTool to create a new background agent.
 *
 * @param parentAbortController - Optional parent abort controller. If provided,
 *   the agent's abort controller will be a child that auto-aborts when parent aborts.
 *   This ensures subagents are aborted when their parent (e.g., in-process teammate) aborts.
 */
export declare function registerAsyncAgent({ agentId, description, prompt, selectedAgent, setAppState, parentAbortController, toolUseId, }: {
    agentId: string;
    description: string;
    prompt: string;
    selectedAgent: AgentDefinition;
    setAppState: SetAppState;
    parentAbortController?: AbortController;
    toolUseId?: string;
}): LocalAgentTaskState;
/**
 * Register a foreground agent task that could be backgrounded later.
 * Called when an agent has been running long enough to show the BackgroundHint.
 * @returns object with taskId and backgroundSignal promise
 */
export declare function registerAgentForeground({ agentId, description, prompt, selectedAgent, setAppState, autoBackgroundMs, toolUseId, }: {
    agentId: string;
    description: string;
    prompt: string;
    selectedAgent: AgentDefinition;
    setAppState: SetAppState;
    autoBackgroundMs?: number;
    toolUseId?: string;
}): {
    taskId: string;
    backgroundSignal: Promise<void>;
    cancelAutoBackground?: () => void;
};
/**
 * Background a specific foreground agent task.
 * @returns true if backgrounded successfully, false otherwise
 */
export declare function backgroundAgentTask(taskId: string, getAppState: () => AppState, setAppState: SetAppState): boolean;
/**
 * Unregister a foreground agent task when the agent completes without being backgrounded.
 */
export declare function unregisterAgentForeground(taskId: string, setAppState: SetAppState): void;
//# sourceMappingURL=LocalAgentTask.d.ts.map