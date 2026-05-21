import type { Anthropic } from '@anthropic-ai/sdk';
import type { Attachment } from '../utils/attachments.js';
export declare function countTokensWithAPI(content: string): Promise<number | null>;
export declare function countMessagesTokensWithAPI(messages: Anthropic.Beta.Messages.BetaMessageParam[], tools: Anthropic.Beta.Messages.BetaToolUnion[]): Promise<number | null>;
export declare function roughTokenCountEstimation(content: string, bytesPerToken?: number): number;
/**
 * Returns an estimated bytes-per-token ratio for a given file extension.
 * Dense JSON has many single-character tokens (`{`, `}`, `:`, `,`, `"`)
 * which makes the real ratio closer to 2 rather than the default 4.
 */
export declare function bytesPerTokenForFileType(fileExtension: string): number;
/**
 * Like {@link roughTokenCountEstimation} but uses a more accurate
 * bytes-per-token ratio when the file type is known.
 *
 * This matters when the API-based token count is unavailable (e.g. on
 * Bedrock) and we fall back to the rough estimate — an underestimate can
 * let an oversized tool result slip into the conversation.
 */
export declare function roughTokenCountEstimationForFileType(content: string, fileExtension: string): number;
/**
 * Estimates token count for a Message object by extracting and analyzing its text content.
 * This provides a more reliable estimate than getTokenUsage for messages that may have been compacted.
 * Uses Haiku for token counting (Haiku 4.5 supports thinking blocks), except:
 * - Vertex global region: uses Sonnet (Haiku not available)
 * - Bedrock with thinking blocks: uses Sonnet (Haiku 3.5 doesn't support thinking)
 */
export declare function countTokensViaHaikuFallback(messages: Anthropic.Beta.Messages.BetaMessageParam[], tools: Anthropic.Beta.Messages.BetaToolUnion[]): Promise<number | null>;
export declare function roughTokenCountEstimationForMessages(messages: readonly {
    type: string;
    message?: {
        content?: unknown;
    };
    attachment?: Attachment;
}[]): number;
export declare function roughTokenCountEstimationForMessage(message: {
    type: string;
    message?: {
        content?: unknown;
    };
    attachment?: Attachment;
}): number;
//# sourceMappingURL=tokenEstimation.d.ts.map