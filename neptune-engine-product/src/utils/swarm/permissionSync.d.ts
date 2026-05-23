/**
 * Synchronized Permission Prompts for Agent Swarms
 *
 * This module provides infrastructure for coordinating permission prompts across
 * multiple agents in a swarm. When a worker agent needs permission for a tool use,
 * it can forward the request to the team leader, who can then approve or deny it.
 *
 * The system uses the teammate mailbox for message passing:
 * - Workers send permission requests to the leader's mailbox
 * - Leaders send permission responses to the worker's mailbox
 *
 * Flow:
 * 1. Worker agent encounters a permission prompt
 * 2. Worker sends a permission_request message to the leader's mailbox
 * 3. Leader polls for mailbox messages and detects permission requests
 * 4. User approves/denies via the leader's UI
 * 5. Leader sends a permission_response message to the worker's mailbox
 * 6. Worker polls mailbox for responses and continues execution
 */
import { z } from 'zod/v4';
import type { PermissionUpdate } from '../permissions/PermissionUpdateSchema.js';
/**
 * Full request schema for a permission request from a worker to the leader
 */
export declare const SwarmPermissionRequestSchema: () => z.ZodObject<{
    id: z.ZodString;
    workerId: z.ZodString;
    workerName: z.ZodString;
    workerColor: z.ZodOptional<z.ZodString>;
    teamName: z.ZodString;
    toolName: z.ZodString;
    toolUseId: z.ZodString;
    description: z.ZodString;
    input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    permissionSuggestions: z.ZodArray<z.ZodUnknown>;
    status: z.ZodEnum<{
        pending: "pending";
        rejected: "rejected";
        approved: "approved";
    }>;
    resolvedBy: z.ZodOptional<z.ZodEnum<{
        worker: "worker";
        leader: "leader";
    }>>;
    resolvedAt: z.ZodOptional<z.ZodNumber>;
    feedback: z.ZodOptional<z.ZodString>;
    updatedInput: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    permissionUpdates: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    createdAt: z.ZodNumber;
}, z.core.$strip>;
export type SwarmPermissionRequest = z.infer<ReturnType<typeof SwarmPermissionRequestSchema>>;
/**
 * Resolution data returned when leader/worker resolves a request
 */
export type PermissionResolution = {
    /** Decision: approved or rejected */
    decision: 'approved' | 'rejected';
    /** Who resolved it */
    resolvedBy: 'worker' | 'leader';
    /** Optional feedback message if rejected */
    feedback?: string;
    /** Optional updated input if the resolver modified it */
    updatedInput?: Record<string, unknown>;
    /** Permission updates to apply (e.g., "always allow" rules) */
    permissionUpdates?: PermissionUpdate[];
};
/**
 * Get the base directory for a team's permission requests
 * Path: ~/.claude/teams/{teamName}/permissions/
 */
export declare function getPermissionDir(teamName: string): string;
/**
 * Generate a unique request ID
 */
export declare function generateRequestId(): string;
/**
 * Create a new SwarmPermissionRequest object
 */
export declare function createPermissionRequest(params: {
    toolName: string;
    toolUseId: string;
    input: Record<string, unknown>;
    description: string;
    permissionSuggestions?: unknown[];
    teamName?: string;
    workerId?: string;
    workerName?: string;
    workerColor?: string;
}): SwarmPermissionRequest;
/**
 * Write a permission request to the pending directory with file locking
 * Called by worker agents when they need permission approval from the leader
 *
 * @returns The written request
 */
export declare function writePermissionRequest(request: SwarmPermissionRequest): Promise<SwarmPermissionRequest>;
/**
 * Read all pending permission requests for a team
 * Called by the team leader to see what requests need attention
 */
export declare function readPendingPermissions(teamName?: string): Promise<SwarmPermissionRequest[]>;
/**
 * Read a resolved permission request by ID
 * Called by workers to check if their request has been resolved
 *
 * @returns The resolved request, or null if not yet resolved
 */
export declare function readResolvedPermission(requestId: string, teamName?: string): Promise<SwarmPermissionRequest | null>;
/**
 * Resolve a permission request
 * Called by the team leader (or worker in self-resolution cases)
 *
 * Writes the resolution to resolved/, removes from pending/
 */
