import type { ToolUseBlock } from '@anthropic-ai/sdk/resources/index.mjs';
import type { CanUseToolFn } from '../../types/permissions.js';
import { type Tool, type ToolUseContext } from '../../Tool.js';
import type { AssistantMessage, Message } from '../../types/message.js';
/** Minimum total hook duration (ms) to show inline timing summary */
export declare const HOOK_TIMING_DISPLAY_THRESHOLD_MS = 500;
/**
 * Classify a tool execution error into a telemetry-safe string.
 *
 * In minified/external builds, `error.constructor.name` is mangled into
 * short identifiers like "nJT" or "Chq" — useless for diagnostics.
 * This function extracts structured, telemetry-safe information instead:
 * - TelemetrySafeError: use its telemetryMessage (already vetted)
 * - Node.js fs errors: log the error code (ENOENT, EACCES, etc.)
 * - Known error types: use their unminified name
 * - Fallback: "Error" (better than a mangled 3-char identifier)
 */
export declare function classifyToolError(error: unknown): string;
export type MessageUpdateLazy<M extends Message = Message> = {
    message: M;
    contextModifier?: {
        toolUseID: string;
        modifyContext: (context: ToolUseContext) => ToolUseContext;
    };
};
export type McpServerType = 'stdio' | 'sse' | 'http' | 'ws' | 'sdk' | 'sse-ide' | 'ws-ide' | 'claudeai-proxy' | undefined;
export declare function runToolUse(toolUse: ToolUseBlock, assistantMessage: AssistantMessage, canUseTool: CanUseToolFn, toolUseContext: ToolUseContext): AsyncGenerator<MessageUpdateLazy, void>;
/**
 * Appended to Zod errors when a deferred tool wasn't in the discovered-tool
 * set — re-runs the claude.ts schema-filter scan dispatch-time to detect the
 * mismatch. The raw Zod error ("expected array, got string") doesn't tell the
 * model to re-load the tool; this hint does. Null if the schema was sent.
 */
export declare function buildSchemaNotSentHint(tool: Tool, messages: Message[], tools: readonly {
    name: string;
}[]): string | null;
//# sourceMappingURL=toolExecution.d.ts.map