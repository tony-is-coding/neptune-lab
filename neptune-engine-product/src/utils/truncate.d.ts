/**
 * Truncates a file path in the middle to preserve both directory context and filename.
 * Width-aware: uses stringWidth() for correct CJK/emoji measurement.
 * For example: "src/components/deeply/nested/folder/MyComponent.tsx" becomes
 * "src/components/…/MyComponent.tsx" when maxLength is 30.
 *
 * @param path The file path to truncate
 * @param maxLength Maximum display width of the result in terminal columns (must be > 0)
 * @returns The truncated path, or original if it fits within maxLength
 */
export declare function truncatePathMiddle(path: string, maxLength: number): string;
/**
 * Truncates a string to fit within a maximum display width, measured in terminal columns.
 * Splits on grapheme boundaries to avoid breaking emoji or surrogate pairs.
 * Appends '…' when truncation occurs.
 */
export declare function truncateToWidth(text: string, maxWidth: number): string;
/**
 * Truncates from the start of a string, keeping the tail end.
 * Prepends '…' when truncation occurs.
 * Width-aware and grapheme-safe.
 */
export declare function truncateStartToWidth(text: string, maxWidth: number): string;
/**
 * Truncates a string to fit within a maximum display width, without appending an ellipsis.
 * Useful when the caller adds its own separator (e.g. middle-truncation with '…' between parts).
 * Width-aware and grapheme-safe.
 */
export declare function truncateToWidthNoEllipsis(text: string, maxWidth: number): string;
/**
 * Truncates a string to fit within a maximum display width (terminal columns),
 * splitting on grapheme boundaries to avoid breaking emoji, CJK, or surrogate pairs.
 * Appends '…' when truncation occurs.
 * @param str The string to truncate
 * @param maxWidth Maximum display width in terminal columns
 * @param singleLine If true, also truncates at the first newline
 * @returns The truncated string with ellipsis if needed
 */
export declare function truncate(str: string, maxWidth: number, singleLine?: boolean): string;
export declare function wrapText(text: string, width: number): string[];
//# sourceMappingURL=truncate.d.ts.map