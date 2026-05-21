import type { ToolUseContext } from '../../Tool.js';
/**
 * Turn-end cleanup for the chicago MCP surface: auto-unhide apps that
 * `prepareForAction` hid, then release the file-based lock.
 *
 * Called from three sites: natural turn end (`stopHooks.ts`), abort during
 * streaming (`query.ts` aborted_streaming), abort during tool execution
 * (`query.ts` aborted_tools). All three reach this via dynamic import gated
 * on `feature('CHICAGO_MCP')`. `executor.js` (which pulls both native
 * modules) is dynamic-imported below so non-CU turns don't load native
 * modules just to no-op.
 *
 * No-ops cheaply on non-CU turns: both gate checks are zero-syscall.
 */
export declare function cleanupComputerUseAfterTurn(ctx: Pick<ToolUseContext, 'getAppState' | 'setAppState' | 'sendOSNotification'>): Promise<void>;
//# sourceMappingURL=cleanup.d.ts.map