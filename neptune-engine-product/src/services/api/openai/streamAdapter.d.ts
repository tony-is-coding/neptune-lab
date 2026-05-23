import type { BetaRawMessageStreamEvent } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions/completions.mjs';
/**
 * Adapt an OpenAI streaming response into Anthropic BetaRawMessageStreamEvent.
 *
 * Mapping:
 *   First chunk              → message_start
 *   delta.reasoning_content  → content_block_start(thinking) + thinking_delta + content_block_stop
 *   delta.content            → content_block_start(text) + text_delta + content_block_stop
 *   delta.tool_calls         → content_block_start(tool_use) + input_json_delta + content_block_stop
 *   finish_reason            → message_delta(stop_reason) + message_stop
 *
 * Usage field mapping (OpenAI → Anthropic):
 *   prompt_tokens                        → input_tokens
 *   completion_tokens                    → output_tokens
 *   prompt_tokens_details.cached_tokens  → cache_read_input_tokens
 *   (no OpenAI equivalent)               → cache_creation_input_tokens (always 0)
 *
 *   All four fields are emitted in the post-loop message_delta (not message_start)
 *   so that trailing usage chunks (sent after finish_reason by some
 *   OpenAI-compatible endpoints) are fully captured before the final counts are reported.
 *
 * Thinking support:
 *   DeepSeek and compatible providers send `delta.reasoning_content` for chain-of-thought.
 *   This is mapped to Anthropic's `thinking` content blocks:
 *     content_block_start: { type: 'thinking', thinking: '', signature: '' }
 *     content_block_delta: { type: 'thinking_delta', thinking: '...' }
 *
 * Prompt caching:
 *   OpenAI reports cached tokens in usage.prompt_tokens_details.cached_tokens.
 *   This is mapped to Anthropic's cache_read_input_tokens.
 */
export declare function adaptOpenAIStreamToAnthropic(stream: AsyncIterable<ChatCompletionChunk>, model: string): AsyncGenerator<BetaRawMessageStreamEvent, void>;
//# sourceMappingURL=streamAdapter.d.ts.map