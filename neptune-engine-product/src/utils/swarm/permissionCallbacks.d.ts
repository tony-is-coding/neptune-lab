/**
 * Swarm permission callback registry
 *
 * Pure logic for managing in-process teammate permission callbacks.
 * Extracted from CLI (useSwarmPermissionPoller) to eliminate framework→CLI dependency.
 * The React hook (useSwarmPermissionPoller) remains in CLI for UI polling.
 */
import { type PermissionUpdate } from '../permissions/PermissionUpdateSchema.js';
/**
 * Callback signature for handling permission responses
 */
export type PermissionResponseCallback = {
    requestId: string;
    toolUseId: string;
    onAllow: (updatedInput: Record<string, unknown> | undefined, permissionUpdates: PermissionUpdate[], feedback?: string) => void;
    onReject: (feedback?: string) => void;
};
/**
 * Callback signature for handling sandbox permission responses
 */
export type SandboxPermissionResponseCallback = {
    requestId: string;
    onAllow: () => void;
    onReject: (feedback?: string) => void;
};
/**
 * Register a callback for a pending permission request
 */
export declare function registerPermissionCallback(callback: PermissionResponseCallback): void;
/**
 * Unregister a callback
 */
export declare function unregisterPermissionCallback(requestId: string): void;
/**
 * Check if a request has a registered callback
 */
export declare function hasPermissionCallback(requestId: string): boolean;
/**
 * Register a sandbox permission callback
 */
export declare function registerSandboxPermissionCallback(callback: SandboxPermissionResponseCallback): void;
/**
 * Check if a sandbox request has a registered callback
 */
export declare function hasSandboxPermissionCallback(requestId: string): boolean;
/**
 * Clear all pending callbacks (both permission and sandbox).
 */
export declare function clearAllPendingCallbacks(): void;
/**
 * Process a permission response from a mailbox message.
 */
export declare function processMailboxPermissionResponse(params: {
    requestId: string;
    decision: string;
    updatedInput?: Record<string, unknown> | undefined;
    permissionUpdates?: unknown[];
    feedback?: string;
}): boolean;
/**
 * Process a sandbox permission response.
 */
export declare function processSandboxPermissionResponse(params: {
    requestId: string;
    decision: string;
    feedback?: string;
}): boolean;
//# sourceMappingURL=permissionCallbacks.d.ts.map