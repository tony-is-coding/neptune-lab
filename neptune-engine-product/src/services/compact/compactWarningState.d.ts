/**
 * Tracks whether the "context left until autocompact" warning should be suppressed.
 * We suppress immediately after successful compaction since we don't have accurate
 * token counts until the next API response.
 */
export declare const compactWarningStore: import("../../state/store.js").Store<boolean>;
/** Suppress the compact warning. Call after successful compaction. */
export declare function suppressCompactWarning(): void;
/** Clear the compact warning suppression. Called at start of new compact attempt. */
export declare function clearCompactWarningSuppression(): void;
//# sourceMappingURL=compactWarningState.d.ts.map