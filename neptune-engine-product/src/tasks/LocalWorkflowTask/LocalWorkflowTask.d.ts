import type { AppState } from '../../state/AppState.js';
import type { SetAppState, Task, TaskStateBase } from '../../Task.js';
import type { AgentId } from '../../types/ids.js';
export type LocalWorkflowTaskState = TaskStateBase & {
    type: 'local_workflow';
    /** meta.name from the workflow script (e.g. 'spec'). */
    workflowName: string;
    /** Absolute path to the workflow file on disk. */
    workflowFile: string;
    /** Human-readable one-line summary for the task list. */
    summary?: string;
    /** Number of sub-agents spawned by this workflow. */
    agentCount?: number;
    /** Captured output from workflow execution. */
    output?: string;
    /** Agent that spawned this task. Used for orphan cleanup. */
    agentId?: AgentId;
    /** Abort controller for cancellation. */
    abortController?: AbortController;
    /**
     * Pending action for a sub-agent within this workflow.
     * The workflow execution loop polls this field and acts on it.
     */
    pendingAgentAction?: {
        kind: 'skip' | 'retry';
        agentId: AgentId;
        requestedAt: number;
    };
};
export declare function isLocalWorkflowTask(value: unknown): value is LocalWorkflowTaskState;
export declare function registerLocalWorkflowTask(setAppState: SetAppState, opts: {
    description: string;
    workflowName: string;
    workflowFile: string;
    summary?: string;
    toolUseId?: string;
    agentId?: AgentId;
    abortController?: AbortController;
}): string;
export declare function completeWorkflowTask(taskId: string, setAppState: SetAppState): void;
export declare function failWorkflowTask(taskId: string, setAppState: SetAppState): void;
/**
 * Kill a running workflow task. Called from BackgroundTasksDialog
 * via the feature-gated `killWorkflowTask` binding.
 */
export declare function killWorkflowTask(taskId: string, setAppState: SetAppState): void;
/**
 * Skip the current agent step within a running workflow.
 * Called from BackgroundTasksDialog via the feature-gated
 * `skipWorkflowAgent` binding: skipWorkflowAgent(taskId, agentId, setAppState).
 */
export declare function skipWorkflowAgent(taskId: string, agentId: AgentId, setAppState: SetAppState): void;
/**
 * Retry the current agent step within a running workflow.
 * Called from BackgroundTasksDialog via the feature-gated
 * `retryWorkflowAgent` binding: retryWorkflowAgent(taskId, agentId, setAppState).
 */
export declare function retryWorkflowAgent(taskId: string, agentId: AgentId, setAppState: SetAppState): void;
/**
 * Kill all running workflow tasks spawned by a given agent.
 * Called from runAgent.ts finally block.
 */
export declare function killWorkflowTasksForAgent(agentId: AgentId, getAppState: () => AppState, setAppState: SetAppState): void;
export declare const LocalWorkflowTask: Task;
//# sourceMappingURL=LocalWorkflowTask.d.ts.map