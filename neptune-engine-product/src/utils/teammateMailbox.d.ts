/**
 * Teammate Mailbox - File-based messaging system for agent swarms
 *
 * Each teammate has an inbox file at .claude/teams/{team_name}/inboxes/{agent_name}.json
 * Other teammates can write messages to it, and the recipient sees them as attachments.
 *
 * Note: Inboxes are keyed by agent name within a team.
 */
import { z } from 'zod/v4';
import type { Message } from '../types/message.js';
import type { BackendType } from './swarm/backends/types.js';
export type TeammateMessage = {
    from: string;
    text: string;
    timestamp: string;
    read: boolean;
    color?: string;
    summary?: string;
};
/**
 * Get the path to a teammate's inbox file
 * Structure: ~/.claude/teams/{team_name}/inboxes/{agent_name}.json
 */
export declare function getInboxPath(agentName: string, teamName?: string): string;
/**
 * Read all messages from a teammate's inbox
 * @param agentName - The agent name (not UUID) to read inbox for
 * @param teamName - Optional team name (defaults to CLAUDE_CODE_TEAM_NAME env var or 'default')
 */
export declare function readMailbox(agentName: string, teamName?: string): Promise<TeammateMessage[]>;
/**
 * Read only unread messages from a teammate's inbox
 * @param agentName - The agent name (not UUID) to read inbox for
 * @param teamName - Optional team name
 */
export declare function readUnreadMessages(agentName: string, teamName?: string): Promise<TeammateMessage[]>;
/**
 * Write a message to a teammate's inbox
 * Uses file locking to prevent race conditions when multiple agents write concurrently
 * @param recipientName - The recipient's agent name (not UUID)
 * @param message - The message to write
 * @param teamName - Optional team name
 */
export declare function writeToMailbox(recipientName: string, message: Omit<TeammateMessage, 'read'>, teamName?: string): Promise<void>;
/**
 * Mark a specific message in a teammate's inbox as read by index
 * Uses file locking to prevent race conditions
 * @param agentName - The agent name to mark message as read for
 * @param teamName - Optional team name
 * @param messageIndex - Index of the message to mark as read
 */
export declare function markMessageAsReadByIndex(agentName: string, teamName: string | undefined, messageIndex: number): Promise<void>;
/**
 * Mark all messages in a teammate's inbox as read
 * Uses file locking to prevent race conditions
 * @param agentName - The agent name to mark messages as read for
 * @param teamName - Optional team name
 */
export declare function markMessagesAsRead(agentName: string, teamName?: string): Promise<void>;
/**
 * Clear a teammate's inbox (delete all messages)
 * @param agentName - The agent name to clear inbox for
 * @param teamName - Optional team name
 */
export declare function clearMailbox(agentName: string, teamName?: string): Promise<void>;
/**
 * Format teammate messages as XML for attachment display
 */
export declare function formatTeammateMessages(messages: Array<{
    from: string;
    text: string;
    timestamp: string;
    color?: string;
    summary?: string;
}>): string;
/**
 * Structured message sent when a teammate becomes idle (via Stop hook)
 */
export type IdleNotificationMessage = {
    type: 'idle_notification';
    from: string;
    timestamp: string;
    /** Why the agent went idle */
    idleReason?: 'available' | 'interrupted' | 'failed';
    /** Brief summary of the last DM sent this turn (if any) */
    summary?: string;
    completedTaskId?: string;
    completedStatus?: 'resolved' | 'blocked' | 'failed';
    failureReason?: string;
};
/**
 * Creates an idle notification message to send to the team leader
 */
export declare function createIdleNotification(agentId: string, options?: {
    idleReason?: IdleNotificationMessage['idleReason'];
    summary?: string;
    completedTaskId?: string;
    completedStatus?: 'resolved' | 'blocked' | 'failed';
    failureReason?: string;
}): IdleNotificationMessage;
/**
 * Checks if a message text contains an idle notification
 */
export declare function isIdleNotification(messageText: string): IdleNotificationMessage | null;
/**
 * Permission request message sent from worker to leader via mailbox.
 * Field names align with SDK `can_use_tool` (snake_case).
 */
export type PermissionRequestMessage = {
    type: 'permission_request';
    request_id: string;
    agent_id: string;
    tool_name: string;
    tool_use_id: string;
    description: string;
    input: Record<string, unknown>;
    permission_suggestions: unknown[];
};
/**
 * Permission response message sent from leader to worker via mailbox.
 * Shape mirrors SDK ControlResponseSchema / ControlErrorResponseSchema.
 */
export type PermissionResponseMessage = {
    type: 'permission_response';
    request_id: string;
    subtype: 'success';
    response?: {
        updated_input?: Record<string, unknown>;
        permission_updates?: unknown[];
    };
} | {
    type: 'permission_response';
    request_id: string;
    subtype: 'error';
    error: string;
};
/**
 * Creates a permission request message to send to the team leader
 */
