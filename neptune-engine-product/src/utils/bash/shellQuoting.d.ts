/**
 * Quotes a shell command appropriately, preserving heredocs and multiline strings
 * @param command The command to quote
 * @param addStdinRedirect Whether to add < /dev/null
 * @returns The properly quoted command
 */
export declare function quoteShellCommand(command: string, addStdinRedirect?: boolean): string;
/**
 * Detects if a command already has a stdin redirect
 * Match patterns like: < file, </path/to/file, < /dev/null, etc.
 * But not <<EOF (heredoc), << (bit shift), or <(process substitution)
 */
export declare function hasStdinRedirect(command: string): boolean;
/**
 * Checks if stdin redirect should be added to a command
 * @param command The command to check
 * @returns true if stdin redirect can be safely added
 */
export declare function shouldAddStdinRedirect(command: string): boolean;
export declare function rewriteWindowsNullRedirect(command: string): string;
//# sourceMappingURL=shellQuoting.d.ts.map