/**
 * Heredoc extraction and restoration utilities.
 *
 * The shell-quote library parses `<<` as two separate `<` redirect operators,
 * which breaks command splitting for heredoc syntax. This module provides
 * utilities to extract heredocs before parsing and restore them after.
 *
 * Supported heredoc variations:
 * - <<WORD      - basic heredoc
 * - <<'WORD'    - single-quoted delimiter (no variable expansion in content)
 * - <<"WORD"    - double-quoted delimiter (with variable expansion)
 * - <<-WORD     - dash prefix (strips leading tabs from content)
 * - <<-'WORD'   - combined dash and quoted delimiter
 *
 * Known limitations:
 * - Heredocs inside backtick command substitution may not be extracted
 * - Very complex multi-heredoc scenarios may not be extracted
 *
 * When extraction fails, the command passes through unchanged. This is safe
 * because the unextracted heredoc will either cause shell-quote parsing to fail
 * (falling back to treating the whole command as one unit) or require manual
 * approval for each apparent subcommand.
 *
 * @module
 */
export type HeredocInfo = {
    /** The full heredoc text including << operator, delimiter, content, and closing delimiter */
    fullText: string;
    /** The delimiter word (without quotes) */
    delimiter: string;
    /** Start position of the << operator in the original command */
    operatorStartIndex: number;
    /** End position of the << operator (exclusive) - content on same line after this is preserved */
    operatorEndIndex: number;
    /** Start position of heredoc content (the newline before content) */
    contentStartIndex: number;
    /** End position of heredoc content including closing delimiter (exclusive) */
    contentEndIndex: number;
};
export type HeredocExtractionResult = {
    /** The command with heredocs replaced by placeholders */
    processedCommand: string;
    /** Map of placeholder string to original heredoc info */
    heredocs: Map<string, HeredocInfo>;
};
/**
 * Extracts heredocs from a command string and replaces them with placeholders.
 *
 * This allows shell-quote to parse the command without mangling heredoc syntax.
 * After parsing, use `restoreHeredocs` to replace placeholders with original content.
 *
 * @param command - The shell command string potentially containing heredocs
 * @returns Object containing the processed command and a map of placeholders to heredoc info
 *
 * @example
 * ```ts
 * const result = extractHeredocs(`cat <<EOF
 * hello world
 * EOF`);
 * // result.processedCommand === "cat __HEREDOC_0_a1b2c3d4__" (salt varies)
 * // result.heredocs has the mapping to restore later
 * ```
 */
export declare function extractHeredocs(command: string, options?: {
    quotedOnly?: boolean;
}): HeredocExtractionResult;
/**
 * Restores heredoc placeholders in an array of strings.
 *
 * @param parts - Array of strings that may contain heredoc placeholders
 * @param heredocs - The map of placeholders from `extractHeredocs`
 * @returns New array with placeholders replaced by original heredoc content
 */
export declare function restoreHeredocs(parts: string[], heredocs: Map<string, HeredocInfo>): string[];
/**
 * Checks if a command contains heredoc syntax.
 *
 * This is a quick check that doesn't validate the heredoc is well-formed,
 * just that the pattern exists.
 *
 * @param command - The shell command string
 * @returns true if the command appears to contain heredoc syntax
 */
export declare function containsHeredoc(command: string): boolean;
//# sourceMappingURL=heredoc.d.ts.map