export declare function createPermissionRequestMessage(params: {
    request_id: string;
    agent_id: string;
    tool_name: string;
    tool_use_id: string;
    description: string;
    input: Record<string, unknown>;
    permission_suggestions?: unknown[];
}): PermissionRequestMessage;
/**
 * Creates a permission response message to send back to a worker
 */
export declare function createPermissionResponseMessage(params: {
    request_id: string;
    subtype: 'success' | 'error';
    error?: string;
    updated_input?: Record<string, unknown>;
    permission_updates?: unknown[];
}): PermissionResponseMessage;
/**
 * Checks if a message text contains a permission request
 */
export declare function isPermissionRequest(messageText: string): PermissionRequestMessage | null;
/**
 * Checks if a message text contains a permission response
 */
export declare function isPermissionResponse(messageText: string): PermissionResponseMessage | null;
/**
 * Sandbox permission request message sent from worker to leader via mailbox
 * This is triggered when sandbox runtime detects a network access to a non-allowed host
 */
export type SandboxPermissionRequestMessage = {
    type: 'sandbox_permission_request';
    /** Unique identifier for this request */
    requestId: string;
    /** Worker's CLAUDE_CODE_AGENT_ID */
    workerId: string;
    /** Worker's CLAUDE_CODE_AGENT_NAME */
    workerName: string;
    /** Worker's CLAUDE_CODE_AGENT_COLOR */
    workerColor?: string;
    /** The host pattern requesting network access */
    hostPattern: {
        host: string;
    };
    /** Timestamp when request was created */
    createdAt: number;
};
/**
 * Sandbox permission response message sent from leader to worker via mailbox
 */
export type SandboxPermissionResponseMessage = {
    type: 'sandbox_permission_response';
    /** ID of the request this responds to */
    requestId: string;
    /** The host that was approved/denied */
    host: string;
    /** Whether the connection is allowed */
    allow: boolean;
    /** Timestamp when response was created */
    timestamp: string;
};
/**
 * Creates a sandbox permission request message to send to the team leader
 */
export declare function createSandboxPermissionRequestMessage(params: {
    requestId: string;
    workerId: string;
    workerName: string;
    workerColor?: string;
    host: string;
}): SandboxPermissionRequestMessage;
/**
 * Creates a sandbox permission response message to send back to a worker
 */
export declare function createSandboxPermissionResponseMessage(params: {
    requestId: string;
    host: string;
    allow: boolean;
}): SandboxPermissionResponseMessage;
/**
 * Checks if a message text contains a sandbox permission request
 */
export declare function isSandboxPermissionRequest(messageText: string): SandboxPermissionRequestMessage | null;
/**
 * Checks if a message text contains a sandbox permission response
 */
export declare function isSandboxPermissionResponse(messageText: string): SandboxPermissionResponseMessage | null;
/**
 * Message sent when a teammate requests plan approval from the team leader
 */
export declare const PlanApprovalRequestMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"plan_approval_request">;
    from: z.ZodString;
    timestamp: z.ZodString;
    planFilePath: z.ZodString;
    planContent: z.ZodString;
    requestId: z.ZodString;
}, z.core.$strip>;
export type PlanApprovalRequestMessage = z.infer<ReturnType<typeof PlanApprovalRequestMessageSchema>>;
/**
 * Message sent by the team leader in response to a plan approval request
 */
export declare const PlanApprovalResponseMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"plan_approval_response">;
    requestId: z.ZodString;
    approved: z.ZodBoolean;
    feedback: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodString;
    permissionMode: z.ZodOptional<z.ZodEnum<{
        plan: "plan";
        auto: "auto";
        default: "default";
        acceptEdits: "acceptEdits";
        bypassPermissions: "bypassPermissions";
        dontAsk: "dontAsk";
    }>>;
}, z.core.$strip>;
export type PlanApprovalResponseMessage = z.infer<ReturnType<typeof PlanApprovalResponseMessageSchema>>;
/**
 * Shutdown request message sent from leader to teammate via mailbox
 */
export declare const ShutdownRequestMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"shutdown_request">;
    requestId: z.ZodString;
    from: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodString;
}, z.core.$strip>;
export type ShutdownRequestMessage = z.infer<ReturnType<typeof ShutdownRequestMessageSchema>>;
/**
 * Shutdown approved message sent from teammate to leader via mailbox
 */
export declare const ShutdownApprovedMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"shutdown_approved">;
    requestId: z.ZodString;
    from: z.ZodString;
    timestamp: z.ZodString;
    paneId: z.ZodOptional<z.ZodString>;
    backendType: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ShutdownApprovedMessage = z.infer<ReturnType<typeof ShutdownApprovedMessageSchema>>;
/**
 * Shutdown rejected message sent from teammate to leader via mailbox
 */
export declare const ShutdownRejectedMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"shutdown_rejected">;
    requestId: z.ZodString;
    from: z.ZodString;
    reason: z.ZodString;
    timestamp: z.ZodString;
}, z.core.$strip>;
export type ShutdownRejectedMessage = z.infer<ReturnType<typeof ShutdownRejectedMessageSchema>>;
/**
 * Creates a shutdown request message to send to a teammate
 */
