import { APIError } from '@anthropic-ai/sdk';
import type { BetaMessage, BetaStopReason } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { SDKAssistantMessageError } from 'src/entrypoints/agentSdkTypes.js';
import type { AssistantMessage, Message, UserMessage } from 'src/types/message.js';
export declare const API_ERROR_MESSAGE_PREFIX = "API Error";
export declare function startsWithApiErrorPrefix(text: string): boolean;
export declare const PROMPT_TOO_LONG_ERROR_MESSAGE = "Prompt is too long";
export declare function isPromptTooLongMessage(msg: AssistantMessage): boolean;
/**
 * Parse actual/limit token counts from a raw prompt-too-long API error
 * message like "prompt is too long: 137500 tokens > 135000 maximum".
 * The raw string may be wrapped in SDK prefixes or JSON envelopes, or
 * have different casing (Vertex), so this is intentionally lenient.
 */
export declare function parsePromptTooLongTokenCounts(rawMessage: string): {
    actualTokens: number | undefined;
    limitTokens: number | undefined;
};
/**
 * Returns how many tokens over the limit a prompt-too-long error reports,
 * or undefined if the message isn't PTL or its errorDetails are unparseable.
 * Reactive compact uses this gap to jump past multiple groups in one retry
 * instead of peeling one-at-a-time.
 */
export declare function getPromptTooLongTokenGap(msg: AssistantMessage): number | undefined;
/**
 * Is this raw API error text a media-size rejection that stripImagesFromMessages
 * can fix? Reactive compact's summarize retry uses this to decide whether to
 * strip and retry (media error) or bail (anything else).
 *
 * Patterns MUST stay in sync with the getAssistantMessageFromError branches
 * that populate errorDetails (~L523 PDF, ~L560 image, ~L573 many-image) and
 * the classifyAPIError branches (~L929-946). The closed loop: errorDetails is
 * only set after those branches already matched these same substrings, so
 * isMediaSizeError(errorDetails) is tautologically true for that path. API
 * wording drift causes graceful degradation (errorDetails stays undefined,
 * caller short-circuits), not a false negative.
 */
export declare function isMediaSizeError(raw: string): boolean;
/**
 * Message-level predicate: is this assistant message a media-size rejection?
 * Parallel to isPromptTooLongMessage. Checks errorDetails (the raw API error
 * string populated by the getAssistantMessageFromError branches at ~L523/560/573)
 * rather than content text, since media errors have per-variant content strings.
 */
export declare function isMediaSizeErrorMessage(msg: AssistantMessage): boolean;
export declare const CREDIT_BALANCE_TOO_LOW_ERROR_MESSAGE = "Credit balance is too low";
export declare const INVALID_API_KEY_ERROR_MESSAGE = "Not logged in \u00B7 Please run /login";
export declare const INVALID_API_KEY_ERROR_MESSAGE_EXTERNAL = "Invalid API key \u00B7 Fix external API key";
export declare const ORG_DISABLED_ERROR_MESSAGE_ENV_KEY_WITH_OAUTH = "Your ANTHROPIC_API_KEY belongs to a disabled organization \u00B7 Unset the environment variable to use your subscription instead";
export declare const ORG_DISABLED_ERROR_MESSAGE_ENV_KEY = "Your ANTHROPIC_API_KEY belongs to a disabled organization \u00B7 Update or unset the environment variable";
export declare const TOKEN_REVOKED_ERROR_MESSAGE = "OAuth token revoked \u00B7 Please run /login";
export declare const CCR_AUTH_ERROR_MESSAGE = "Authentication error \u00B7 This may be a temporary network issue, please try again";
export declare const REPEATED_529_ERROR_MESSAGE = "Repeated 529 Overloaded errors";
export declare const CUSTOM_OFF_SWITCH_MESSAGE = "Opus is experiencing high load, please use /model to switch to Sonnet";
export declare const API_TIMEOUT_ERROR_MESSAGE = "Request timed out";
export declare function getPdfTooLargeErrorMessage(): string;
export declare function getPdfPasswordProtectedErrorMessage(): string;
export declare function getPdfInvalidErrorMessage(): string;
export declare function getImageTooLargeErrorMessage(): string;
export declare function getRequestTooLargeErrorMessage(): string;
export declare const OAUTH_ORG_NOT_ALLOWED_ERROR_MESSAGE = "Your account does not have access to Claude Code. Please run /login.";
export declare function getTokenRevokedErrorMessage(): string;
export declare function getOauthOrgNotAllowedErrorMessage(): string;
/**
 * Type guard to check if a value is a valid Message response from the API
 */
export declare function isValidAPIMessage(value: unknown): value is BetaMessage;
/**
 * Given a response that doesn't look quite right, see if it contains any known error types we can extract.
 */
export declare function extractUnknownErrorFormat(value: unknown): string | undefined;
export declare function getAssistantMessageFromError(error: unknown, model: string, options?: {
    messages?: Message[];
    messagesForAPI?: (UserMessage | AssistantMessage)[];
}): AssistantMessage;
/**
 * Classifies an API error into a specific error type for analytics tracking.
 * Returns a standardized error type string suitable for Datadog tagging.
 */
export declare function classifyAPIError(error: unknown): string;
export declare function categorizeRetryableAPIError(error: APIError): SDKAssistantMessageError;
export declare function getErrorMessageIfRefusal(stopReason: BetaStopReason | null, model: string): AssistantMessage | undefined;
//# sourceMappingURL=errors.d.ts.map