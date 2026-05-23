/**
 * Permission prompts over channels (Telegram, iMessage, Discord).
 *
 * Mirrors `BridgePermissionCallbacks` — when CC hits a permission dialog,
 * it ALSO sends the prompt via active channels and races the reply against
 * local UI / bridge / hooks / classifier. First resolver wins via claim().
 *
 * Inbound is a structured event: the server parses the user's "yes tbxkq"
 * reply and emits notifications/claude/channel/permission with
 * {request_id, behavior}. CC never sees the reply as text — approval
 * requires the server to deliberately emit that specific event, not just
 * relay content. Servers opt in by declaring
 * capabilities.experimental['claude/channel/permission'].
 *
 * Kenneth's "would this let Claude self-approve?": the approving party is
 * the human via the channel, not Claude. But the trust boundary isn't the
 * terminal — it's the allowlist (tengu_harbor_ledger). A compromised
 * channel server CAN fabricate "yes <id>" without the human seeing the
 * prompt. Accepted risk: a compromised channel already has unlimited
 * conversation-injection turns (social-engineer over time, wait for
 * acceptEdits, etc.); inject-then-self-approve is faster, not more
 * capable. The dialog slows a compromised channel; it doesn't stop one.
 * See PR discussion 2956440848.
 */
/**
 * GrowthBook runtime gate — separate from the channels gate (tengu_harbor)
 * so channels can ship without permission-relay riding along (Kenneth: "no
 * bake time if it goes out tomorrow"). Default false; flip without a release.
 * Checked once at useManageMCPConnections mount — mid-session flag changes
 * don't apply until restart.
 */
export declare function isChannelPermissionRelayEnabled(): boolean;
export type ChannelPermissionResponse = {
    behavior: 'allow' | 'deny';
    /** Which channel server the reply came from (e.g., "plugin:telegram:tg"). */
    fromServer: string;
};
export type ChannelPermissionCallbacks = {
    /** Register a resolver for a request ID. Returns unsubscribe. */
    onResponse(requestId: string, handler: (response: ChannelPermissionResponse) => void): () => void;
    /** Resolve a pending request from a structured channel event
     *  (notifications/claude/channel/permission). Returns true if the ID
     *  was pending — the server parsed the user's reply and emitted
     *  {request_id, behavior}; we just match against the map. */
    resolve(requestId: string, behavior: 'allow' | 'deny', fromServer: string): boolean;
};
/**
 * Reply format spec for channel servers to implement:
 *   /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i
 *
 * 5 lowercase letters, no 'l' (looks like 1/I). Case-insensitive (phone
 * autocorrect). No bare yes/no (conversational). No prefix/suffix chatter.
 *
 * CC generates the ID and sends the prompt. The SERVER parses the user's
 * reply and emits notifications/claude/channel/permission with {request_id,
 * behavior} — CC doesn't regex-match text anymore. Exported so plugins can
 * import the exact regex rather than hand-copying it.
 */
export declare const PERMISSION_REPLY_RE: RegExp;
/**
 * Short ID from a toolUseID. 5 letters from a 25-char alphabet (a-z minus
 * 'l' — looks like 1/I in many fonts). 25^5 ≈ 9.8M space, birthday
 * collision at 50% needs ~3K simultaneous pending prompts, absurd for a
 * single interactive session. Letters-only so phone users don't switch
 * keyboard modes (hex alternates a-f/0-9 → mode toggles). Re-hashes with
 * a salt suffix if the result contains a blocklisted substring — 5 random
 * letters can spell things you don't want in a text message to your phone.
 * toolUseIDs are `toolu_` + base64-ish; we hash rather than slice.
 */
export declare function shortRequestId(toolUseID: string): string;
/**
 * Truncate tool input to a phone-sized JSON preview. 200 chars is
 * roughly 3 lines on a narrow phone screen. Full input is in the local
 * terminal dialog; the channel gets a summary so Write(5KB-file) doesn't
 * flood your texts. Server decides whether/how to show it.
 */
export declare function truncateForPreview(input: unknown): string;
/**
 * Filter MCP clients down to those that can relay permission prompts.
 * Three conditions, ALL required: connected + in the session's --channels
 * allowlist + declares BOTH capabilities. The second capability is the
 * server's explicit opt-in — a relay-only channel never becomes a
 * permission surface by accident (Kenneth's "users may be unpleasantly
 * surprised"). Centralized here so a future fourth condition lands once.
 */
export declare function filterPermissionRelayClients<T extends {
    type: string;
    name: string;
    capabilities?: {
        experimental?: Record<string, unknown>;
    };
}>(clients: readonly T[], isInAllowlist: (name: string) => boolean): (T & {
    type: 'connected';
})[];
/**
 * Factory for the callbacks object. The pending Map is closed over — NOT
 * module-level (per src/CLAUDE.md), NOT in AppState (functions-in-state
 * causes issues with equality/serialization). Same lifetime pattern as
 * `replBridgePermissionCallbacks`: constructed once per session inside
 * a React hook, stable reference stored in AppState.
 *
 * resolve() is called from the dedicated notification handler
 * (notifications/claude/channel/permission) with the structured payload.
 * The server already parsed "yes tbxkq" → {request_id, behavior}; we just
 * match against the pending map. No regex on CC's side — text in the
 * general channel can't accidentally approve anything.
 */
export declare function createChannelPermissionCallbacks(): ChannelPermissionCallbacks;
//# sourceMappingURL=channelPermissions.d.ts.map