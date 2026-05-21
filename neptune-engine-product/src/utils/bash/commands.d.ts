import { type CommandPrefixResult, type CommandSubcommandPrefixResult } from '../shell/prefix.js';
export type { CommandPrefixResult, CommandSubcommandPrefixResult };
export declare function splitCommandWithOperators(command: string): string[];
export declare function filterControlOperators(commandsAndOperators: string[]): string[];
/**
 * @deprecated Legacy regex/shell-quote path. Only used when tree-sitter is
 * unavailable. The primary gate is parseForSecurity (ast.ts).
 *
 * Splits a command string into individual commands based on shell operators
 */
export declare function splitCommand_DEPRECATED(command: string): string[];
/**
 * Checks if a command is a help command (e.g., "foo --help" or "foo bar --help")
 * and should be allowed as-is without going through prefix extraction.
 *
 * We bypass Haiku prefix extraction for simple --help commands because:
 * 1. Help commands are read-only and safe
 * 2. We want to allow the full command (e.g., "python --help"), not a prefix
 *    that would be too broad (e.g., "python:*")
 * 3. This saves API calls and improves performance for common help queries
 *
 * Returns true if:
 * - Command ends with --help
 * - Command contains no other flags
 * - All non-flag tokens are simple alphanumeric identifiers (no paths, special chars, etc.)
 *
 * @returns true if it's a help command, false otherwise
 */
export declare function isHelpCommand(command: string): boolean;
export declare const getCommandSubcommandPrefix: {
    (command: string, abortSignal: AbortSignal, isNonInteractiveSession: boolean): Promise<CommandSubcommandPrefixResult>;
    cache: {
        clear: () => void;
        size: () => number;
        delete: (key: string) => boolean;
        get: (key: string) => Promise<CommandSubcommandPrefixResult>;
        has: (key: string) => boolean;
    };
};
/**
 * Clear both command prefix caches. Called on /clear to release memory.
 */
export declare function clearCommandPrefixCaches(): void;
/**
 * @deprecated Legacy regex/shell-quote path. Only used when tree-sitter is
 * unavailable. The primary gate is parseForSecurity (ast.ts).
 */
export declare function isUnsafeCompoundCommand_DEPRECATED(command: string): boolean;
/**
 * Extracts output redirections from a command if present.
 * Only handles simple string targets (no variables or command substitutions).
 *
 * TODO(inigo): Refactor and simplify once we have AST parsing
 *
 * @returns Object containing the command without redirections and the target paths if found
 */
export declare function extractOutputRedirections(cmd: string): {
    commandWithoutRedirections: string;
    redirections: Array<{
        target: string;
        operator: '>' | '>>';
    }>;
    hasDangerousRedirection: boolean;
};
//# sourceMappingURL=commands.d.ts.map