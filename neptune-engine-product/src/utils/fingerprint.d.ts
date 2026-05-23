import type { AssistantMessage, UserMessage } from '../types/message.js';
/**
 * Hardcoded salt from backend validation.
 * Must match exactly for fingerprint validation to pass.
 */
export declare const FINGERPRINT_SALT = "59cf53e54c78";
/**
 * Extracts text content from the first user message.
 *
 * @param messages - Array of internal message types
 * @returns First text content, or empty string if not found
 */
export declare function extractFirstMessageText(messages: (UserMessage | AssistantMessage)[]): string;
/**
 * Computes 3-character fingerprint for Claude Code attribution.
 * Algorithm: SHA256(SALT + msg[4] + msg[7] + msg[20] + version)[:3]
 * IMPORTANT: Do not change this method without careful coordination with
 * 1P and 3P (Bedrock, Vertex, Azure) APIs.
 *
 * @param messageText - First user message text content
 * @param version - Version string (from MACRO.VERSION)
 * @returns 3-character hex fingerprint
 */
export declare function computeFingerprint(messageText: string, version: string): string;
/**
 * Computes fingerprint from the first user message.
 *
 * @param messages - Array of normalized messages
 * @returns 3-character hex fingerprint
 */
export declare function computeFingerprintFromMessages(messages: (UserMessage | AssistantMessage)[]): string;
//# sourceMappingURL=fingerprint.d.ts.map