import type { UUID } from 'crypto';
import type { SdkWorkflowProgress } from '../types/tools.js';
type TaskStartedEvent = {
    type: 'system';
    subtype: 'task_started';
    task_id: string;
    tool_use_id?: string;
    description: string;
    task_type?: string;
    workflow_name?: string;
    prompt?: string;
};
type TaskProgressEvent = {
    type: 'system';
    subtype: 'task_progress';
    task_id: string;
    tool_use_id?: string;
    description: string;
    usage: {
        total_tokens: number;
        tool_uses: number;
        duration_ms: number;
    };
    last_tool_name?: string;
    summary?: string;
    workflow_progress?: SdkWorkflowProgress[];
};
type TaskNotificationSdkEvent = {
    type: 'system';
    subtype: 'task_notification';
    task_id: string;
    tool_use_id?: string;
    status: 'completed' | 'failed' | 'stopped';
    output_file: string;
    summary: string;
    usage?: {
        total_tokens: number;
        tool_uses: number;
        duration_ms: number;
    };
};
type SessionStateChangedEvent = {
    type: 'system';
    subtype: 'session_state_changed';
    state: 'idle' | 'running' | 'requires_action';
};
export type SdkEvent = TaskStartedEvent | TaskProgressEvent | TaskNotificationSdkEvent | SessionStateChangedEvent;
export declare function enqueueSdkEvent(event: SdkEvent): void;
export declare function drainSdkEvents(): Array<SdkEvent & {
    uuid: UUID;
    session_id: string;
}>;
/**
 * Emit a task_notification SDK event for a task reaching a terminal state.
 *
 * registerTask() always emits task_started; this is the closing bookend.
 * Call this from any exit path that sets a task terminal WITHOUT going
 * through enqueuePendingNotification-with-<task-id> (print.ts parses that
 * XML into the same SDK event, so paths that do both would double-emit).
 * Paths that suppress the XML notification (notified:true pre-set, kill
 * paths, abort branches) must call this directly so SDK consumers
 * (Scuttle's bg-task dot, VS Code subagent panel) see the task close.
 */
export declare function emitTaskTerminatedSdk(taskId: string, status: 'completed' | 'failed' | 'stopped', opts?: {
    toolUseId?: string;
    summary?: string;
    outputFile?: string;
    usage?: {
        total_tokens: number;
        tool_uses: number;
        duration_ms: number;
    };
}): void;
export {};
//# sourceMappingURL=sdkEventQueue.d.ts.map