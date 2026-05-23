/**
 * Lightweight parser for .git/config files.
 *
 * Verified against git's config.c:
 *   - Section names: case-insensitive, alphanumeric + hyphen
 *   - Subsection names (quoted): case-sensitive, backslash escapes (\\ and \")
 *   - Key names: case-insensitive, alphanumeric + hyphen
 *   - Values: optional quoting, inline comments (# or ;), backslash escapes
 */
/**
 * Parse a single value from .git/config.
 * Finds the first matching key under the given section/subsection.
 */
export declare function parseGitConfigValue(gitDir: string, section: string, subsection: string | null, key: string): Promise<string | null>;
/**
 * Parse a config value from an in-memory config string.
 * Exported for testing.
 */
export declare function parseConfigString(config: string, section: string, subsection: string | null, key: string): string | null;
//# sourceMappingURL=gitConfigParser.d.ts.map