/**
 * Shared Intl object instances with lazy initialization.
 *
 * Intl constructors are expensive (~0.05-0.1ms each), so we cache instances
 * for reuse across the codebase instead of creating new ones each time.
 * Lazy initialization ensures we only pay the cost when actually needed.
 */
export declare function getGraphemeSegmenter(): Intl.Segmenter;
/**
 * Extract the first grapheme cluster from a string.
 * Returns '' for empty strings.
 */
export declare function firstGrapheme(text: string): string;
/**
 * Extract the last grapheme cluster from a string.
 * Returns '' for empty strings.
 */
export declare function lastGrapheme(text: string): string;
export declare function getWordSegmenter(): Intl.Segmenter;
export declare function getRelativeTimeFormat(style: 'long' | 'short' | 'narrow', numeric: 'always' | 'auto'): Intl.RelativeTimeFormat;
export declare function getTimeZone(): string;
export declare function getSystemLocaleLanguage(): string | undefined;
//# sourceMappingURL=intl.d.ts.map