import type { Tool, ToolUseContext } from 'src/Tool.js';
import z from 'zod/v4';
import type { PermissionDecision } from './PermissionResult.js';
export declare const inputSchema: () => z.ZodObject<{
    tool_name: z.ZodString;
    input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    tool_use_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Input = z.infer<ReturnType<typeof inputSchema>>;
export declare const outputSchema: () => z.ZodUnion<readonly [z.ZodObject<{
    behavior: z.ZodLiteral<"allow">;
    updatedInput: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    updatedPermissions: z.ZodCatch<z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"addRules">;
        rules: z.ZodArray<z.ZodObject<{
            toolName: z.ZodString;
            ruleContent: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        behavior: z.ZodEnum<{
            deny: "deny";
            allow: "allow";
            ask: "ask";
        }>;
        destination: z.ZodEnum<{
            userSettings: "userSettings";
            projectSettings: "projectSettings";
            localSettings: "localSettings";
            cliArg: "cliArg";
            session: "session";
        }>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"replaceRules">;
        rules: z.ZodArray<z.ZodObject<{
            toolName: z.ZodString;
            ruleContent: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        behavior: z.ZodEnum<{
            deny: "deny";
            allow: "allow";
            ask: "ask";
        }>;
        destination: z.ZodEnum<{
            userSettings: "userSettings";
            projectSettings: "projectSettings";
            localSettings: "localSettings";
            cliArg: "cliArg";
            session: "session";
        }>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"removeRules">;
        rules: z.ZodArray<z.ZodObject<{
            toolName: z.ZodString;
            ruleContent: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        behavior: z.ZodEnum<{
            deny: "deny";
            allow: "allow";
            ask: "ask";
        }>;
        destination: z.ZodEnum<{
            userSettings: "userSettings";
            projectSettings: "projectSettings";
            localSettings: "localSettings";
            cliArg: "cliArg";
            session: "session";
        }>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"setMode">;
        mode: z.ZodEnum<{
            plan: "plan";
            default: "default";
            acceptEdits: "acceptEdits";
            bypassPermissions: "bypassPermissions";
            dontAsk: "dontAsk";
        }>;
        destination: z.ZodEnum<{
            userSettings: "userSettings";
            projectSettings: "projectSettings";
            localSettings: "localSettings";
            cliArg: "cliArg";
            session: "session";
        }>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"addDirectories">;
        directories: z.ZodArray<z.ZodString>;
        destination: z.ZodEnum<{
            userSettings: "userSettings";
            projectSettings: "projectSettings";
            localSettings: "localSettings";
            cliArg: "cliArg";
            session: "session";
        }>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"removeDirectories">;
        directories: z.ZodArray<z.ZodString>;
        destination: z.ZodEnum<{
            userSettings: "userSettings";
            projectSettings: "projectSettings";
            localSettings: "localSettings";
            cliArg: "cliArg";
            session: "session";
        }>;
    }, z.core.$strip>], "type">>>>;
    toolUseID: z.ZodOptional<z.ZodString>;
    decisionClassification: z.ZodCatch<z.ZodOptional<z.ZodEnum<{
        user_temporary: "user_temporary";
        user_permanent: "user_permanent";
        user_reject: "user_reject";
    }>>>;
}, z.core.$strip>, z.ZodObject<{
    behavior: z.ZodLiteral<"deny">;
    message: z.ZodString;
    interrupt: z.ZodOptional<z.ZodBoolean>;
    toolUseID: z.ZodOptional<z.ZodString>;
    decisionClassification: z.ZodCatch<z.ZodOptional<z.ZodEnum<{
        user_temporary: "user_temporary";
        user_permanent: "user_permanent";
        user_reject: "user_reject";
    }>>>;
}, z.core.$strip>]>;
export type Output = z.infer<ReturnType<typeof outputSchema>>;
/**
 * Normalizes the result of a permission prompt tool to a PermissionDecision.
 */
export declare function permissionPromptToolResultToPermissionDecision(result: Output, tool: Tool, input: {
    [key: string]: unknown;
}, toolUseContext: ToolUseContext): PermissionDecision;
//# sourceMappingURL=PermissionPromptToolResultSchema.d.ts.map