/**
 * Leader Permission Bridge
 *
 * Module-level bridge that allows the REPL to register its setToolUseConfirmQueue
 * and setToolPermissionContext functions for in-process teammates to use.
 *
 * When an in-process teammate requests permissions, it uses the standard
 * ToolUseConfirm dialog rather than the worker permission badge. This bridge
 * makes the REPL's queue setter and permission context setter accessible
 * from non-React code in the in-process runner.
 */
import type { ToolUseConfirm } from '../../types/permissionTypes.js';
import type { ToolPermissionContext } from '../../Tool.js';
export type SetToolUseConfirmQueueFn = (updater: (prev: ToolUseConfirm[]) => ToolUseConfirm[]) => void;
export type SetToolPermissionContextFn = (context: ToolPermissionContext, options?: {
    preserveMode?: boolean;
}) => void;
export declare function registerLeaderToolUseConfirmQueue(setter: SetToolUseConfirmQueueFn): void;
export declare function getLeaderToolUseConfirmQueue(): SetToolUseConfirmQueueFn | null;
export declare function unregisterLeaderToolUseConfirmQueue(): void;
export declare function registerLeaderSetToolPermissionContext(setter: SetToolPermissionContextFn): void;
export declare function getLeaderSetToolPermissionContext(): SetToolPermissionContextFn | null;
export declare function unregisterLeaderSetToolPermissionContext(): void;
//# sourceMappingURL=leaderPermissionBridge.d.ts.map