import type { SdkWorkflowProgress } from '../../types/tools.js';
/**
 * Emit a `task_progress` SDK event. Shared by background agents (per tool_use
 * in runAsyncAgentLifecycle) and workflows (per flushProgress batch). Accepts
 * already-computed primitives so callers can derive them from their own state
 * shapes (ProgressTracker for agents, LocalWorkflowTaskState for workflows).
 */
export declare function emitTaskProgress(params: {
    taskId: string;
    toolUseId: string | undefined;
    description: string;
    startTime: number;
    totalTokens: number;
    toolUses: number;
    lastToolName?: string;
    summary?: string;
    workflowProgress?: SdkWorkflowProgress[];
}): void;
//# sourceMappingURL=sdkProgress.d.ts.map