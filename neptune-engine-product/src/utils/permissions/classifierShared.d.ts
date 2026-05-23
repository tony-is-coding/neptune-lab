/**
 * Shared infrastructure for classifier-based permission systems.
 *
 * This module provides common types, schemas, and utilities used by both:
 * - bashClassifier.ts (semantic Bash command matching)
 * - yoloClassifier.ts (YOLO mode security classification)
 */
import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages.js';
import type { z } from 'zod/v4';
/**
 * Extract tool use block from message content by tool name.
 */
export declare function extractToolUseBlock(content: BetaContentBlock[], toolName: string): Extract<BetaContentBlock, {
    type: 'tool_use';
}> | null;
/**
 * Parse and validate classifier response from tool use block.
 * Returns null if parsing fails.
 */
export declare function parseClassifierResponse<T extends z.ZodTypeAny>(toolUseBlock: Extract<BetaContentBlock, {
    type: 'tool_use';
}>, schema: T): z.infer<T> | null;
//# sourceMappingURL=classifierShared.d.ts.map