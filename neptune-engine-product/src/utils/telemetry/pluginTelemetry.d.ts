/**
 * Plugin telemetry helpers — shared field builders for plugin lifecycle events.
 *
 * Implements the twin-column privacy pattern: every user-defined-name field
 * emits both a raw value (routed to PII-tagged _PROTO_* BQ columns) and a
 * redacted twin (real name iff marketplace ∈ allowlist, else 'third-party').
 *
 * plugin_id_hash provides an opaque per-plugin aggregation key with no privacy
 * dependency — sha256(name@marketplace + FIXED_SALT) truncated to 16 chars.
 * This answers distinct-count and per-plugin-trend questions that the
 * redacted column can't, without exposing user-defined names.
 */
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../services/analytics/index.js';
import type { LoadedPlugin, PluginError, PluginManifest } from '../../types/plugin.js';
/**
 * Opaque per-plugin aggregation key. Input is the name@marketplace string as
 * it appears in enabledPlugins keys, lowercased on the marketplace suffix for
 * reproducibility. 16-char truncation keeps BQ GROUP BY cardinality manageable
 * while making collisions negligible at projected 10k-plugin scale. Name case
 * is preserved in both branches (enabledPlugins keys are case-sensitive).
 */
export declare function hashPluginId(name: string, marketplace?: string): string;
/**
 * 4-value scope enum for plugin origin. Distinct from PluginScope
 * (managed/user/project/local) which is installation-target — this is
 * marketplace-origin.
 *
 * - official: from an allowlisted Anthropic marketplace
 * - default-bundle: ships with product (@builtin), auto-enabled
 * - org: enterprise admin-pushed via managed settings (policySettings)
 * - user-local: user added marketplace or local plugin
 */
export type TelemetryPluginScope = 'official' | 'org' | 'user-local' | 'default-bundle';
export declare function getTelemetryPluginScope(name: string, marketplace: string | undefined, managedNames: Set<string> | null): TelemetryPluginScope;
/**
 * How a plugin arrived in the session. Splits self-selected from org-pushed
 * — plugin_scope alone doesn't (an official plugin can be user-installed OR
 * org-pushed; both are scope='official').
 */
export type EnabledVia = 'user-install' | 'org-policy' | 'default-enable' | 'seed-mount';
/** How a skill/command invocation was triggered. */
export type InvocationTrigger = 'user-slash' | 'claude-proactive' | 'nested-skill';
/** Where a skill invocation executes. */
export type SkillExecutionContext = 'fork' | 'inline' | 'remote';
/** How a plugin install was initiated. */
export type InstallSource = 'cli-explicit' | 'ui-discover' | 'ui-suggestion' | 'deep-link';
export declare function getEnabledVia(plugin: LoadedPlugin, managedNames: Set<string> | null, seedDirs: string[]): EnabledVia;
/**
 * Common plugin telemetry fields keyed off name@marketplace. Returns the
 * hash, scope enum, and the redacted-twin columns. Callers add the raw
 * _PROTO_* fields separately (those require the PII-tagged marker type).
 */
export declare function buildPluginTelemetryFields(name: string, marketplace: string | undefined, managedNames?: Set<string> | null): {
    plugin_id_hash: AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
    plugin_scope: AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
    plugin_name_redacted: AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
    marketplace_name_redacted: AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
    is_official_plugin: boolean;
};
/**
 * Per-invocation callers (SkillTool, processSlashCommand) pass
 * managedNames=null — the session-level tengu_plugin_enabled_for_session
 * event carries the authoritative plugin_scope, and per-invocation rows can
 * join on plugin_id_hash to recover it. This keeps hot-path call sites free
 * of the extra settings read.
 */
export declare function buildPluginCommandTelemetryFields(pluginInfo: {
    pluginManifest: PluginManifest;
    repository: string;
}, managedNames?: Set<string> | null): ReturnType<typeof buildPluginTelemetryFields>;
/**
 * Emit tengu_plugin_enabled_for_session once per enabled plugin at session
 * start. Supplements tengu_skill_loaded (which still fires per-skill) — use
 * this for plugin-level aggregates instead of DISTINCT-on-prefix hacks.
 * A plugin with 5 skills emits 5 skill_loaded rows but 1 of these.
 */
export declare function logPluginsEnabledForSession(plugins: LoadedPlugin[], managedNames: Set<string> | null, seedDirs: string[]): void;
/**
 * Bounded-cardinality error bucket for CLI plugin operation failures.
 * Maps free-form error messages to 5 stable categories so dashboard
 * GROUP BY stays tractable.
 */
export type PluginCommandErrorCategory = 'network' | 'not-found' | 'permission' | 'validation' | 'unknown';
export declare function classifyPluginCommandError(error: unknown): PluginCommandErrorCategory;
/**
 * Emit tengu_plugin_load_failed once per error surfaced by session-start
 * plugin loading. Pairs with tengu_plugin_enabled_for_session so dashboards
 * can compute a load-success rate. PluginError.type is already a bounded
 * enum — use it directly as error_category.
 */
export declare function logPluginLoadErrors(errors: PluginError[], managedNames: Set<string> | null): void;
//# sourceMappingURL=pluginTelemetry.d.ts.map