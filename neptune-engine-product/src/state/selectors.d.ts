/**
 * Selectors for deriving computed state from AppState.
 * Keep selectors pure and simple - just data extraction, no side effects.
 */
import type { InProcessTeammateTaskState } from '../tasks/InProcessTeammateTask/types.js';
import type { LocalAgentTaskState } from '../tasks/LocalAgentTask/LocalAgentTask.js';
import type { AppState } from './AppStateStore.js';
/**
 * Get the currently viewed teammate task, if any.
 * Returns undefined if:
 * - No teammate is being viewed (viewingAgentTaskId is undefined)
 * - The task ID doesn't exist in tasks
 * - The task is not an in-process teammate task
 */
export declare function getViewedTeammateTask(appState: Pick<AppState, 'viewingAgentTaskId' | 'tasks'>): InProcessTeammateTaskState | undefined;
/**
 * Return type for getActiveAgentForInput selector.
 * Discriminated union for type-safe input routing.
 */
export type ActiveAgentForInput = {
    type: 'leader';
} | {
    type: 'viewed';
    task: InProcessTeammateTaskState;
} | {
    type: 'named_agent';
    task: LocalAgentTaskState;
};
/**
 * Determine where user input should be routed.
 * Returns:
 * - { type: 'leader' } when not viewing a teammate (input goes to leader)
 * - { type: 'viewed', task } when viewing an agent (input goes to that agent)
 *
 * Used by input routing logic to direct user messages to the correct agent.
 */
export declare function getActiveAgentForInput(appState: AppState): ActiveAgentForInput;
//# sourceMappingURL=selectors.d.ts.map