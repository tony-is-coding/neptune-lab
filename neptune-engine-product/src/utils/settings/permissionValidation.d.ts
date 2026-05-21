import { z } from 'zod/v4';
/**
 * Validates permission rule format and content
 */
export declare function validatePermissionRule(rule: string): {
    valid: boolean;
    error?: string;
    suggestion?: string;
    examples?: string[];
};
/**
 * Custom Zod schema for permission rule arrays
 */
export declare const PermissionRuleSchema: () => z.ZodString;
//# sourceMappingURL=permissionValidation.d.ts.map