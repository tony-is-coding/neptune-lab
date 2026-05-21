/**
 * Shared command validation maps for shell tools (BashTool, PowerShellTool, etc.).
 *
 * Exports complete command configuration maps that any shell tool can import:
 * - GIT_READ_ONLY_COMMANDS: all git subcommands with safe flags and callbacks
 * - GH_READ_ONLY_COMMANDS: ant-only gh CLI commands (network-dependent)
 * - EXTERNAL_READONLY_COMMANDS: cross-shell commands that work in both bash and PowerShell
 * - containsVulnerableUncPath: UNC path detection for credential leak prevention
 * - outputLimits are in outputLimits.ts
 */
export type FlagArgType = 'none' | 'number' | 'string' | 'char' | '{}' | 'EOF';
export type ExternalCommandConfig = {
    safeFlags: Record<string, FlagArgType>;
    additionalCommandIsDangerousCallback?: (rawCommand: string, args: string[]) => boolean;
    respectsDoubleDash?: boolean;
};
export declare const GIT_READ_ONLY_COMMANDS: Record<string, ExternalCommandConfig>;
export declare const GH_READ_ONLY_COMMANDS: Record<string, ExternalCommandConfig>;
export declare const DOCKER_READ_ONLY_COMMANDS: Record<string, ExternalCommandConfig>;
export declare const RIPGREP_READ_ONLY_COMMANDS: Record<string, ExternalCommandConfig>;
export declare const PYRIGHT_READ_ONLY_COMMANDS: Record<string, ExternalCommandConfig>;
export declare const EXTERNAL_READONLY_COMMANDS: readonly string[];
/**
 * Check if a path or command contains a UNC path that could trigger network
 * requests (NTLM/Kerberos credential leakage, WebDAV attacks).
 *
 * This function detects:
 * - Basic UNC paths: \\server\share, \\foo.com\file
 * - WebDAV patterns: \\server@SSL@8443\, \\server@8443@SSL\, \\server\DavWWWRoot\
 * - IP-based UNC: \\192.168.1.1\share, \\[2001:db8::1]\share
 * - Forward-slash variants: //server/share
 *
 * @param pathOrCommand The path or command string to check
 * @returns true if the path/command contains potentially vulnerable UNC paths
 */
export declare function containsVulnerableUncPath(pathOrCommand: string): boolean;
export declare const FLAG_PATTERN: RegExp;
/**
 * Validates flag arguments based on their expected type
 */
export declare function validateFlagArgument(value: string, argType: FlagArgType): boolean;
/**
 * Validates the flags/arguments portion of a tokenized command against a config.
 * This is the flag-walking loop extracted from BashTool's isCommandSafeViaFlagParsing.
 *
 * @param tokens - Pre-tokenized args (from bash shell-quote or PowerShell AST)
 * @param startIndex - Where to start validating (after command tokens)
 * @param config - The safe flags config
 * @param options.commandName - For command-specific handling (git numeric shorthand, grep/rg attached numeric)
 * @param options.rawCommand - For additionalCommandIsDangerousCallback
 * @param options.xargsTargetCommands - If provided, enables xargs-style target command detection
 * @returns true if all flags are valid, false otherwise
 */
export declare function validateFlags(tokens: string[], startIndex: number, config: ExternalCommandConfig, options?: {
    commandName?: string;
    rawCommand?: string;
    xargsTargetCommands?: string[];
}): boolean;
//# sourceMappingURL=readOnlyCommandValidation.d.ts.map