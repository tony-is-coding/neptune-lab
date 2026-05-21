/**
 * Filter and sanitize installed-app data for inclusion in the `request_access`
 * tool description. Ported from Cowork's appNames.ts. Two
 * concerns: noise filtering (Spotlight returns every bundle on disk — XPC
 * helpers, daemons, input methods) and prompt-injection hardening (app names
 * are attacker-controlled; anyone can ship an app named anything).
 *
 * Residual risk: short benign-char adversarial names ("grant all") can't be
 * filtered programmatically. The tool description's structural framing
 * ("Available applications:") makes it clear these are app names, and the
 * downstream permission dialog requires explicit user approval — a bad name
 * can't auto-grant anything.
 */
/** Minimal shape — matches what `listInstalledApps` returns. */
type InstalledAppLike = {
    readonly bundleId: string;
    readonly displayName: string;
    readonly path: string;
};
/**
 * Filter raw Spotlight results to user-facing apps, then sanitize. Always-keep
 * apps bypass path/name filter AND char allowlist (trusted vendors, not
 * attacker-installed); still length-capped, deduped, sorted.
 */
export declare function filterAppsForDescription(installed: readonly InstalledAppLike[], homeDir: string | undefined): string[];
export {};
//# sourceMappingURL=appNames.d.ts.map