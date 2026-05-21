/**
 * General string utility functions and classes for safe string accumulation
 */
/**
 * Escapes special regex characters in a string so it can be used as a literal
 * pattern in a RegExp constructor.
 */
export declare function escapeRegExp(str: string): string;
/**
 * Uppercases the first character of a string, leaving the rest unchanged.
 * Unlike lodash `capitalize`, this does NOT lowercase the remaining characters.
 *
 * @example capitalize('fooBar') → 'FooBar'
 * @example capitalize('hello world') → 'Hello world'
 */
export declare function capitalize(str: string): string;
/**
 * Returns the singular or plural form of a word based on count.
 * Replaces the inline `word${n === 1 ? '' : 's'}` idiom.
 *
 * @example plural(1, 'file') → 'file'
 * @example plural(3, 'file') → 'files'
 * @example plural(2, 'entry', 'entries') → 'entries'
 */
export declare function plural(n: number, word: string, pluralWord?: string): string;
/**
 * Returns the first line of a string without allocating a split array.
 * Used for shebang detection in diff rendering.
 */
export declare function firstLineOf(s: string): string;
/**
 * Counts occurrences of `char` in `str` using indexOf jumps instead of
 * per-character iteration. Structurally typed so Buffer works too
 * (Buffer.indexOf accepts string needles).
 */
export declare function countCharInString(str: {
    indexOf(search: string, start?: number): number;
}, char: string, start?: number): number;
/**
 * Normalize full-width (zenkaku) digits to half-width digits.
 * Useful for accepting input from Japanese/CJK IMEs.
 */
export declare function normalizeFullWidthDigits(input: string): string;
/**
 * Normalize full-width (zenkaku) space to half-width space.
 * Useful for accepting input from Japanese/CJK IMEs (U+3000 → U+0020).
 */
export declare function normalizeFullWidthSpace(input: string): string;
/**
 * Safely joins an array of strings with a delimiter, truncating if the result exceeds maxSize.
 *
 * @param lines Array of strings to join
 * @param delimiter Delimiter to use between strings (default: ',')
 * @param maxSize Maximum size of the resulting string
 * @returns The joined string, truncated if necessary
 */
export declare function safeJoinLines(lines: string[], delimiter?: string, maxSize?: number): string;
/**
 * A string accumulator that safely handles large outputs by truncating from the end
 * when a size limit is exceeded. This prevents RangeError crashes while preserving
 * the beginning of the output.
 */
export declare class EndTruncatingAccumulator {
    private readonly maxSize;
    private content;
    private isTruncated;
    private totalBytesReceived;
    /**
     * Creates a new EndTruncatingAccumulator
     * @param maxSize Maximum size in characters before truncation occurs
     */
    constructor(maxSize?: number);
    /**
     * Appends data to the accumulator. If the total size exceeds maxSize,
     * the end is truncated to maintain the size limit.
     * @param data The string data to append
     */
    append(data: string | Buffer): void;
    /**
     * Returns the accumulated string, with truncation marker if truncated
     */
    toString(): string;
    /**
     * Clears all accumulated data
     */
    clear(): void;
    /**
     * Returns the current size of accumulated data
     */
    get length(): number;
    /**
     * Returns whether truncation has occurred
     */
    get truncated(): boolean;
    /**
     * Returns total bytes received (before truncation)
     */
    get totalBytes(): number;
}
/**
 * Truncates text to a maximum number of lines, adding an ellipsis if truncated.
 *
 * @param text The text to truncate
 * @param maxLines Maximum number of lines to keep
 * @returns The truncated text with ellipsis if truncated
 */
export declare function truncateToLines(text: string, maxLines: number): string;
//# sourceMappingURL=stringUtils.d.ts.map