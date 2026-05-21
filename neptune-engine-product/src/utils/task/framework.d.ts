import type { AppState } from '../../state/AppState.js';
import { type TaskStatus, type TaskType } from '../../Task.js';
import type { TaskState } from '../../tasks/types.js';
export declare const POLL_INTERVAL_MS = 1000;
export declare const STOPPED_DISPLAY_MS = 3000;
export declare const PANEL_GRACE_MS = 30000;
export type TaskAttachment = {
    type: 'task_status';
    taskId: string;
    toolUseId?: string;
    taskType: TaskType;
    status: TaskStatus;
    description: string;
    deltaSummary: string | null;
};
type SetAppState = (updater: (prev: AppState) => AppState) => void;
/**
 * Update a task's state in AppState.
 * Helper function for task implementations.
 * Generic to allow type-safe updates for specific task types.
 */
export declare function updateTaskState<T extends TaskState>(taskId: string, setAppState: SetAppState, updater: (task: T) => T): void;
/**
 * Register a new task in AppState.
 */
export declare function registerTask(task: TaskState, setAppState: SetAppState): void;
/**
 * Eagerly evict a terminal task from AppState.
 * The task must be in a terminal state (completed/failed/killed) with notified=true.
 * This allows memory to be freed without waiting for the next query loop iteration.
 * The lazy GC in generateTaskAttachments() remains as a safety net.
 */
export declare function evictTerminalTask(taskId: string, setAppState: SetAppState): void;
/**
 * Get all running tasks.
 */
export declare function getRunningTasks(state: AppState): TaskState[];
/**
 * Generate attachments for tasks with new output or status changes.
 * Called by the framework to create push notifications.
 */
export declare function generateTaskAttachments(state: AppState): Promise<{
    attachments: TaskAttachment[];
    updatedTaskOffsets: Record<string, number>;
    evictedTaskIds: string[];
}>;
/**
 * Apply the outputOffset patches and evictions from generateTaskAttachments.
 * Merges patches against FRESH prev.tasks (not the stale pre-await snapshot),
 * so concurrent status transitions aren't clobbered.
 */
export declare function applyTaskOffsetsAndEvictions(setAppState: SetAppState, updatedTaskOffsets: Record<string, number>, evictedTaskIds: string[]): void;
/**
 * Poll all running tasks and check for updates.
 * This is the main polling loop called by the framework.
 */
export declare function pollTasks(getAppState: () => AppState, setAppState: SetAppState): Promise<void>;
export {};
//# sourceMappingURL=framework.d.ts.map