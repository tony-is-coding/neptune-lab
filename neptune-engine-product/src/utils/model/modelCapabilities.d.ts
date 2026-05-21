import { z } from 'zod/v4';
declare const ModelCapabilitySchema: () => z.ZodObject<{
    id: z.ZodString;
    max_input_tokens: z.ZodOptional<z.ZodNumber>;
    max_tokens: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type ModelCapability = z.infer<ReturnType<typeof ModelCapabilitySchema>>;
export declare function getModelCapability(model: string): ModelCapability | undefined;
export declare function refreshModelCapabilities(): Promise<void>;
export {};
//# sourceMappingURL=modelCapabilities.d.ts.map