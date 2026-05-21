import type { HookEvent } from 'src/entrypoints/agentSdkTypes.js';
import type { HttpHook } from '../settings/types.js';
/**
 * Execute an HTTP hook by POSTing the hook input JSON to the configured URL.
 * Returns the raw response for the caller to interpret.
 *
 * When sandboxing is enabled, requests are routed through the sandbox network
 * proxy which enforces the domain allowlist. The proxy returns HTTP 403 for
 * blocked domains.
 *
 * Header values support $VAR_NAME and ${VAR_NAME} env var interpolation so that
 * secrets (e.g. "Authorization: Bearer $MY_TOKEN") are not stored in settings.json.
 * Only env vars explicitly listed in the hook's `allowedEnvVars` array are resolved;
 * all other references are replaced with empty strings.
 */
export declare function execHttpHook(hook: HttpHook, _hookEvent: HookEvent, jsonInput: string, signal?: AbortSignal): Promise<{
    ok: boolean;
    statusCode?: number;
    body: string;
    error?: string;
    aborted?: boolean;
}>;
//# sourceMappingURL=execHttpHook.d.ts.map