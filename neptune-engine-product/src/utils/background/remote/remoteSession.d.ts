import type { SDKMessage } from 'src/entrypoints/agentSdkTypes.js';
import type { TodoList } from '../../todo/types.js';
/**
 * Background remote session type for managing teleport sessions
 */
export type BackgroundRemoteSession = {
    id: string;
    command: string;
    startTime: number;
    status: 'starting' | 'running' | 'completed' | 'failed' | 'killed';
    todoList: TodoList;
    title: string;
    type: 'remote_session';
    log: SDKMessage[];
};
/**
 * Precondition failures for background remote sessions
 */
export type BackgroundRemoteSessionPrecondition = {
    type: 'not_logged_in';
} | {
    type: 'no_remote_environment';
} | {
    type: 'not_in_git_repo';
} | {
    type: 'no_git_remote';
} | {
    type: 'github_app_not_installed';
} | {
    type: 'policy_blocked';
};
/**
 * Checks eligibility for creating a background remote session
 * Returns an array of failed preconditions (empty array means all checks passed)
 *
 * @returns Array of failed preconditions
 */
export declare function checkBackgroundRemoteSessionEligibility({ skipBundle, }?: {
    skipBundle?: boolean;
}): Promise<BackgroundRemoteSessionPrecondition[]>;
//# sourceMappingURL=remoteSession.d.ts.map