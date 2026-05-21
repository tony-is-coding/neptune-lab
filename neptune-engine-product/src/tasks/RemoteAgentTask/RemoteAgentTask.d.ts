import type { SDKMessage } from '../../entrypoints/agentSdkTypes.js';
import type { SetAppState, Task, TaskContext, TaskStateBase } from '../../Task.js';
import { type BackgroundRemoteSessionPrecondition } from '../../utils/background/remote/remoteSession.js';
export type { BackgroundRemoteSessionPrecondition };
import type { TodoList } from '../../utils/todo/types.js';
import type { UltraplanPhase } from '../../utils/ultraplan/ccrSession.js';
export type RemoteAgentTaskState = TaskStateBase & {
    type: 'remote_agent';
    remoteTaskType: RemoteTaskType;
    /** Task-specific metadata (PR number, repo, etc.). */
    remoteTaskMetadata?: RemoteTaskMetadata;
    sessionId: string;
    command: string;
    title: string;
    todoList: TodoList;
    log: SDKMessage[];
    /**
     * Long-running agent that will not be marked as complete after the first `result`.
     */
    isLongRunning?: boolean;
    /**
     * When the local poller started watching this task (at spawn or on restore).
     * Review timeout clocks from here so a restore doesn't immediately time out
     * a task spawned >30min ago.
     */
    pollStartedAt: number;
    /** True when this task was created by a teleported /ultrareview command. */
    isRemoteReview?: boolean;
    /** Parsed from the orchestrator's <remote-review-progress> heartbeat echoes. */
    reviewProgress?: {
        stage?: 'finding' | 'verifying' | 'synthesizing';
        bugsFound: number;
        bugsVerified: number;
        bugsRefuted: number;
    };
    isUltraplan?: boolean;
    /**
     * Scanner-derived pill state. Undefined = running. `needs_input` when the
     * remote asked a clarifying question and is idle; `plan_ready` when
     * ExitPlanMode is awaiting browser approval. Surfaced in the pill badge
     * and detail dialog status line.
     */
    ultraplanPhase?: Exclude<UltraplanPhase, 'running'>;
};
declare const REMOTE_TASK_TYPES: readonly ["remote-agent", "ultraplan", "ultrareview", "autofix-pr", "background-pr"];
export type RemoteTaskType = (typeof REMOTE_TASK_TYPES)[number];
export type AutofixPrRemoteTaskMetadata = {
    owner: string;
    repo: string;
    prNumber: number;
};
export type RemoteTaskMetadata = AutofixPrRemoteTaskMetadata;
/**
 * Called on every poll tick for tasks with a matching remoteTaskType. Return a
 * non-null string to complete the task (string becomes the notification text),
 * or null to keep polling. Checkers that hit external APIs should self-throttle.
 */
export type RemoteTaskCompletionChecker = (remoteTaskMetadata: RemoteTaskMetadata | undefined) => Promise<string | null>;
/**
 * Register a completion checker for a remote task type. Invoked on every poll
 * tick; survives --resume via the sidecar's remoteTaskType + remoteTaskMetadata.
 */
export declare function registerCompletionChecker(remoteTaskType: RemoteTaskType, checker: RemoteTaskCompletionChecker): void;
export type RemoteAgentPreconditionResult = {
    eligible: true;
} | {
    eligible: false;
    errors: BackgroundRemoteSessionPrecondition[];
};
/**
 * Check eligibility for creating a remote agent session.
 */
export declare function checkRemoteAgentEligibility({ skipBundle, }?: {
    skipBundle?: boolean;
}): Promise<RemoteAgentPreconditionResult>;
/**
 * Format precondition error for display.
 */
export declare function formatPreconditionError(error: BackgroundRemoteSessionPrecondition): string;
/**
 * Extract the plan content from the remote session log.
 * Searches all assistant messages for <ultraplan>...</ultraplan> tags.
 */
export declare function extractPlanFromLog(log: SDKMessage[]): string | null;
/**
 * Enqueue an ultraplan-specific failure notification. Unlike enqueueRemoteNotification
 * this does NOT instruct the model to read the raw output file (a JSONL dump that is
 * useless for plan extraction).
 */
export declare function enqueueUltraplanFailureNotification(taskId: string, sessionId: string, reason: string, setAppState: SetAppState): void;
/**
 * Register a remote agent task in the unified task framework.
 * Bundles task ID generation, output init, state creation, registration, and polling.
 * Callers remain responsible for custom pre-registration logic (git dialogs, transcript upload, teleport options).
 */
export declare function registerRemoteAgentTask(options: {
    remoteTaskType: RemoteTaskType;
    session: {
        id: string;
        title: string;
    };
    command: string;
    context: TaskContext;
    toolUseId?: string;
    isRemoteReview?: boolean;
    isUltraplan?: boolean;
    isLongRunning?: boolean;
    remoteTaskMetadata?: RemoteTaskMetadata;
}): {
    taskId: string;
    sessionId: string;
    cleanup: () => void;
};
/**
 * Restore remote-agent tasks from the session sidecar on --resume.
 *
 * Scans remote-agents/, fetches live CCR status for each, reconstructs
 * RemoteAgentTaskState into AppState.tasks, and restarts polling for sessions
 * still running. Sessions that are archived or 404 have their sidecar file
 * removed. Must run after switchSession() so getSessionId() points at the
 * resumed session's sidecar directory.
 */
export declare function restoreRemoteAgentTasks(context: TaskContext): Promise<void>;
/**
 * RemoteAgentTask - Handles remote Claude.ai session execution.
 *
 * Replaces the BackgroundRemoteSession implementation from:
 * - src/utils/background/remote/remoteSession.ts
 * - src/components/tasks/BackgroundTaskStatus.tsx (polling logic)
 */
export declare const RemoteAgentTask: Task;
/**
 * Get the session URL for a remote task.
 */
export declare function getRemoteTaskSessionUrl(sessionId: string): string;
//# sourceMappingURL=RemoteAgentTask.d.ts.map