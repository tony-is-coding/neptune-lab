import type { TaskStateBase } from '../../Task.js';
import type { AgentToolResult } from '@neptune/builtin-tools/tools/AgentTool/agentToolUtils.js';
import type { AgentDefinition } from '@neptune/builtin-tools/tools/AgentTool/loadAgentsDir.js';
import type { Message } from '../../types/message.js';
import type { PermissionMode } from '../../utils/permissions/PermissionMode.js';
import type { AgentProgress } from '../LocalAgentTask/LocalAgentTask.js';
/**
 * Teammate identity stored in task state.
 * Same shape as TeammateContext (runtime) but stored as plain data.
 * TeammateContext is for AsyncLocalStorage; this is for AppState persistence.
 */
export type TeammateIdentity = {
    agentId: string;
    agentName: string;
    teamName: string;
    color?: string;
    planModeRequired: boolean;
    parentSessionId: string;
};
export type InProcessTeammateTaskState = TaskStateBase & {
    type: 'in_process_teammate';
    identity: TeammateIdentity;
    prompt: string;
    model?: string;
    selectedAgent?: AgentDefinition;
    abortController?: AbortController;
    currentWorkAbortController?: AbortController;
    unregisterCleanup?: () => void;
    awaitingPlanApproval: boolean;
    permissionMode: PermissionMode;
    error?: string;
    result?: AgentToolResult;
    progress?: AgentProgress;
    messages?: Message[];
    inProgressToolUseIDs?: Set<string>;
    pendingUserMessages: string[];
    spinnerVerb?: string;
    pastTenseVerb?: string;
    isIdle: boolean;
    shutdownRequested: boolean;
    onIdleCallbacks?: Array<() => void>;
    lastReportedToolCount: number;
    lastReportedTokenCount: number;
};
export declare function isInProcessTeammateTask(task: unknown): task is InProcessTeammateTaskState;
/**
 * Cap on the number of messages kept in task.messages (the AppState UI mirror).
 *
 * task.messages exists purely for the zoomed transcript dialog, which only
 * needs recent context. The full conversation lives in the local allMessages
 * array (inProcessRunner) and on disk at the agent transcript path.
 *
 * BQ analysis (round 9, 2026-03-20) showed ~20MB RSS per agent at 500+ turn
 * sessions and ~125MB per concurrent agent in swarm bursts. Whale session
 * 9a990de8 launched 292 agents in 2 minutes and reached 36.8GB. The dominant
 * cost is this array holding a second full copy of every message.
 */
export declare const TEAMMATE_MESSAGES_UI_CAP = 50;
/**
 * Append an item to a message array, capping the result at
 * TEAMMATE_MESSAGES_UI_CAP entries by dropping the oldest. Always returns
 * a new array (AppState immutability).
 */
export declare function appendCappedMessage<T>(prev: readonly T[] | undefined, item: T): T[];
//# sourceMappingURL=types.d.ts.map