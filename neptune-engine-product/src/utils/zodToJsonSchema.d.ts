/**
 * Converts Zod v4 schemas to JSON Schema using native toJSONSchema.
 */
import { type ZodTypeAny } from 'zod/v4';
export type JsonSchema7Type = Record<string, unknown>;
/**
 * Converts a Zod v4 schema to JSON Schema format.
 */
export declare function zodToJsonSchema(schema: ZodTypeAny): JsonSchema7Type;
//# sourceMappingURL=zodToJsonSchema.d.ts.map