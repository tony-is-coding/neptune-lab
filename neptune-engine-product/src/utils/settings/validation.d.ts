import type { ConfigScope } from 'src/services/mcp/types.js';
import type { ZodError } from 'zod/v4';
import type { SettingsJson } from './types.js';
/** Field path in dot notation (e.g., "permissions.defaultMode", "env.DEBUG") */
export type FieldPath = string;
export type ValidationError = {
    /** Relative file path */
    file?: string;
    /** Field path in dot notation */
    path: FieldPath;
    /** Human-readable error message */
    message: string;
    /** Expected value or type */
    expected?: string;
    /** The actual invalid value that was provided */
    invalidValue?: unknown;
    /** Suggestion for fixing the error */
    suggestion?: string;
    /** Link to relevant documentation */
    docLink?: string;
    /** MCP-specific metadata - only present for MCP configuration errors */
    mcpErrorMetadata?: {
        /** Which configuration scope this error came from */
        scope: ConfigScope;
        /** The server name if error is specific to a server */
        serverName?: string;
        /** Severity of the error */
        severity?: 'fatal' | 'warning';
    };
};
export type SettingsWithErrors = {
    settings: SettingsJson;
    errors: ValidationError[];
};
export declare function formatZodError(error: ZodError, filePath: string): ValidationError[];
/**
 * Validates that settings file content conforms to the SettingsSchema.
 * This is used during file edits to ensure the resulting file is valid.
 */
export declare function validateSettingsFileContent(content: string): {
    isValid: true;
} | {
    isValid: false;
    error: string;
    fullSchema: string;
};
/**
 * Filters invalid permission rules from raw parsed JSON data before schema validation.
 * This prevents one bad rule from poisoning the entire settings file.
 * Returns warnings for each filtered rule.
 */
export declare function filterInvalidPermissionRules(data: unknown, filePath: string): ValidationError[];
//# sourceMappingURL=validation.d.ts.map