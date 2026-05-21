/**
 * Frontmatter parser for markdown files
 * Extracts and parses YAML frontmatter between --- delimiters
 */
import type { HooksSettings } from './settings/types.js';
export type FrontmatterData = {
    'allowed-tools'?: string | string[] | null;
    description?: string | null;
    type?: string | null;
    'argument-hint'?: string | null;
    when_to_use?: string | null;
    version?: string | null;
    'hide-from-slash-command-tool'?: string | null;
    model?: string | null;
    skills?: string | null;
    'user-invocable'?: string | null;
    hooks?: HooksSettings | null;
    effort?: string | null;
    context?: 'inline' | 'fork' | null;
    agent?: string | null;
    paths?: string | string[] | null;
    shell?: string | null;
    [key: string]: unknown;
};
export type ParsedMarkdown = {
    frontmatter: FrontmatterData;
    content: string;
};
export declare const FRONTMATTER_REGEX: RegExp;
/**
 * Parses markdown content to extract frontmatter and content
 * @param markdown The raw markdown content
 * @returns Object containing parsed frontmatter and content without frontmatter
 */
export declare function parseFrontmatter(markdown: string, sourcePath?: string): ParsedMarkdown;
/**
 * Splits a comma-separated string and expands brace patterns.
 * Commas inside braces are not treated as separators.
 * Also accepts a YAML list (string array) for ergonomic frontmatter.
 * @param input - Comma-separated string, or array of strings, with optional brace patterns
 * @returns Array of expanded strings
 * @example
 * splitPathInFrontmatter("a, b") // returns ["a", "b"]
 * splitPathInFrontmatter("a, src/*.{ts,tsx}") // returns ["a", "src/*.ts", "src/*.tsx"]
 * splitPathInFrontmatter("{a,b}/{c,d}") // returns ["a/c", "a/d", "b/c", "b/d"]
 * splitPathInFrontmatter(["a", "src/*.{ts,tsx}"]) // returns ["a", "src/*.ts", "src/*.tsx"]
 */
export declare function splitPathInFrontmatter(input: string | string[]): string[];
/**
 * Parses a positive integer value from frontmatter.
 * Handles both number and string representations.
 *
 * @param value The raw value from frontmatter (could be number, string, or undefined)
 * @returns The parsed positive integer, or undefined if invalid or not provided
 */
export declare function parsePositiveIntFromFrontmatter(value: unknown): number | undefined;
/**
 * Validate and coerce a description value from frontmatter.
 *
 * Strings are returned as-is (trimmed). Primitive values (numbers, booleans)
 * are coerced to strings via String(). Non-scalar values (arrays, objects)
 * are invalid and are logged then omitted. Null, undefined, and
 * empty/whitespace-only strings return null so callers can fall back to
 * a default.
 *
 * @param value - The raw frontmatter description value
 * @param componentName - The skill/command/agent/style name for log messages
 * @param pluginName - The plugin name, if this came from a plugin
 */
export declare function coerceDescriptionToString(value: unknown, componentName?: string, pluginName?: string): string | null;
/**
 * Parse a boolean frontmatter value.
 * Only returns true for literal true or "true" string.
 */
export declare function parseBooleanFrontmatter(value: unknown): boolean;
/**
 * Shell values accepted in `shell:` frontmatter for .md `!`-block execution.
 */
export type FrontmatterShell = 'bash' | 'powershell';
/**
 * Parse and validate the `shell:` frontmatter field.
 *
 * Returns undefined for absent/null/empty (caller defaults to bash).
 * Logs a warning and returns undefined for unrecognized values — we fall
 * back to bash rather than failing the skill load, matching how `effort`
 * and other fields degrade.
 */
export declare function parseShellFrontmatter(value: unknown, source: string): FrontmatterShell | undefined;
//# sourceMappingURL=frontmatterParser.d.ts.map