export declare function createShutdownRequestMessage(params: {
    requestId: string;
    from: string;
    reason?: string;
}): ShutdownRequestMessage;
/**
 * Creates a shutdown approved message to send to the team leader
 */
export declare function createShutdownApprovedMessage(params: {
    requestId: string;
    from: string;
    paneId?: string;
    backendType?: BackendType;
}): ShutdownApprovedMessage;
/**
 * Creates a shutdown rejected message to send to the team leader
 */
export declare function createShutdownRejectedMessage(params: {
    requestId: string;
    from: string;
    reason: string;
}): ShutdownRejectedMessage;
/**
 * Sends a shutdown request to a teammate's mailbox.
 * This is the core logic extracted for reuse by both the tool and UI components.
 *
 * @param targetName - Name of the teammate to send shutdown request to
 * @param teamName - Optional team name (defaults to CLAUDE_CODE_TEAM_NAME env var)
 * @param reason - Optional reason for the shutdown request
 * @returns The request ID and target name
 */
export declare function sendShutdownRequestToMailbox(targetName: string, teamName?: string, reason?: string): Promise<{
    requestId: string;
    target: string;
}>;
/**
 * Checks if a message text contains a shutdown request
 */
export declare function isShutdownRequest(messageText: string): ShutdownRequestMessage | null;
/**
 * Checks if a message text contains a plan approval request
 */
export declare function isPlanApprovalRequest(messageText: string): PlanApprovalRequestMessage | null;
/**
 * Checks if a message text contains a shutdown approved message
 */
export declare function isShutdownApproved(messageText: string): ShutdownApprovedMessage | null;
/**
 * Checks if a message text contains a shutdown rejected message
 */
export declare function isShutdownRejected(messageText: string): ShutdownRejectedMessage | null;
/**
 * Checks if a message text contains a plan approval response
 */
export declare function isPlanApprovalResponse(messageText: string): PlanApprovalResponseMessage | null;
/**
 * Task assignment message sent when a task is assigned to a teammate
 */
export type TaskAssignmentMessage = {
    type: 'task_assignment';
    taskId: string;
    subject: string;
    description: string;
    assignedBy: string;
    timestamp: string;
};
/**
 * Checks if a message text contains a task assignment
 */
export declare function isTaskAssignment(messageText: string): TaskAssignmentMessage | null;
/**
 * Team permission update message sent from leader to teammates via mailbox
 * Broadcasts a permission update that applies to all teammates
 */
export type TeamPermissionUpdateMessage = {
    type: 'team_permission_update';
    /** The permission update to apply */
    permissionUpdate: {
        type: 'addRules';
        rules: Array<{
            toolName: string;
            ruleContent?: string;
        }>;
        behavior: 'allow' | 'deny' | 'ask';
        destination: 'session';
    };
    /** The directory path that was allowed */
    directoryPath: string;
    /** The tool name this applies to */
    toolName: string;
};
/**
 * Checks if a message text contains a team permission update
 */
export declare function isTeamPermissionUpdate(messageText: string): TeamPermissionUpdateMessage | null;
/**
 * Mode set request message sent from leader to teammate via mailbox
 * Uses SDK PermissionModeSchema for validated mode values
 */
export declare const ModeSetRequestMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"mode_set_request">;
    mode: z.ZodEnum<{
        plan: "plan";
        auto: "auto";
        default: "default";
        acceptEdits: "acceptEdits";
        bypassPermissions: "bypassPermissions";
        dontAsk: "dontAsk";
    }>;
    from: z.ZodString;
}, z.core.$strip>;
export type ModeSetRequestMessage = z.infer<ReturnType<typeof ModeSetRequestMessageSchema>>;
/**
 * Creates a mode set request message to send to a teammate
 */
export declare function createModeSetRequestMessage(params: {
    mode: string;
    from: string;
}): ModeSetRequestMessage;
/**
 * Checks if a message text contains a mode set request
 */
export declare function isModeSetRequest(messageText: string): ModeSetRequestMessage | null;
/**
 * Checks if a message text is a structured protocol message that should be
 * routed by useInboxPoller rather than consumed as raw LLM context.
 *
 * These message types have specific handlers in useInboxPoller that route them
 * to the correct queues (workerPermissions, workerSandboxPermissions, etc.).
 * If getTeammateMailboxAttachments consumes them first, they get bundled as
 * raw text in attachments and never reach their intended handlers.
 */
export declare function isStructuredProtocolMessage(messageText: string): boolean;
/**
 * Marks only messages matching a predicate as read, leaving others unread.
 * Uses the same file-locking mechanism as markMessagesAsRead.
 */
export declare function markMessagesAsReadByPredicate(agentName: string, predicate: (msg: TeammateMessage) => boolean, teamName?: string): Promise<void>;
/**
 * Extracts a "[to {name}] {summary}" string from the last assistant message
 * if it ended with a SendMessage tool_use targeting a peer (not the team lead).
 * Returns undefined when the turn didn't end with a peer DM.
 */
export declare function getLastPeerDmSummary(messages: Message[]): string | undefined;
//# sourceMappingURL=teammateMailbox.d.ts.map