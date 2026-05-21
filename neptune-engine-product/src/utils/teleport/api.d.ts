import { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import z from 'zod/v4';
export declare const CCR_BYOC_BETA = "ccr-byoc-2025-07-29";
/**
 * Checks if an axios error is a transient network error that should be retried
 */
export declare function isTransientNetworkError(error: unknown): boolean;
/**
 * Makes an axios GET request with automatic retry for transient network errors
 * Uses exponential backoff: 2s, 4s, 8s, 16s (4 retries = 5 total attempts)
 */
export declare function axiosGetWithRetry<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
export type SessionStatus = 'requires_action' | 'running' | 'idle' | 'archived';
export type GitSource = {
    type: 'git_repository';
    url: string;
    revision?: string | null;
    allow_unrestricted_git_push?: boolean;
};
export type KnowledgeBaseSource = {
    type: 'knowledge_base';
    knowledge_base_id: string;
};
export type SessionContextSource = GitSource | KnowledgeBaseSource;
export type OutcomeGitInfo = {
    type: 'github';
    repo: string;
    branches: string[];
};
export type GitRepositoryOutcome = {
    type: 'git_repository';
    git_info: OutcomeGitInfo;
};
export type Outcome = GitRepositoryOutcome;
export type SessionContext = {
    sources: SessionContextSource[];
    cwd: string;
    outcomes: Outcome[] | null;
    custom_system_prompt: string | null;
    append_system_prompt: string | null;
    model: string | null;
    seed_bundle_file_id?: string;
    github_pr?: {
        owner: string;
        repo: string;
        number: number;
    };
    reuse_outcome_branches?: boolean;
};
export type SessionResource = {
    type: 'session';
    id: string;
    title: string | null;
    session_status: SessionStatus;
    environment_id: string;
    created_at: string;
    updated_at: string;
    session_context: SessionContext;
};
export type ListSessionsResponse = {
    data: SessionResource[];
    has_more: boolean;
    first_id: string | null;
    last_id: string | null;
};
export declare const CodeSessionSchema: () => z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    status: z.ZodEnum<{
        completed: "completed";
        idle: "idle";
        waiting: "waiting";
        rejected: "rejected";
        cancelled: "cancelled";
        archived: "archived";
        working: "working";
    }>;
    repo: z.ZodNullable<z.ZodObject<{
        name: z.ZodString;
        owner: z.ZodObject<{
            login: z.ZodString;
        }, z.core.$strip>;
        default_branch: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    turns: z.ZodArray<z.ZodString>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, z.core.$strip>;
export type CodeSession = z.infer<ReturnType<typeof CodeSessionSchema>>;
/**
 * Validates and prepares for API requests
 * @returns Object containing access token and organization UUID
 */
export declare function prepareApiRequest(): Promise<{
    accessToken: string;
    orgUUID: string;
}>;
/**
 * Fetches code sessions from the new Sessions API (/v1/sessions)
 * @returns Array of code sessions
 */
export declare function fetchCodeSessionsFromSessionsAPI(): Promise<CodeSession[]>;
/**
 * Creates OAuth headers for API requests
 * @param accessToken The OAuth access token
 * @returns Headers object with Authorization, Content-Type, and anthropic-version
 */
export declare function getOAuthHeaders(accessToken: string): Record<string, string>;
/**
 * Fetches a single session by ID from the Sessions API
 * @param sessionId The session ID to fetch
 * @returns The session resource
 */
export declare function fetchSession(sessionId: string): Promise<SessionResource>;
/**
 * Extracts the first branch name from a session's git repository outcomes
 * @param session The session resource to extract from
 * @returns The first branch name, or undefined if none found
 */
export declare function getBranchFromSession(session: SessionResource): string | undefined;
/**
 * Content for a remote session message.
 * Accepts a plain string or an array of content blocks (text, image, etc.)
 * following the Anthropic API messages spec.
 */
export type RemoteMessageContent = string | Array<{
    type: string;
    [key: string]: unknown;
}>;
/**
 * Sends a user message event to an existing remote session via the Sessions API
 * @param sessionId The session ID to send the event to
 * @param messageContent The user message content (string or content blocks)
 * @param opts.uuid Optional UUID for the event — callers that added a local
 *   UserMessage first should pass its UUID so echo filtering can dedup
 * @returns Promise<boolean> True if successful, false otherwise
 */
export declare function sendEventToRemoteSession(sessionId: string, messageContent: RemoteMessageContent, opts?: {
    uuid?: string;
}): Promise<boolean>;
/**
 * Updates the title of an existing remote session via the Sessions API
 * @param sessionId The session ID to update
 * @param title The new title for the session
 * @returns Promise<boolean> True if successful, false otherwise
 */
export declare function updateSessionTitle(sessionId: string, title: string): Promise<boolean>;
//# sourceMappingURL=api.d.ts.map