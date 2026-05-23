/**
 * Shared utilities for expanding environment variables in MCP server configurations
 */
/**
 * Expand environment variables in a string value
 * Handles ${VAR} and ${VAR:-default} syntax
 * @returns Object with expanded string and list of missing variables
 */
export declare function expandEnvVarsInString(value: string): {
    expanded: string;
    missingVars: string[];
};
//# sourceMappingURL=envExpansion.d.ts.map