import type { Message } from '../../types/message.js';
/**
 * Groups messages at API-round boundaries: one group per API round-trip.
 * A boundary fires when a NEW assistant response begins (different
 * message.id from the prior assistant). For well-formed conversations
 * this is an API-safe split point — the API contract requires every
 * tool_use to be resolved before the next assistant turn, so pairing
 * validity falls out of the assistant-id boundary. For malformed inputs
 * (dangling tool_use after resume/truncation) the fork's
 * ensureToolResultPairing repairs the split at API time.
 *
 * Replaces the prior human-turn grouping (boundaries only at real user
 * prompts) with finer-grained API-round grouping, allowing reactive
 * compact to operate on single-prompt agentic sessions (SDK/CCR/eval
 * callers) where the entire workload is one human turn.
 *
 * Extracted to its own file to break the compact.ts ↔ compactMessages.ts
 * cycle (CC-1180) — the cycle shifted module-init order enough to surface
 * a latent ws CJS/ESM resolution race in CI shard-2.
 */
export declare function groupMessagesByApiRound(messages: Message[]): Message[][];
//# sourceMappingURL=grouping.d.ts.map