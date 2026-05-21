/**
 * Shared command prefix extraction using Haiku LLM
 *
 * This module provides a factory for creating command prefix extractors
 * that can be used by different shell tools. The core logic
 * (Haiku query, response validation) is shared, while tool-specific
 * aspects (examples, pre-checks) are configurable.
 */
import type { QuerySource } from '../../constants/querySource.js';
/**
 * Result of command prefix extraction
 */
export type CommandPrefixResult = {
    /** The detected command prefix, or null if no prefix could be determined */
    commandPrefix: string | null;
};
/**
 * Result including subcommand prefixes for compound commands
 */
export type CommandSubcommandPrefixResult = CommandPrefixResult & {
    subcommandPrefixes: Map<string, CommandPrefixResult>;
};
/**
 * Configuration for creating a command prefix extractor
 */
export type PrefixExtractorConfig = {
    /** Tool name for logging and warning messages */
    toolName: string;
    /** The policy spec containing examples for Haiku */
    policySpec: string;
    /** Analytics event name for logging */
    eventName: string;
    /** Query source identifier for the API call */
    querySource: QuerySource;
    /** Optional pre-check function that can short-circuit the Haiku call */
    preCheck?: (command: string) => CommandPrefixResult | null;
};
/**
 * Creates a memoized command prefix extractor function.
 *
 * Uses two-layer memoization: the outer memoized function creates the promise
 * and attaches a .catch handler that evicts the cache entry on rejection.
 * This prevents aborted or failed Haiku calls from poisoning future lookups.
 *
 * Bounded to 200 entries via LRU to prevent unbounded growth in heavy sessions.
 *
 * @param config - Configuration for the extractor
 * @returns A memoized async function that extracts command prefixes
 */
export declare function createCommandPrefixExtractor(config: PrefixExtractorConfig): {
    (command: string, abortSignal: AbortSignal, isNonInteractiveSession: boolean): Promise<CommandPrefixResult>;
    cache: {
        clear: () => void;
        size: () => number;
        delete: (key: string) => boolean;
        get: (key: string) => Promise<CommandPrefixResult>;
        has: (key: string) => boolean;
    };
};
/**
 * Creates a memoized function to get prefixes for compound commands with subcommands.
 *
 * Uses the same two-layer memoization pattern as createCommandPrefixExtractor:
 * a .catch handler evicts the cache entry on rejection to prevent poisoning.
 *
 * @param getPrefix - The single-command prefix extractor (from createCommandPrefixExtractor)
 * @param splitCommand - Function to split a compound command into subcommands
 * @returns A memoized async function that extracts prefixes for the main command and all subcommands
 */
export declare function createSubcommandPrefixExtractor(getPrefix: ReturnType<typeof createCommandPrefixExtractor>, splitCommand: (command: string) => string[] | Promise<string[]>): {
    (command: string, abortSignal: AbortSignal, isNonInteractiveSession: boolean): Promise<CommandSubcommandPrefixResult>;
    cache: {
        clear: () => void;
        size: () => number;
        delete: (key: string) => boolean;
        get: (key: string) => Promise<CommandSubcommandPrefixResult>;
        has: (key: string) => boolean;
    };
};
//# sourceMappingURL=prefix.d.ts.map