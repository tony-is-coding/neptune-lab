import type { BetaToolUnion } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { ChatCompletionTool } from 'openai/resources/chat/completions/completions.mjs';
/**
 * Convert Anthropic tool schemas to OpenAI function calling format.
 *
 * Anthropic: { name, description, input_schema }
 * OpenAI:    { type: "function", function: { name, description, parameters } }
 *
 * Anthropic-specific fields (cache_control, defer_loading, etc.) are stripped.
 */
export declare function anthropicToolsToOpenAI(tools: BetaToolUnion[]): ChatCompletionTool[];
/**
 * Map Anthropic tool_choice to OpenAI tool_choice format.
 *
 * Anthropic → OpenAI:
 * - { type: "auto" } → "auto"
 * - { type: "any" }  → "required"
 * - { type: "tool", name } → { type: "function", function: { name } }
 * - undefined → undefined (use provider default)
 */
export declare function anthropicToolChoiceToOpenAI(toolChoice: unknown): string | {
    type: 'function';
    function: {
        name: string;
    };
} | undefined;
//# sourceMappingURL=convertTools.d.ts.map