export declare function resolvePermission(requestId: string, resolution: PermissionResolution, teamName?: string): Promise<boolean>;
/**
 * Clean up old resolved permission files
 * Called periodically to prevent file accumulation
 *
 * @param teamName - Team name
 * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
 */
export declare function cleanupOldResolutions(teamName?: string, maxAgeMs?: number): Promise<number>;
/**
 * Legacy response type for worker polling
 * Used for backward compatibility with worker integration code
 */
export type PermissionResponse = {
    /** ID of the request this responds to */
    requestId: string;
    /** Decision: approved or denied */
    decision: 'approved' | 'denied';
    /** Timestamp when response was created */
    timestamp: string;
    /** Optional feedback message if denied */
    feedback?: string;
    /** Optional updated input if the resolver modified it */
    updatedInput?: Record<string, unknown>;
    /** Permission updates to apply (e.g., "always allow" rules) */
    permissionUpdates?: unknown[];
};
/**
 * Poll for a permission response (worker-side convenience function)
 * Converts the resolved request into a simpler response format
 *
 * @returns The permission response, or null if not yet resolved
 */
export declare function pollForResponse(requestId: string, _agentName?: string, teamName?: string): Promise<PermissionResponse | null>;
/**
 * Remove a worker's response after processing
 * This is an alias for deleteResolvedPermission for backward compatibility
 */
export declare function removeWorkerResponse(requestId: string, _agentName?: string, teamName?: string): Promise<void>;
/**
 * Check if the current agent is a team leader
 */
export declare function isTeamLeader(teamName?: string): boolean;
/**
 * Check if the current agent is a worker in a swarm
 */
export declare function isSwarmWorker(): boolean;
/**
 * Delete a resolved permission file
 * Called after a worker has processed the resolution
 */
export declare function deleteResolvedPermission(requestId: string, teamName?: string): Promise<boolean>;
/**
 * Submit a permission request (alias for writePermissionRequest)
 * Provided for backward compatibility with worker integration code
 */
export declare const submitPermissionRequest: typeof writePermissionRequest;
/**
 * Get the leader's name from the team file
 * This is needed to send permission requests to the leader's mailbox
 */
export declare function getLeaderName(teamName?: string): Promise<string | null>;
/**
 * Send a permission request to the leader via mailbox.
 * This is the new mailbox-based approach that replaces the file-based pending directory.
 *
 * @param request - The permission request to send
 * @returns true if the message was sent successfully
 */
export declare function sendPermissionRequestViaMailbox(request: SwarmPermissionRequest): Promise<boolean>;
/**
 * Send a permission response to a worker via mailbox.
 * This is the new mailbox-based approach that replaces the file-based resolved directory.
 *
 * @param workerName - The worker's name to send the response to
 * @param resolution - The permission resolution
 * @param requestId - The original request ID
 * @param teamName - The team name
 * @returns true if the message was sent successfully
 */
export declare function sendPermissionResponseViaMailbox(workerName: string, resolution: PermissionResolution, requestId: string, teamName?: string): Promise<boolean>;
/**
 * Generate a unique sandbox permission request ID
 */
export declare function generateSandboxRequestId(): string;
/**
 * Send a sandbox permission request to the leader via mailbox.
 * Called by workers when sandbox runtime needs network access approval.
 *
 * @param host - The host requesting network access
 * @param requestId - Unique ID for this request
 * @param teamName - Optional team name
 * @returns true if the message was sent successfully
 */
export declare function sendSandboxPermissionRequestViaMailbox(host: string, requestId: string, teamName?: string): Promise<boolean>;
/**
 * Send a sandbox permission response to a worker via mailbox.
 * Called by the leader when approving/denying a sandbox network access request.
 *
 * @param workerName - The worker's name to send the response to
 * @param requestId - The original request ID
 * @param host - The host that was approved/denied
 * @param allow - Whether the connection is allowed
 * @param teamName - Optional team name
 * @returns true if the message was sent successfully
 */
export declare function sendSandboxPermissionResponseViaMailbox(workerName: string, requestId: string, host: string, allow: boolean, teamName?: string): Promise<boolean>;
//# sourceMappingURL=permissionSync.d.ts.map