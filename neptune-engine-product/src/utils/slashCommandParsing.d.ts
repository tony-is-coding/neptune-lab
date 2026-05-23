/**
 * Centralized utilities for parsing slash commands
 */
export type ParsedSlashCommand = {
    commandName: string;
    args: string;
    isMcp: boolean;
};
/**
 * Parses a slash command input string into its component parts
 *
 * @param input - The raw input string (should start with '/')
 * @returns Parsed command name, args, and MCP flag, or null if invalid
 *
 * @example
 * parseSlashCommand('/search foo bar')
 * // => { commandName: 'search', args: 'foo bar', isMcp: false }
 *
 * @example
 * parseSlashCommand('/mcp:tool (MCP) arg1 arg2')
 * // => { commandName: 'mcp:tool (MCP)', args: 'arg1 arg2', isMcp: true }
 */
export declare function parseSlashCommand(input: string): ParsedSlashCommand | null;
//# sourceMappingURL=slashCommandParsing.d.ts.map