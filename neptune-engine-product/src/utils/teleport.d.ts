import type { SDKMessage } from '../entrypoints/agentSdkTypes.js';
import type { Message } from '../types/message.js';
import type { PermissionMode } from '../types/permissions.js';
import { type TeleportRemoteResponse } from './conversationRecovery.js';
import { type SessionResource } from './teleport/api.js';
export type TeleportResult = {
    messages: Message[];
    branchName: string;
};
export type TeleportProgressStep = 'validating' | 'fetching_logs' | 'fetching_branch' | 'checking_out' | 'done';
export type TeleportProgressCallback = (step: TeleportProgressStep) => void;
type TeleportToRemoteResponse = {
    id: string;
    title: string;
};
/**
 * Validates that the git working directory is clean (ignoring untracked files)
 * Untracked files are ignored because they won't be lost during branch switching
 */
export declare function validateGitState(): Promise<void>;
/**
 * Processes messages for teleport resume, removing incomplete tool_use blocks
 * and adding teleport notice messages
 * @param messages The conversation messages
 * @param error Optional error from branch checkout
 * @returns Processed messages ready for resume
 */
export declare function processMessagesForTeleportResume(messages: Message[], error: Error | null): Message[];
/**
 * Checks out the specified branch for a teleported session
 * @param branch Optional branch to checkout
 * @returns The current branch name and any error that occurred
 */
export declare function checkOutTeleportedSessionBranch(branch?: string): Promise<{
    branchName: string;
    branchError: Error | null;
}>;
/**
 * Result of repository validation for teleport
 */
export type RepoValidationResult = {
    status: 'match' | 'mismatch' | 'not_in_repo' | 'no_repo_required' | 'error';
    sessionRepo?: string;
    currentRepo?: string | null;
    /** Host of the session repo (e.g. "github.com" or "ghe.corp.com") — for display only */
    sessionHost?: string;
    /** Host of the current repo (e.g. "github.com" or "ghe.corp.com") — for display only */
    currentHost?: string;
    errorMessage?: string;
};
/**
 * Validates that the current repository matches the session's repository.
 * Returns a result object instead of throwing, allowing the caller to handle mismatches.
 *
 * @param sessionData The session resource to validate against
 * @returns Validation result with status and repo information
 */
export declare function validateSessionRepository(sessionData: SessionResource): Promise<RepoValidationResult>;
/**
 * Handles teleporting from a code session ID.
 * Fetches session logs and validates repo.
 * @param sessionId The session ID to resume
 * @param onProgress Optional callback for progress updates
 * @returns The raw session log and branch name
 */
export declare function teleportResumeCodeSession(sessionId: string, onProgress?: TeleportProgressCallback): Promise<TeleportRemoteResponse>;
/**
 * Teleport to a remote session using the Sessions API.
 * @param sessionId The session ID to teleport to
 * @param orgUUID The organization UUID
 * @param accessToken The OAuth access token
 * @param onProgress Optional callback for progress updates
 * @param sessionData Optional session data (used to extract branch info)
 * @returns TeleportRemoteResponse with session logs as Message[]
 */
export declare function teleportFromSessionsAPI(sessionId: string, orgUUID: string, accessToken: string, onProgress?: TeleportProgressCallback, sessionData?: SessionResource): Promise<TeleportRemoteResponse>;
/**
 * Response type for polling remote session events (uses SDK events format)
 */
export type PollRemoteSessionResponse = {
    newEvents: SDKMessage[];
    lastEventId: string | null;
    branch?: string;
    sessionStatus?: 'idle' | 'running' | 'requires_action' | 'archived';
};
/**
 * Polls remote session events. Pass the previous response's `lastEventId`
 * as `afterId` to fetch only the delta. Set `skipMetadata` to avoid the
 * per-call GET /v1/sessions/{id} when branch/status aren't needed.
 */
