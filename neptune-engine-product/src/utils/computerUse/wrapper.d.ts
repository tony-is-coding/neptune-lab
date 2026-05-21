/**
 * The `.call()` override — thin adapter between `ToolUseContext` and
 * `bindSessionContext`. Spread into the MCP tool object in `client.ts`
 * (same pattern as Chrome's rendering overrides, plus `.call()`).
 *
 * The wrapper-closure logic (build overrides fresh, lock gate, permission
 * merge, screenshot stash) lives in `@ant/computer-use-mcp`'s
 * `bindSessionContext`. This file binds it once per process,
 * caches the dispatcher, and updates a per-call ref for the pieces of
 * `ToolUseContext` that vary per-call (`abortController`, `setToolJSX`,
 * `sendOSNotification`). AppState accessors are read through the ref too —
 * they're likely stable but we don't depend on that.
 *
 * External callers reach this via the lazy require thunk in `client.ts`, gated
 * on `feature('CHICAGO_MCP')`. Runtime enablement is controlled by the
 * GrowthBook gate `tengu_malort_pedway` (see gates.ts).
 */
import { type ComputerUseSessionContext } from '@ant/computer-use-mcp';
import type { Tool } from '../../Tool.js';
import { getComputerUseMCPRenderingOverrides } from './toolRendering.js';
type CallOverride = Pick<Tool, 'call'>['call'];
export declare function buildSessionContext(): ComputerUseSessionContext;
/**
 * Returns the full override object for a single `mcp__computer-use__{toolName}`
 * tool: rendering overrides from `toolRendering.tsx` plus a `.call()` that
 * dispatches through the cached binder.
 */
type ComputerUseMCPToolOverrides = ReturnType<typeof getComputerUseMCPRenderingOverrides> & {
    call: CallOverride;
};
export declare function getComputerUseMCPToolOverrides(toolName: string): ComputerUseMCPToolOverrides;
export {};
//# sourceMappingURL=wrapper.d.ts.map