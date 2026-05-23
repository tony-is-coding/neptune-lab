/** @cli-only */
import type { REPLHookContext } from '../../utils/hooks/postSamplingHooks.js';
import type { ToolUseContext } from '../../Tool.js';
type AppendSystemMessageFn = NonNullable<ToolUseContext['appendSystemMessage']>;
/**
 * Call once at startup (from backgroundHousekeeping alongside
 * initExtractMemories), or per-test in beforeEach for a fresh closure.
 */
export declare function initAutoDream(): void;
/**
 * Entry point from stopHooks. No-op until initAutoDream() has been called.
 * Per-turn cost when enabled: one GB cache read + one stat.
 */
export declare function executeAutoDream(context: REPLHookContext, appendSystemMessage?: AppendSystemMessageFn): Promise<void>;
export {};
//# sourceMappingURL=autoDream.d.ts.map