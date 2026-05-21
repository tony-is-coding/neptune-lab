/**
 * Telemetry for plugin/marketplace fetches that hit the network.
 *
 * Added for inc-5046 (GitHub complained about claude-plugins-official load).
 * Before this, fetch operations only had logForDebugging — no way to measure
 * actual network volume. This surfaces what's hitting GitHub vs GCS vs
 * user-hosted so we can see the GCS migration take effect and catch future
 * hot-path regressions before GitHub emails us again.
 *
 * Volume: these fire at startup (install-counts 24h-TTL)
 * and on explicit user action (install/update). NOT per-interaction. Similar
 * envelope to tengu_binary_download_*.
 */
export type PluginFetchSource = 'install_counts' | 'marketplace_clone' | 'marketplace_pull' | 'marketplace_url' | 'plugin_clone' | 'mcpb';
export type PluginFetchOutcome = 'success' | 'failure' | 'cache_hit';
export declare function logPluginFetch(source: PluginFetchSource, urlOrSpec: string | undefined, outcome: PluginFetchOutcome, durationMs: number, errorKind?: string): void;
/**
 * Classify an error into a stable bucket for the error_kind field. Keeps
 * cardinality bounded — raw error messages would explode dashboard grouping.
 *
 * Handles both axios Error objects (Node.js error codes like ENOTFOUND) and
 * git stderr strings (human phrases like "Could not resolve host"). DNS
 * checked BEFORE timeout because gitClone's error enhancement at
 * marketplaceManager.ts:~950 rewrites DNS failures to include the word
 * "timeout" — ordering the other way would misclassify git DNS as timeout.
 */
export declare function classifyFetchError(error: unknown): string;
//# sourceMappingURL=fetchTelemetry.d.ts.map