import type { ZodError } from 'zod/v4';
export declare function formatError(error: unknown): string;
export declare function getErrorParts(error: Error): string[];
/**
 * Converts Zod validation errors into a human-readable and LLM friendly error message
 *
 * @param toolName The name of the tool that failed validation
 * @param error The Zod error object
 * @returns A formatted error message string
 */
export declare function formatZodValidationError(toolName: string, error: ZodError): string;
//# sourceMappingURL=toolErrors.d.ts.map