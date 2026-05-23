/**
 * Formats a byte count to a human-readable string (KB, MB, GB).
 * @example formatFileSize(1536) → "1.5KB"
 */
export declare function formatFileSize(sizeInBytes: number): string;
/**
 * Formats milliseconds as seconds with 1 decimal place (e.g. `1234` → `"1.2s"`).
 * Unlike formatDuration, always keeps the decimal — use for sub-minute timings
 * where the fractional second is meaningful (TTFT, hook durations, etc.).
 */
export declare function formatSecondsShort(ms: number): string;
export declare function formatDuration(ms: number, options?: {
    hideTrailingZeros?: boolean;
    mostSignificantOnly?: boolean;
}): string;
export declare function formatNumber(number: number): string;
export declare function formatTokens(count: number): string;
type RelativeTimeStyle = 'long' | 'short' | 'narrow';
type RelativeTimeOptions = {
    style?: RelativeTimeStyle;
    numeric?: 'always' | 'auto';
};
export declare function formatRelativeTime(date: Date, options?: RelativeTimeOptions & {
    now?: Date;
}): string;
export declare function formatRelativeTimeAgo(date: Date, options?: RelativeTimeOptions & {
    now?: Date;
}): string;
/**
 * Formats log metadata for display (time, size or message count, branch, tag, PR)
 */
export declare function formatLogMetadata(log: {
    modified: Date;
    messageCount: number;
    fileSize?: number;
    gitBranch?: string;
    tag?: string;
    agentSetting?: string;
    prNumber?: number;
    prRepository?: string;
}): string;
export declare function formatResetTime(timestampInSeconds: number | undefined, showTimezone?: boolean, showTime?: boolean): string | undefined;
export declare function formatResetText(resetsAt: string, showTimezone?: boolean, showTime?: boolean): string;
export { truncate, truncatePathMiddle, truncateStartToWidth, truncateToWidth, truncateToWidthNoEllipsis, wrapText, } from './truncate.js';
//# sourceMappingURL=format.d.ts.map