import type { SystemPrompt } from '../../../utils/systemPromptType.js';
import type { Message, StreamEvent, SystemAPIErrorMessage, AssistantMessage } from '../../../types/message.js';
import type { Tools } from '../../../Tool.js';
import type { ChatCompletionCreateParamsStreaming } from 'openai/resources/chat/completions/completions.mjs';
import type { Options } from '../claude.js';
/**
 * Detect whether DeepSeek-style thinking mode should be enabled.
 *
 * Enabled when:
 * 1. OPENAI_ENABLE_THINKING=1 is set (explicit enable), OR
 * 2. Model name contains "deepseek-reasoner" OR "DeepSeek-V3.2" (auto-detect, case-insensitive)
 *
 * Disabled when:
 * - OPENAI_ENABLE_THINKING=0/false/no/off is explicitly set (overrides model detection)
 *
 * @param model - The resolved OpenAI model name
 * @internal Exported for testing purposes only
 */
export declare function isOpenAIThinkingEnabled(model: string): boolean;
/**
 * Build the request body for OpenAI chat.completions.create().
 * Extracted for testability — the thinking mode params are injected here.
 *
 * DeepSeek thinking mode: inject thinking params via request body.
 * Two formats are added simultaneously to support different deployments:
 * - Official DeepSeek API: `thinking: { type: 'enabled' }`
 * - Self-hosted DeepSeek-V3.2: `enable_thinking: true` + `chat_template_kwargs: { thinking: true }`
 * OpenAI SDK passes unknown keys through to the HTTP body.
 * Each endpoint will use the format it recognizes and ignore the others.
 * @internal Exported for testing purposes only
 */
export declare function buildOpenAIRequestBody(params: {
    model: string;
    messages: any[];
    tools: any[];
    toolChoice: any;
    enableThinking: boolean;
    maxTokens: number;
    temperatureOverride?: number;
}): ChatCompletionCreateParamsStreaming & {
    thinking?: {
        type: string;
    };
    enable_thinking?: boolean;
    chat_template_kwargs?: {
        thinking: boolean;
    };
};
/**
 * OpenAI-compatible query path. Converts Anthropic-format messages/tools to
 * OpenAI format, calls the OpenAI-compatible endpoint, and converts the
 * SSE stream back to Anthropic BetaRawMessageStreamEvent for consumption
 * by the existing query pipeline.
 */
export declare function queryModelOpenAI(messages: Message[], systemPrompt: SystemPrompt, tools: Tools, signal: AbortSignal, options: Options): AsyncGenerator<StreamEvent | AssistantMessage | SystemAPIErrorMessage, void>;
//# sourceMappingURL=index.d.ts.map