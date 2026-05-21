export type SinkName = 'datadog' | 'firstParty';
/**
 * GrowthBook JSON config that disables individual analytics sinks.
 * Shape: { datadog?: boolean, firstParty?: boolean }
 * A value of true for a key stops all dispatch to that sink.
 * Default {} (nothing killed). Fail-open: missing/malformed config = sink stays on.
 *
 * NOTE: Must NOT be called from inside is1PEventLoggingEnabled() -
 * growthbook.ts:isGrowthBookEnabled() calls that, so a lookup here would recurse.
 * Call at per-event dispatch sites instead.
 */
export declare function isSinkKilled(sink: SinkName): boolean;
//# sourceMappingURL=sinkKillswitch.d.ts.map