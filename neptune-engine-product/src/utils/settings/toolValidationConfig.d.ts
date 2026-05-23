/**
 * Tool validation configuration
 *
 * Most tools need NO configuration - basic validation works automatically.
 * Only add your tool here if it has special pattern requirements.
 */
export type ToolValidationConfig = {
    /** Tools that accept file glob patterns (e.g., *.ts, src/**) */
    filePatternTools: string[];
    /** Tools that accept bash wildcard patterns (* anywhere) and legacy :* prefix syntax */
    bashPrefixTools: string[];
    /** Custom validation rules for specific tools */
    customValidation: {
        [toolName: string]: (content: string) => {
            valid: boolean;
            error?: string;
            suggestion?: string;
            examples?: string[];
        };
    };
};
export declare const TOOL_VALIDATION_CONFIG: ToolValidationConfig;
export declare function isFilePatternTool(toolName: string): boolean;
export declare function isBashPrefixTool(toolName: string): boolean;
export declare function getCustomValidation(toolName: string): (content: string) => {
    valid: boolean;
    error?: string;
    suggestion?: string;
    examples?: string[];
};
//# sourceMappingURL=toolValidationConfig.d.ts.map