export declare function pollRemoteSessionEvents(sessionId: string, afterId?: string | null, opts?: {
    skipMetadata?: boolean;
}): Promise<PollRemoteSessionResponse>;
/**
 * Creates a remote Claude.ai session using the Sessions API.
 *
 * Two source modes:
 * - GitHub (default): backend clones from the repo's origin URL. Requires a
 *   GitHub remote + CCR-side GitHub connection. 43% of CLI sessions have an
 *   origin remote; far fewer pass the full precondition chain.
 * - Bundle (CCR_FORCE_BUNDLE=1): CLI creates `git bundle --all`, uploads via Files
 *   API, passes file_id as seed_bundle_file_id on the session context. CCR
 *   downloads it and clones from the bundle. No GitHub dependency — works for
 *   local-only repos. Reach: 54% of CLI sessions (anything with .git/).
 *   Backend: anthropic#303856.
 */
export declare function teleportToRemote(options: {
    initialMessage: string | null;
    branchName?: string;
    title?: string;
    /**
     * The description of the session. This is used to generate the title and
     * session branch name (unless they are explicitly provided).
     */
    description?: string;
    model?: string;
    permissionMode?: PermissionMode;
    ultraplan?: boolean;
    signal: AbortSignal;
    useDefaultEnvironment?: boolean;
    /**
     * Explicit environment_id (e.g. the code_review synthetic env). Bypasses
     * fetchEnvironments; the usual repo-detection → git source still runs so
     * the container gets the repo checked out (orchestrator reads --repo-dir
     * from pwd, it doesn't clone).
     */
    environmentId?: string;
    /**
     * Per-session env vars merged into session_context.environment_variables.
     * Write-only at the API layer (stripped from Get/List responses). When
     * environmentId is set, CLAUDE_CODE_OAUTH_TOKEN is auto-injected from the
     * caller's accessToken so the container's hook can hit inference (the
     * server only passes through what the caller sends; bughunter.go mints
     * its own, user sessions don't get one automatically).
     */
    environmentVariables?: Record<string, string>;
    /**
     * When set with environmentId, creates and uploads a git bundle of the
     * local working tree (createAndUploadGitBundle handles the stash-create
     * for uncommitted changes) and passes it as seed_bundle_file_id. Backend
     * clones from the bundle instead of GitHub — container gets the caller's
     * exact local state. Needs .git/ only, not a GitHub remote.
     */
    useBundle?: boolean;
    /**
     * Called with a user-facing message when the bundle path is attempted but
     * fails. The wrapper stderr.writes it (pre-REPL). Remote-agent callers
     * capture it to include in their throw (in-REPL, Ink-rendered).
     */
    onBundleFail?: (message: string) => void;
    onCreateFail?: (message: string) => void;
    /**
     * When true, disables the git-bundle fallback entirely. Use for flows like
     * autofix where CCR must push to GitHub — a bundle can't do that.
     */
    skipBundle?: boolean;
    /**
     * When set, reuses this branch as the outcome branch instead of generating
     * a new claude/ branch. Sets allow_unrestricted_git_push on the source and
     * reuse_outcome_branches on the session context so the remote pushes to the
     * caller's branch directly.
     */
    reuseOutcomeBranch?: string;
    /**
     * GitHub PR to attach to the session context. Backend uses this to
     * identify the PR associated with this session.
     */
    githubPr?: {
        owner: string;
        repo: string;
        number: number;
    };
}): Promise<TeleportToRemoteResponse | null>;
/**
 * Best-effort session archive. POST /v1/sessions/{id}/archive has no
 * running-status check (unlike DELETE which 409s on RUNNING), so it works
 * mid-implementation. Archived sessions reject new events (send_events.go),
 * so the remote stops on its next write. 409 (already archived) treated as
 * success. Fire-and-forget; failure leaks a visible session until the
 * reaper collects it.
 */
export declare function archiveRemoteSession(sessionId: string, timeout?: number): Promise<void>;
export {};
//# sourceMappingURL=teleport.d.ts.map