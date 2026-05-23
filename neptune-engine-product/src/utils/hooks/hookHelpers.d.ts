import { z } from 'zod/v4';
import type { Tool } from '../../Tool.js';
import type { SetAppState } from '../messageQueueManager.js';
/**
 * Schema for hook responses (shared by prompt and agent hooks)
 */
export declare const hookResponseSchema: () => z.ZodObject<{
    ok: z.ZodBoolean;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Add hook input JSON to prompt, either replacing $ARGUMENTS placeholder or appending.
 * Also supports indexed arguments like $ARGUMENTS[0], $ARGUMENTS[1], or shorthand $0, $1, etc.
 */
export declare function addArgumentsToPrompt(prompt: string, jsonInput: string): string;
/**
 * Create a StructuredOutput tool configured for hook responses.
 * Reusable by agent hooks and background verification.
 */
export declare function createStructuredOutputTool(): Tool;
/**
 * Register a function hook that enforces structured output via SyntheticOutputTool.
 * Used by ask.tsx, execAgentHook.ts, and background verification.
 */
export declare function registerStructuredOutputEnforcement(setAppState: SetAppState, sessionId: string): void;
//# sourceMappingURL=hookHelpers.d.ts.map