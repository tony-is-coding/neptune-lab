/**
 * Code editing tool identification for permission logging.
 * Extracted from CLI (hooks/toolPermission/permissionLogging) to eliminate framework→CLI dependency.
 */
export declare function isCodeEditingTool(toolName: string): boolean;
/**
 * Builds attributes for code editing tools, enriching with language info.
 */
export declare function buildCodeEditToolAttributes(tool: {
    getPath?: (input: unknown) => string | undefined;
    inputSchema: {
        safeParse: (input: unknown) => {
            success: boolean;
            data?: unknown;
        };
    };
}, input: unknown, decision: 'accept' | 'reject', source: string): Promise<Record<string, string>>;
//# sourceMappingURL=permissionLogging.d.ts.map