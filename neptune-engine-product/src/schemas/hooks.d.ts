/**
 * Hook Zod schemas extracted to break import cycles.
 *
 * This file contains hook-related schema definitions that were originally
 * in src/utils/settings/types.ts. By extracting them here, we break the
 * circular dependency between settings/types.ts and plugins/schemas.ts.
 *
 * Both files now import from this shared location instead of each other.
 */
import { type HookEvent } from 'src/entrypoints/agentSdkTypes.js';
import { z } from 'zod/v4';
/**
 * Schema for hook command (excludes function hooks - they can't be persisted)
 */
export declare const HookCommandSchema: () => z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"command">;
    command: z.ZodString;
    if: z.ZodOptional<z.ZodString>;
    shell: z.ZodOptional<z.ZodEnum<{
        bash: "bash";
        powershell: "powershell";
    }>>;
    timeout: z.ZodOptional<z.ZodNumber>;
    statusMessage: z.ZodOptional<z.ZodString>;
    once: z.ZodOptional<z.ZodBoolean>;
    async: z.ZodOptional<z.ZodBoolean>;
    asyncRewake: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"prompt">;
    prompt: z.ZodString;
    if: z.ZodOptional<z.ZodString>;
    timeout: z.ZodOptional<z.ZodNumber>;
    model: z.ZodOptional<z.ZodString>;
    statusMessage: z.ZodOptional<z.ZodString>;
    once: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"agent">;
    prompt: z.ZodString;
    if: z.ZodOptional<z.ZodString>;
    timeout: z.ZodOptional<z.ZodNumber>;
    model: z.ZodOptional<z.ZodString>;
    statusMessage: z.ZodOptional<z.ZodString>;
    once: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"http">;
    url: z.ZodString;
    if: z.ZodOptional<z.ZodString>;
    timeout: z.ZodOptional<z.ZodNumber>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    allowedEnvVars: z.ZodOptional<z.ZodArray<z.ZodString>>;
    statusMessage: z.ZodOptional<z.ZodString>;
    once: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>], "type">;
/**
 * Schema for matcher configuration with multiple hooks
 */
export declare const HookMatcherSchema: () => z.ZodObject<{
    matcher: z.ZodOptional<z.ZodString>;
    hooks: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"command">;
        command: z.ZodString;
        if: z.ZodOptional<z.ZodString>;
        shell: z.ZodOptional<z.ZodEnum<{
            bash: "bash";
            powershell: "powershell";
        }>>;
        timeout: z.ZodOptional<z.ZodNumber>;
        statusMessage: z.ZodOptional<z.ZodString>;
        once: z.ZodOptional<z.ZodBoolean>;
        async: z.ZodOptional<z.ZodBoolean>;
        asyncRewake: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"prompt">;
        prompt: z.ZodString;
        if: z.ZodOptional<z.ZodString>;
        timeout: z.ZodOptional<z.ZodNumber>;
        model: z.ZodOptional<z.ZodString>;
        statusMessage: z.ZodOptional<z.ZodString>;
        once: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"agent">;
        prompt: z.ZodString;
        if: z.ZodOptional<z.ZodString>;
        timeout: z.ZodOptional<z.ZodNumber>;
        model: z.ZodOptional<z.ZodString>;
        statusMessage: z.ZodOptional<z.ZodString>;
        once: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"http">;
        url: z.ZodString;
        if: z.ZodOptional<z.ZodString>;
        timeout: z.ZodOptional<z.ZodNumber>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        allowedEnvVars: z.ZodOptional<z.ZodArray<z.ZodString>>;
        statusMessage: z.ZodOptional<z.ZodString>;
        once: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>], "type">>;
}, z.core.$strip>;
/**
 * Schema for hooks configuration
 * The key is the hook event. The value is an array of matcher configurations.
 * Uses partialRecord since not all hook events need to be defined.
 */
export declare const HooksSchema: () => z.ZodRecord<z.ZodEnum<{
    [x: string]: any;
}> & z.core.$partial, z.ZodArray<z.ZodObject<{
    matcher: z.ZodOptional<z.ZodString>;
    hooks: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"command">;
        command: z.ZodString;
        if: z.ZodOptional<z.ZodString>;
        shell: z.ZodOptional<z.ZodEnum<{
            bash: "bash";
            powershell: "powershell";
        }>>;
        timeout: z.ZodOptional<z.ZodNumber>;
        statusMessage: z.ZodOptional<z.ZodString>;
        once: z.ZodOptional<z.ZodBoolean>;
        async: z.ZodOptional<z.ZodBoolean>;
        asyncRewake: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"prompt">;
        prompt: z.ZodString;
        if: z.ZodOptional<z.ZodString>;
        timeout: z.ZodOptional<z.ZodNumber>;
        model: z.ZodOptional<z.ZodString>;
        statusMessage: z.ZodOptional<z.ZodString>;
        once: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"agent">;
        prompt: z.ZodString;
        if: z.ZodOptional<z.ZodString>;
        timeout: z.ZodOptional<z.ZodNumber>;
        model: z.ZodOptional<z.ZodString>;
        statusMessage: z.ZodOptional<z.ZodString>;
        once: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"http">;
        url: z.ZodString;
        if: z.ZodOptional<z.ZodString>;
        timeout: z.ZodOptional<z.ZodNumber>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        allowedEnvVars: z.ZodOptional<z.ZodArray<z.ZodString>>;
        statusMessage: z.ZodOptional<z.ZodString>;
        once: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>], "type">>;
}, z.core.$strip>>>;
export type HookCommand = z.infer<ReturnType<typeof HookCommandSchema>>;
export type BashCommandHook = Extract<HookCommand, {
    type: 'command';
}>;
export type PromptHook = Extract<HookCommand, {
    type: 'prompt';
}>;
export type AgentHook = Extract<HookCommand, {
    type: 'agent';
}>;
export type HttpHook = Extract<HookCommand, {
    type: 'http';
}>;
export type HookMatcher = z.infer<ReturnType<typeof HookMatcherSchema>>;
export type HooksSettings = Partial<Record<HookEvent, HookMatcher[]>>;
//# sourceMappingURL=hooks.d.ts.map