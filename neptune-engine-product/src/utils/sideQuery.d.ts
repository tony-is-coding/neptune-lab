import type Anthropic from '@anthropic-ai/sdk';
import type { BetaToolUnion } from '@anthropic-ai/sdk/resources/beta/messages.js';
import type { QuerySource } from '../constants/querySource.js';
type MessageParam = Anthropic.MessageParam;
type TextBlockParam = Anthropic.TextBlockParam;
type Tool = Anthropic.Tool;
type ToolChoice = Anthropic.ToolChoice;
type BetaMessage = Anthropic.Beta.Messages.BetaMessage;
type BetaJSONOutputFormat = Anthropic.Beta.Messages.BetaJSONOutputFormat;
export type SideQueryOptions = {
    /** Model to use for the query */
    model: string;
    /**
     * System prompt - string or array of text blocks (will be prefixed with CLI attribution).
     *
     * The attribution header is always placed in its own TextBlockParam block to ensure
     * server-side parsing correctly extracts the cc_entrypoint value without including
     * system prompt content.
     */
    system?: string | TextBlockParam[];
    /** Messages to send (supports cache_control on content blocks) */
    messages: MessageParam[];
    /** Optional tools (supports both standard Tool[] and BetaToolUnion[] for custom tool types) */
    tools?: Tool[] | BetaToolUnion[];
    /** Optional tool choice (use { type: 'tool', name: 'x' } for forced output) */
    tool_choice?: ToolChoice;
    /** Optional JSON output format for structured responses */
    output_format?: BetaJSONOutputFormat;
    /** Max tokens (default: 1024) */
    max_tokens?: number;
    /** Max retries (default: 2) */
    maxRetries?: number;
    /** Abort signal */
    signal?: AbortSignal;
    /** Skip CLI system prompt prefix (keeps attribution header for OAuth). For internal classifiers that provide their own prompt. */
    skipSystemPromptPrefix?: boolean;
    /** Temperature override */
    temperature?: number;
    /** Thinking budget (enables thinking), or `false` to send `{ type: 'disabled' }`. */
    thinking?: number | false;
    /** Stop sequences — generation stops when any of these strings is emitted */
    stop_sequences?: string[];
    /** Attributes this call in tengu_api_success for COGS joining against reporting.sampling_calls. */
    querySource: QuerySource;
};
/**
 * Lightweight API wrapper for "side queries" outside the main conversation loop.
 *
 * Use this instead of direct client.beta.messages.create() calls to ensure
 * proper OAuth token validation with fingerprint attribution headers.
 *
 * This handles:
 * - Fingerprint computation for OAuth validation
 * - Attribution header injection
 * - CLI system prompt prefix
 * - Proper betas for the model
 * - API metadata
 * - Model string normalization (strips [1m] suffix for API)
 *
 * @example
 * // Permission explainer
 * await sideQuery({ querySource: 'permission_explainer', model, system: SYSTEM_PROMPT, messages, tools, tool_choice })
 *
 * @example
 * // Session search
 * await sideQuery({ querySource: 'session_search', model, system: SEARCH_PROMPT, messages })
 *
 * @example
 * // Model validation
 * await sideQuery({ querySource: 'model_validation', model, max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] })
 */
export declare function sideQuery(opts: SideQueryOptions): Promise<BetaMessage>;
export {};
//# sourceMappingURL=sideQuery.d.ts.map