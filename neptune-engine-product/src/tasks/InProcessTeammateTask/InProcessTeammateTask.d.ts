/**
 * InProcessTeammateTask - Manages in-process teammate lifecycle
 *
 * This component implements the Task interface for in-process teammates.
 * Unlike LocalAgentTask (background agents), in-process teammates:
 * 1. Run in the same Node.js process using AsyncLocalStorage for isolation
 * 2. Have team-aware identity (agentName@teamName)
 * 3. Support plan mode approval flow
 * 4. Can be idle (waiting for work) or active (processing)
 */
import { type SetAppState, type Task, type TaskStateBase } from '../../Task.js';
import type { Message } from '../../types/message.js';
import type { InProcessTeammateTaskState } from './types.js';
/**
 * InProcessTeammateTask - Handles in-process teammate execution.
 */
export declare const InProcessTeammateTask: Task;
/**
 * Request shutdown for a teammate.
 */
export declare function requestTeammateShutdown(taskId: string, setAppState: SetAppState): void;
/**
 * Append a message to a teammate's conversation history.
 * Used for zoomed view to show the teammate's conversation.
 */
export declare function appendTeammateMessage(taskId: string, message: Message, setAppState: SetAppState): void;
/**
 * Inject a user message to a teammate's pending queue.
 * Used when viewing a teammate's transcript to send typed messages to them.
 * Also adds the message to task.messages so it appears immediately in the transcript.
 */
export declare function injectUserMessageToTeammate(taskId: string, message: string, setAppState: SetAppState): void;
/**
 * Get teammate task by agent ID from AppState.
 * Prefers running tasks over killed/completed ones in case multiple tasks
 * with the same agentId exist.
 * Returns undefined if not found.
 */
export declare function findTeammateTaskByAgentId(agentId: string, tasks: Record<string, TaskStateBase>): InProcessTeammateTaskState | undefined;
/**
 * Get all in-process teammate tasks from AppState.
 */
export declare function getAllInProcessTeammateTasks(tasks: Record<string, TaskStateBase>): InProcessTeammateTaskState[];
/**
 * Get running in-process teammates sorted alphabetically by agentName.
 * Shared between TeammateSpinnerTree display, PromptInput footer selector,
 * and useBackgroundTaskNavigation — selectedIPAgentIndex maps into this
 * array, so all three must agree on sort order.
 */
export declare function getRunningTeammatesSorted(tasks: Record<string, TaskStateBase>): InProcessTeammateTaskState[];
//# sourceMappingURL=InProcessTeammateTask.d.ts.map