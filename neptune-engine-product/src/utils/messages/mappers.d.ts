import type { UUID } from 'crypto';
import type { SDKAssistantMessage, SDKCompactBoundaryMessage, SDKMessage, SDKRateLimitInfo } from 'src/entrypoints/agentSdkTypes.js';
import type { ClaudeAILimits } from 'src/services/claudeAiLimits.js';
import type { CompactMetadata, Message } from 'src/types/message.js';
import type { DeepImmutable } from 'src/types/utils.js';
export declare function toInternalMessages(messages: readonly DeepImmutable<SDKMessage>[]): Message[];
type SDKCompactMetadata = SDKCompactBoundaryMessage['compact_metadata'];
export declare function toSDKCompactMetadata(meta: CompactMetadata): SDKCompactMetadata;
/**
 * Shared SDK→internal compact_metadata converter.
 */
export declare function fromSDKCompactMetadata(meta: SDKCompactMetadata): CompactMetadata;
export declare function toSDKMessages(messages: Message[]): SDKMessage[];
/**
 * Converts local command output (e.g. /voice, /cost) to a well-formed
 * SDKAssistantMessage so downstream consumers (mobile apps, session-ingress
 * v1alpha→v1beta converter) can parse it without schema changes.
 *
 * Emitted as assistant instead of the dedicated SDKLocalCommandOutputMessage
 * because the system/local_command_output subtype is unknown to:
 *   - mobile-apps Android SdkMessageTypes.kt (no local_command_output handler)
 *   - api-go session-ingress convertSystemEvent (only init/compact_boundary)
 * See: https://anthropic.sentry.io/issues/7266299248/ (Android)
 *
 * Strips ANSI (e.g. chalk.dim() in /cost) then unwraps the XML wrapper tags.
 */
export declare function localCommandOutputToSDKAssistantMessage(rawContent: string, uuid: UUID): SDKAssistantMessage;
/**
 * Maps internal ClaudeAILimits to the SDK-facing SDKRateLimitInfo type,
 * stripping internal-only fields like unifiedRateLimitFallbackAvailable.
 */
export declare function toSDKRateLimitInfo(limits: ClaudeAILimits | undefined): SDKRateLimitInfo | undefined;
export {};
//# sourceMappingURL=mappers.d.ts.map