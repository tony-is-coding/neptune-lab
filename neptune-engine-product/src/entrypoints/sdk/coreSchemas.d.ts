/**
 * SDK Core Schemas - Zod schemas for serializable SDK data types.
 *
 * These schemas are the single source of truth for SDK data types.
 * TypeScript types are generated from these schemas and committed for IDE support.
 *
 * @see scripts/generate-sdk-types.ts for type generation
 */
import { z } from 'zod/v4';
export declare const ModelUsageSchema: () => z.ZodObject<{
    inputTokens: z.ZodNumber;
    outputTokens: z.ZodNumber;
    cacheReadInputTokens: z.ZodNumber;
    cacheCreationInputTokens: z.ZodNumber;
    webSearchRequests: z.ZodNumber;
    costUSD: z.ZodNumber;
    contextWindow: z.ZodNumber;
    maxOutputTokens: z.ZodNumber;
}, z.core.$strip>;
export declare const OutputFormatTypeSchema: () => z.ZodLiteral<"json_schema">;
export declare const BaseOutputFormatSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"json_schema">;
}, z.core.$strip>;
export declare const JsonSchemaOutputFormatSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"json_schema">;
    schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export declare const OutputFormatSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"json_schema">;
    schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export declare const ApiKeySourceSchema: () => z.ZodEnum<{
    user: "user";
    project: "project";
    oauth: "oauth";
    org: "org";
    temporary: "temporary";
}>;
export declare const ConfigScopeSchema: () => z.ZodEnum<{
    local: "local";
    user: "user";
    project: "project";
}>;
export declare const SdkBetaSchema: () => z.ZodLiteral<"context-1m-2025-08-07">;
export declare const ThinkingAdaptiveSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"adaptive">;
}, z.core.$strip>;
export declare const ThinkingEnabledSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"enabled">;
    budgetTokens: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const ThinkingDisabledSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"disabled">;
}, z.core.$strip>;
export declare const ThinkingConfigSchema: () => z.ZodUnion<readonly [z.ZodObject<{
    type: z.ZodLiteral<"adaptive">;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"enabled">;
    budgetTokens: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"disabled">;
}, z.core.$strip>]>;
export declare const McpStdioServerConfigSchema: () => z.ZodObject<{
    type: z.ZodOptional<z.ZodLiteral<"stdio">>;
    command: z.ZodString;
    args: z.ZodOptional<z.ZodArray<z.ZodString>>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export declare const McpSSEServerConfigSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"sse">;
    url: z.ZodString;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export declare const McpHttpServerConfigSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"http">;
    url: z.ZodString;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export declare const McpSdkServerConfigSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"sdk">;
    name: z.ZodString;
}, z.core.$strip>;
export declare const McpServerConfigForProcessTransportSchema: () => z.ZodUnion<readonly [z.ZodObject<{
    type: z.ZodOptional<z.ZodLiteral<"stdio">>;
    command: z.ZodString;
    args: z.ZodOptional<z.ZodArray<z.ZodString>>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"sse">;
    url: z.ZodString;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"http">;
    url: z.ZodString;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"sdk">;
    name: z.ZodString;
}, z.core.$strip>]>;
export declare const McpClaudeAIProxyServerConfigSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"claudeai-proxy">;
    url: z.ZodString;
    id: z.ZodString;
}, z.core.$strip>;
export declare const McpServerStatusConfigSchema: () => z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodObject<{
    type: z.ZodOptional<z.ZodLiteral<"stdio">>;
    command: z.ZodString;
    args: z.ZodOptional<z.ZodArray<z.ZodString>>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"sse">;
    url: z.ZodString;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"http">;
    url: z.ZodString;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"sdk">;
    name: z.ZodString;
}, z.core.$strip>]>, z.ZodObject<{
    type: z.ZodLiteral<"claudeai-proxy">;
    url: z.ZodString;
    id: z.ZodString;
}, z.core.$strip>]>;
export declare const McpServerStatusSchema: () => z.ZodObject<{
    name: z.ZodString;
    status: z.ZodEnum<{
        connected: "connected";
        pending: "pending";
        disabled: "disabled";
        failed: "failed";
        "needs-auth": "needs-auth";
    }>;
    serverInfo: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        version: z.ZodString;
    }, z.core.$strip>>;
    error: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodObject<{
        type: z.ZodOptional<z.ZodLiteral<"stdio">>;
        command: z.ZodString;
        args: z.ZodOptional<z.ZodArray<z.ZodString>>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sse">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"http">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sdk">;
        name: z.ZodString;
    }, z.core.$strip>]>, z.ZodObject<{
        type: z.ZodLiteral<"claudeai-proxy">;
        url: z.ZodString;
        id: z.ZodString;
    }, z.core.$strip>]>>;
    scope: z.ZodOptional<z.ZodString>;
    tools: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        annotations: z.ZodOptional<z.ZodObject<{
            readOnly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            openWorld: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
    capabilities: z.ZodOptional<z.ZodObject<{
        experimental: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const McpSetServersResultSchema: () => z.ZodObject<{
    added: z.ZodArray<z.ZodString>;
    removed: z.ZodArray<z.ZodString>;
    errors: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strip>;
export declare const PermissionUpdateDestinationSchema: () => z.ZodEnum<{
    userSettings: "userSettings";
    projectSettings: "projectSettings";
    localSettings: "localSettings";
    cliArg: "cliArg";
    session: "session";
}>;
export declare const PermissionBehaviorSchema: () => z.ZodEnum<{
    deny: "deny";
    allow: "allow";
    ask: "ask";
}>;
export declare const PermissionRuleValueSchema: () => z.ZodObject<{
    toolName: z.ZodString;
    ruleContent: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const PermissionUpdateSchema: () => z.ZodDiscriminatedUnion<[z.ZodObject<{
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
    mode: z.ZodLazy<z.ZodEnum<{
        plan: "plan";
        auto: "auto";
        default: "default";
        acceptEdits: "acceptEdits";
        bypassPermissions: "bypassPermissions";
        dontAsk: "dontAsk";
    }>>;
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
}, z.core.$strip>], "type">;
export declare const PermissionDecisionClassificationSchema: () => z.ZodEnum<{
    user_temporary: "user_temporary";
    user_permanent: "user_permanent";
    user_reject: "user_reject";
}>;
export declare const PermissionResultSchema: () => z.ZodUnion<readonly [z.ZodObject<{
    behavior: z.ZodLiteral<"allow">;
    updatedInput: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    updatedPermissions: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
        mode: z.ZodLazy<z.ZodEnum<{
            plan: "plan";
            auto: "auto";
            default: "default";
            acceptEdits: "acceptEdits";
            bypassPermissions: "bypassPermissions";
            dontAsk: "dontAsk";
        }>>;
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
    }, z.core.$strip>], "type">>>;
    toolUseID: z.ZodOptional<z.ZodString>;
    decisionClassification: z.ZodOptional<z.ZodEnum<{
        user_temporary: "user_temporary";
        user_permanent: "user_permanent";
        user_reject: "user_reject";
    }>>;
}, z.core.$strip>, z.ZodObject<{
    behavior: z.ZodLiteral<"deny">;
    message: z.ZodString;
    interrupt: z.ZodOptional<z.ZodBoolean>;
    toolUseID: z.ZodOptional<z.ZodString>;
    decisionClassification: z.ZodOptional<z.ZodEnum<{
        user_temporary: "user_temporary";
        user_permanent: "user_permanent";
        user_reject: "user_reject";
    }>>;
}, z.core.$strip>]>;
export declare const PermissionModeSchema: () => z.ZodEnum<{
    plan: "plan";
    auto: "auto";
    default: "default";
    acceptEdits: "acceptEdits";
    bypassPermissions: "bypassPermissions";
    dontAsk: "dontAsk";
}>;
export declare const HOOK_EVENTS: readonly ["PreToolUse", "PostToolUse", "PostToolUseFailure", "Notification", "UserPromptSubmit", "SessionStart", "SessionEnd", "Stop", "StopFailure", "SubagentStart", "SubagentStop", "PreCompact", "PostCompact", "PermissionRequest", "PermissionDenied", "Setup", "TeammateIdle", "TaskCreated", "TaskCompleted", "Elicitation", "ElicitationResult", "ConfigChange", "WorktreeCreate", "WorktreeRemove", "InstructionsLoaded", "CwdChanged", "FileChanged"];
export declare const HookEventSchema: () => z.ZodEnum<{
    SubagentStart: "SubagentStart";
    PermissionRequest: "PermissionRequest";
    PreToolUse: "PreToolUse";
    PostToolUse: "PostToolUse";
    PostToolUseFailure: "PostToolUseFailure";
    Notification: "Notification";
    UserPromptSubmit: "UserPromptSubmit";
    SessionStart: "SessionStart";
    SessionEnd: "SessionEnd";
    Stop: "Stop";
    StopFailure: "StopFailure";
    SubagentStop: "SubagentStop";
    PreCompact: "PreCompact";
    PostCompact: "PostCompact";
    PermissionDenied: "PermissionDenied";
    Setup: "Setup";
    TeammateIdle: "TeammateIdle";
    TaskCreated: "TaskCreated";
    TaskCompleted: "TaskCompleted";
    Elicitation: "Elicitation";
    ElicitationResult: "ElicitationResult";
    ConfigChange: "ConfigChange";
    WorktreeCreate: "WorktreeCreate";
    WorktreeRemove: "WorktreeRemove";
    InstructionsLoaded: "InstructionsLoaded";
    CwdChanged: "CwdChanged";
    FileChanged: "FileChanged";
}>;
export declare const BaseHookInputSchema: () => z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const PreToolUseHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"PreToolUse">;
    tool_name: z.ZodString;
    tool_input: z.ZodUnknown;
    tool_use_id: z.ZodString;
}, z.core.$strip>>;
export declare const PermissionRequestHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"PermissionRequest">;
    tool_name: z.ZodString;
    tool_input: z.ZodUnknown;
    permission_suggestions: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
        mode: z.ZodLazy<z.ZodEnum<{
            plan: "plan";
            auto: "auto";
            default: "default";
            acceptEdits: "acceptEdits";
            bypassPermissions: "bypassPermissions";
            dontAsk: "dontAsk";
        }>>;
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
    }, z.core.$strip>], "type">>>;
}, z.core.$strip>>;
export declare const PostToolUseHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"PostToolUse">;
    tool_name: z.ZodString;
    tool_input: z.ZodUnknown;
    tool_response: z.ZodUnknown;
    tool_use_id: z.ZodString;
}, z.core.$strip>>;
export declare const PostToolUseFailureHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"PostToolUseFailure">;
    tool_name: z.ZodString;
    tool_input: z.ZodUnknown;
    tool_use_id: z.ZodString;
    error: z.ZodString;
    is_interrupt: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>>;
export declare const PermissionDeniedHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"PermissionDenied">;
    tool_name: z.ZodString;
    tool_input: z.ZodUnknown;
    tool_use_id: z.ZodString;
    reason: z.ZodString;
}, z.core.$strip>>;
export declare const NotificationHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"Notification">;
    message: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    notification_type: z.ZodString;
}, z.core.$strip>>;
export declare const UserPromptSubmitHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"UserPromptSubmit">;
    prompt: z.ZodString;
}, z.core.$strip>>;
export declare const SessionStartHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"SessionStart">;
    source: z.ZodEnum<{
        resume: "resume";
        clear: "clear";
        compact: "compact";
        startup: "startup";
    }>;
    agent_type: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare const SetupHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"Setup">;
    trigger: z.ZodEnum<{
        init: "init";
        maintenance: "maintenance";
    }>;
}, z.core.$strip>>;
export declare const StopHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"Stop">;
    stop_hook_active: z.ZodBoolean;
    last_assistant_message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare const StopFailureHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"StopFailure">;
    error: z.ZodEnum<{
        unknown: "unknown";
        rate_limit: "rate_limit";
        invalid_request: "invalid_request";
        billing_error: "billing_error";
        authentication_failed: "authentication_failed";
        server_error: "server_error";
        max_output_tokens: "max_output_tokens";
    }>;
    error_details: z.ZodOptional<z.ZodString>;
    last_assistant_message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare const SubagentStartHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"SubagentStart">;
    agent_id: z.ZodString;
    agent_type: z.ZodString;
}, z.core.$strip>>;
export declare const SubagentStopHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"SubagentStop">;
    stop_hook_active: z.ZodBoolean;
    agent_id: z.ZodString;
    agent_transcript_path: z.ZodString;
    agent_type: z.ZodString;
    last_assistant_message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare const PreCompactHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"PreCompact">;
    trigger: z.ZodEnum<{
        auto: "auto";
        manual: "manual";
    }>;
    custom_instructions: z.ZodNullable<z.ZodString>;
}, z.core.$strip>>;
export declare const PostCompactHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"PostCompact">;
    trigger: z.ZodEnum<{
        auto: "auto";
        manual: "manual";
    }>;
    compact_summary: z.ZodString;
}, z.core.$strip>>;
export declare const TeammateIdleHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"TeammateIdle">;
    teammate_name: z.ZodString;
    team_name: z.ZodString;
}, z.core.$strip>>;
export declare const TaskCreatedHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"TaskCreated">;
    task_id: z.ZodString;
    task_subject: z.ZodString;
    task_description: z.ZodOptional<z.ZodString>;
    teammate_name: z.ZodOptional<z.ZodString>;
    team_name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare const TaskCompletedHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"TaskCompleted">;
    task_id: z.ZodString;
    task_subject: z.ZodString;
    task_description: z.ZodOptional<z.ZodString>;
    teammate_name: z.ZodOptional<z.ZodString>;
    team_name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare const ElicitationHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"Elicitation">;
    mcp_server_name: z.ZodString;
    message: z.ZodString;
    mode: z.ZodOptional<z.ZodEnum<{
        url: "url";
        form: "form";
    }>>;
    url: z.ZodOptional<z.ZodString>;
    elicitation_id: z.ZodOptional<z.ZodString>;
    requested_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>>;
export declare const ElicitationResultHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"ElicitationResult">;
    mcp_server_name: z.ZodString;
    elicitation_id: z.ZodOptional<z.ZodString>;
    mode: z.ZodOptional<z.ZodEnum<{
        url: "url";
        form: "form";
    }>>;
    action: z.ZodEnum<{
        cancel: "cancel";
        accept: "accept";
        decline: "decline";
    }>;
    content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>>;
export declare const CONFIG_CHANGE_SOURCES: readonly ["user_settings", "project_settings", "local_settings", "policy_settings", "skills"];
export declare const ConfigChangeHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"ConfigChange">;
    source: z.ZodEnum<{
        skills: "skills";
        user_settings: "user_settings";
        project_settings: "project_settings";
        local_settings: "local_settings";
        policy_settings: "policy_settings";
    }>;
    file_path: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare const INSTRUCTIONS_LOAD_REASONS: readonly ["session_start", "nested_traversal", "path_glob_match", "include", "compact"];
export declare const INSTRUCTIONS_MEMORY_TYPES: readonly ["User", "Project", "Local", "Managed"];
export declare const InstructionsLoadedHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"InstructionsLoaded">;
    file_path: z.ZodString;
    memory_type: z.ZodEnum<{
        User: "User";
        Project: "Project";
        Local: "Local";
        Managed: "Managed";
    }>;
    load_reason: z.ZodEnum<{
        compact: "compact";
        session_start: "session_start";
        nested_traversal: "nested_traversal";
        path_glob_match: "path_glob_match";
        include: "include";
    }>;
    globs: z.ZodOptional<z.ZodArray<z.ZodString>>;
    trigger_file_path: z.ZodOptional<z.ZodString>;
    parent_file_path: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare const WorktreeCreateHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"WorktreeCreate">;
    name: z.ZodString;
}, z.core.$strip>>;
export declare const WorktreeRemoveHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"WorktreeRemove">;
    worktree_path: z.ZodString;
}, z.core.$strip>>;
export declare const CwdChangedHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"CwdChanged">;
    old_cwd: z.ZodString;
    new_cwd: z.ZodString;
}, z.core.$strip>>;
export declare const FileChangedHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"FileChanged">;
    file_path: z.ZodString;
    event: z.ZodEnum<{
        add: "add";
        unlink: "unlink";
        change: "change";
    }>;
}, z.core.$strip>>;
export declare const EXIT_REASONS: readonly ["clear", "resume", "logout", "prompt_input_exit", "other", "bypass_permissions_disabled"];
export declare const ExitReasonSchema: () => z.ZodEnum<{
    other: "other";
    resume: "resume";
    clear: "clear";
    logout: "logout";
    prompt_input_exit: "prompt_input_exit";
    bypass_permissions_disabled: "bypass_permissions_disabled";
}>;
export declare const SessionEndHookInputSchema: () => z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"SessionEnd">;
    reason: z.ZodEnum<{
        other: "other";
        resume: "resume";
        clear: "clear";
        logout: "logout";
        prompt_input_exit: "prompt_input_exit";
        bypass_permissions_disabled: "bypass_permissions_disabled";
    }>;
}, z.core.$strip>>;
export declare const HookInputSchema: () => z.ZodUnion<readonly [z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"PreToolUse">;
    tool_name: z.ZodString;
    tool_input: z.ZodUnknown;
    tool_use_id: z.ZodString;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"PostToolUse">;
    tool_name: z.ZodString;
    tool_input: z.ZodUnknown;
    tool_response: z.ZodUnknown;
    tool_use_id: z.ZodString;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"PostToolUseFailure">;
    tool_name: z.ZodString;
    tool_input: z.ZodUnknown;
    tool_use_id: z.ZodString;
    error: z.ZodString;
    is_interrupt: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"PermissionDenied">;
    tool_name: z.ZodString;
    tool_input: z.ZodUnknown;
    tool_use_id: z.ZodString;
    reason: z.ZodString;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"Notification">;
    message: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    notification_type: z.ZodString;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"UserPromptSubmit">;
    prompt: z.ZodString;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"SessionStart">;
    source: z.ZodEnum<{
        resume: "resume";
        clear: "clear";
        compact: "compact";
        startup: "startup";
    }>;
    agent_type: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"SessionEnd">;
    reason: z.ZodEnum<{
        other: "other";
        resume: "resume";
        clear: "clear";
        logout: "logout";
        prompt_input_exit: "prompt_input_exit";
        bypass_permissions_disabled: "bypass_permissions_disabled";
    }>;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"Stop">;
    stop_hook_active: z.ZodBoolean;
    last_assistant_message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"StopFailure">;
    error: z.ZodEnum<{
        unknown: "unknown";
        rate_limit: "rate_limit";
        invalid_request: "invalid_request";
        billing_error: "billing_error";
        authentication_failed: "authentication_failed";
        server_error: "server_error";
        max_output_tokens: "max_output_tokens";
    }>;
    error_details: z.ZodOptional<z.ZodString>;
    last_assistant_message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"SubagentStart">;
    agent_id: z.ZodString;
    agent_type: z.ZodString;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"SubagentStop">;
    stop_hook_active: z.ZodBoolean;
    agent_id: z.ZodString;
    agent_transcript_path: z.ZodString;
    agent_type: z.ZodString;
    last_assistant_message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"PreCompact">;
    trigger: z.ZodEnum<{
        auto: "auto";
        manual: "manual";
    }>;
    custom_instructions: z.ZodNullable<z.ZodString>;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"PostCompact">;
    trigger: z.ZodEnum<{
        auto: "auto";
        manual: "manual";
    }>;
    compact_summary: z.ZodString;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"PermissionRequest">;
    tool_name: z.ZodString;
    tool_input: z.ZodUnknown;
    permission_suggestions: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
        mode: z.ZodLazy<z.ZodEnum<{
            plan: "plan";
            auto: "auto";
            default: "default";
            acceptEdits: "acceptEdits";
            bypassPermissions: "bypassPermissions";
            dontAsk: "dontAsk";
        }>>;
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
    }, z.core.$strip>], "type">>>;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"Setup">;
    trigger: z.ZodEnum<{
        init: "init";
        maintenance: "maintenance";
    }>;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"TeammateIdle">;
    teammate_name: z.ZodString;
    team_name: z.ZodString;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"TaskCreated">;
    task_id: z.ZodString;
    task_subject: z.ZodString;
    task_description: z.ZodOptional<z.ZodString>;
    teammate_name: z.ZodOptional<z.ZodString>;
    team_name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"TaskCompleted">;
    task_id: z.ZodString;
    task_subject: z.ZodString;
    task_description: z.ZodOptional<z.ZodString>;
    teammate_name: z.ZodOptional<z.ZodString>;
    team_name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"Elicitation">;
    mcp_server_name: z.ZodString;
    message: z.ZodString;
    mode: z.ZodOptional<z.ZodEnum<{
        url: "url";
        form: "form";
    }>>;
    url: z.ZodOptional<z.ZodString>;
    elicitation_id: z.ZodOptional<z.ZodString>;
    requested_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"ElicitationResult">;
    mcp_server_name: z.ZodString;
    elicitation_id: z.ZodOptional<z.ZodString>;
    mode: z.ZodOptional<z.ZodEnum<{
        url: "url";
        form: "form";
    }>>;
    action: z.ZodEnum<{
        cancel: "cancel";
        accept: "accept";
        decline: "decline";
    }>;
    content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"ConfigChange">;
    source: z.ZodEnum<{
        skills: "skills";
        user_settings: "user_settings";
        project_settings: "project_settings";
        local_settings: "local_settings";
        policy_settings: "policy_settings";
    }>;
    file_path: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"InstructionsLoaded">;
    file_path: z.ZodString;
    memory_type: z.ZodEnum<{
        User: "User";
        Project: "Project";
        Local: "Local";
        Managed: "Managed";
    }>;
    load_reason: z.ZodEnum<{
        compact: "compact";
        session_start: "session_start";
        nested_traversal: "nested_traversal";
        path_glob_match: "path_glob_match";
        include: "include";
    }>;
    globs: z.ZodOptional<z.ZodArray<z.ZodString>>;
    trigger_file_path: z.ZodOptional<z.ZodString>;
    parent_file_path: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"WorktreeCreate">;
    name: z.ZodString;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"WorktreeRemove">;
    worktree_path: z.ZodString;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"CwdChanged">;
    old_cwd: z.ZodString;
    new_cwd: z.ZodString;
}, z.core.$strip>>, z.ZodIntersection<z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodString;
    cwd: z.ZodString;
    permission_mode: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    agent_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    hook_event_name: z.ZodLiteral<"FileChanged">;
    file_path: z.ZodString;
    event: z.ZodEnum<{
        add: "add";
        unlink: "unlink";
        change: "change";
    }>;
}, z.core.$strip>>]>;
export declare const AsyncHookJSONOutputSchema: () => z.ZodObject<{
    async: z.ZodLiteral<true>;
    asyncTimeout: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const PreToolUseHookSpecificOutputSchema: () => z.ZodObject<{
    hookEventName: z.ZodLiteral<"PreToolUse">;
    permissionDecision: z.ZodOptional<z.ZodEnum<{
        deny: "deny";
        allow: "allow";
        ask: "ask";
    }>>;
    permissionDecisionReason: z.ZodOptional<z.ZodString>;
    updatedInput: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    additionalContext: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const UserPromptSubmitHookSpecificOutputSchema: () => z.ZodObject<{
    hookEventName: z.ZodLiteral<"UserPromptSubmit">;
    additionalContext: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const SessionStartHookSpecificOutputSchema: () => z.ZodObject<{
    hookEventName: z.ZodLiteral<"SessionStart">;
    additionalContext: z.ZodOptional<z.ZodString>;
    initialUserMessage: z.ZodOptional<z.ZodString>;
    watchPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const SetupHookSpecificOutputSchema: () => z.ZodObject<{
    hookEventName: z.ZodLiteral<"Setup">;
    additionalContext: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const SubagentStartHookSpecificOutputSchema: () => z.ZodObject<{
    hookEventName: z.ZodLiteral<"SubagentStart">;
    additionalContext: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const PostToolUseHookSpecificOutputSchema: () => z.ZodObject<{
    hookEventName: z.ZodLiteral<"PostToolUse">;
    additionalContext: z.ZodOptional<z.ZodString>;
    updatedMCPToolOutput: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export declare const PostToolUseFailureHookSpecificOutputSchema: () => z.ZodObject<{
    hookEventName: z.ZodLiteral<"PostToolUseFailure">;
    additionalContext: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const PermissionDeniedHookSpecificOutputSchema: () => z.ZodObject<{
    hookEventName: z.ZodLiteral<"PermissionDenied">;
    retry: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const NotificationHookSpecificOutputSchema: () => z.ZodObject<{
    hookEventName: z.ZodLiteral<"Notification">;
    additionalContext: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const PermissionRequestHookSpecificOutputSchema: () => z.ZodObject<{
    hookEventName: z.ZodLiteral<"PermissionRequest">;
    decision: z.ZodUnion<readonly [z.ZodObject<{
        behavior: z.ZodLiteral<"allow">;
        updatedInput: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        updatedPermissions: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            mode: z.ZodLazy<z.ZodEnum<{
                plan: "plan";
                auto: "auto";
                default: "default";
                acceptEdits: "acceptEdits";
                bypassPermissions: "bypassPermissions";
                dontAsk: "dontAsk";
            }>>;
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
        }, z.core.$strip>], "type">>>;
    }, z.core.$strip>, z.ZodObject<{
        behavior: z.ZodLiteral<"deny">;
        message: z.ZodOptional<z.ZodString>;
        interrupt: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>]>;
}, z.core.$strip>;
export declare const CwdChangedHookSpecificOutputSchema: () => z.ZodObject<{
    hookEventName: z.ZodLiteral<"CwdChanged">;
    watchPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const FileChangedHookSpecificOutputSchema: () => z.ZodObject<{
    hookEventName: z.ZodLiteral<"FileChanged">;
    watchPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const SyncHookJSONOutputSchema: () => z.ZodObject<{
    continue: z.ZodOptional<z.ZodBoolean>;
    suppressOutput: z.ZodOptional<z.ZodBoolean>;
    stopReason: z.ZodOptional<z.ZodString>;
    decision: z.ZodOptional<z.ZodEnum<{
        block: "block";
        approve: "approve";
    }>>;
    systemMessage: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
    hookSpecificOutput: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
        hookEventName: z.ZodLiteral<"PreToolUse">;
        permissionDecision: z.ZodOptional<z.ZodEnum<{
            deny: "deny";
            allow: "allow";
            ask: "ask";
        }>>;
        permissionDecisionReason: z.ZodOptional<z.ZodString>;
        updatedInput: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"UserPromptSubmit">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"SessionStart">;
        additionalContext: z.ZodOptional<z.ZodString>;
        initialUserMessage: z.ZodOptional<z.ZodString>;
        watchPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"Setup">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"SubagentStart">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"PostToolUse">;
        additionalContext: z.ZodOptional<z.ZodString>;
        updatedMCPToolOutput: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"PostToolUseFailure">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"PermissionDenied">;
        retry: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"Notification">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"PermissionRequest">;
        decision: z.ZodUnion<readonly [z.ZodObject<{
            behavior: z.ZodLiteral<"allow">;
            updatedInput: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            updatedPermissions: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
                mode: z.ZodLazy<z.ZodEnum<{
                    plan: "plan";
                    auto: "auto";
                    default: "default";
                    acceptEdits: "acceptEdits";
                    bypassPermissions: "bypassPermissions";
                    dontAsk: "dontAsk";
                }>>;
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
            }, z.core.$strip>], "type">>>;
        }, z.core.$strip>, z.ZodObject<{
            behavior: z.ZodLiteral<"deny">;
            message: z.ZodOptional<z.ZodString>;
            interrupt: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>]>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"Elicitation">;
        action: z.ZodOptional<z.ZodEnum<{
            cancel: "cancel";
            accept: "accept";
            decline: "decline";
        }>>;
        content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"ElicitationResult">;
        action: z.ZodOptional<z.ZodEnum<{
            cancel: "cancel";
            accept: "accept";
            decline: "decline";
        }>>;
        content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"CwdChanged">;
        watchPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"FileChanged">;
        watchPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"WorktreeCreate">;
        worktreePath: z.ZodString;
    }, z.core.$strip>]>>;
}, z.core.$strip>;
export declare const ElicitationHookSpecificOutputSchema: () => z.ZodObject<{
    hookEventName: z.ZodLiteral<"Elicitation">;
    action: z.ZodOptional<z.ZodEnum<{
        cancel: "cancel";
        accept: "accept";
        decline: "decline";
    }>>;
    content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const ElicitationResultHookSpecificOutputSchema: () => z.ZodObject<{
    hookEventName: z.ZodLiteral<"ElicitationResult">;
    action: z.ZodOptional<z.ZodEnum<{
        cancel: "cancel";
        accept: "accept";
        decline: "decline";
    }>>;
    content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const WorktreeCreateHookSpecificOutputSchema: () => z.ZodObject<{
    hookEventName: z.ZodLiteral<"WorktreeCreate">;
    worktreePath: z.ZodString;
}, z.core.$strip>;
export declare const HookJSONOutputSchema: () => z.ZodUnion<readonly [z.ZodObject<{
    async: z.ZodLiteral<true>;
    asyncTimeout: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    continue: z.ZodOptional<z.ZodBoolean>;
    suppressOutput: z.ZodOptional<z.ZodBoolean>;
    stopReason: z.ZodOptional<z.ZodString>;
    decision: z.ZodOptional<z.ZodEnum<{
        block: "block";
        approve: "approve";
    }>>;
    systemMessage: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
    hookSpecificOutput: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
        hookEventName: z.ZodLiteral<"PreToolUse">;
        permissionDecision: z.ZodOptional<z.ZodEnum<{
            deny: "deny";
            allow: "allow";
            ask: "ask";
        }>>;
        permissionDecisionReason: z.ZodOptional<z.ZodString>;
        updatedInput: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"UserPromptSubmit">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"SessionStart">;
        additionalContext: z.ZodOptional<z.ZodString>;
        initialUserMessage: z.ZodOptional<z.ZodString>;
        watchPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"Setup">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"SubagentStart">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"PostToolUse">;
        additionalContext: z.ZodOptional<z.ZodString>;
        updatedMCPToolOutput: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"PostToolUseFailure">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"PermissionDenied">;
        retry: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"Notification">;
        additionalContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"PermissionRequest">;
        decision: z.ZodUnion<readonly [z.ZodObject<{
            behavior: z.ZodLiteral<"allow">;
            updatedInput: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            updatedPermissions: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
                mode: z.ZodLazy<z.ZodEnum<{
                    plan: "plan";
                    auto: "auto";
                    default: "default";
                    acceptEdits: "acceptEdits";
                    bypassPermissions: "bypassPermissions";
                    dontAsk: "dontAsk";
                }>>;
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
            }, z.core.$strip>], "type">>>;
        }, z.core.$strip>, z.ZodObject<{
            behavior: z.ZodLiteral<"deny">;
            message: z.ZodOptional<z.ZodString>;
            interrupt: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>]>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"Elicitation">;
        action: z.ZodOptional<z.ZodEnum<{
            cancel: "cancel";
            accept: "accept";
            decline: "decline";
        }>>;
        content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"ElicitationResult">;
        action: z.ZodOptional<z.ZodEnum<{
            cancel: "cancel";
            accept: "accept";
            decline: "decline";
        }>>;
        content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"CwdChanged">;
        watchPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"FileChanged">;
        watchPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        hookEventName: z.ZodLiteral<"WorktreeCreate">;
        worktreePath: z.ZodString;
    }, z.core.$strip>]>>;
}, z.core.$strip>]>;
export declare const PromptRequestOptionSchema: () => z.ZodObject<{
    key: z.ZodString;
    label: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const PromptRequestSchema: () => z.ZodObject<{
    prompt: z.ZodString;
    message: z.ZodString;
    options: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const PromptResponseSchema: () => z.ZodObject<{
    prompt_response: z.ZodString;
    selected: z.ZodString;
}, z.core.$strip>;
export declare const SlashCommandSchema: () => z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    argumentHint: z.ZodString;
}, z.core.$strip>;
export declare const AgentInfoSchema: () => z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    model: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ModelInfoSchema: () => z.ZodObject<{
    value: z.ZodString;
    displayName: z.ZodString;
    description: z.ZodString;
    supportsEffort: z.ZodOptional<z.ZodBoolean>;
    supportedEffortLevels: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        max: "max";
    }>>>;
    supportsAdaptiveThinking: z.ZodOptional<z.ZodBoolean>;
    supportsFastMode: z.ZodOptional<z.ZodBoolean>;
    supportsAutoMode: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const AccountInfoSchema: () => z.ZodObject<{
    email: z.ZodOptional<z.ZodString>;
    organization: z.ZodOptional<z.ZodString>;
    subscriptionType: z.ZodOptional<z.ZodString>;
    tokenSource: z.ZodOptional<z.ZodString>;
    apiKeySource: z.ZodOptional<z.ZodString>;
    apiProvider: z.ZodOptional<z.ZodEnum<{
        firstParty: "firstParty";
        bedrock: "bedrock";
        vertex: "vertex";
        foundry: "foundry";
    }>>;
}, z.core.$strip>;
export declare const AgentMcpServerSpecSchema: () => z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
    type: z.ZodOptional<z.ZodLiteral<"stdio">>;
    command: z.ZodString;
    args: z.ZodOptional<z.ZodArray<z.ZodString>>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"sse">;
    url: z.ZodString;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"http">;
    url: z.ZodString;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"sdk">;
    name: z.ZodString;
}, z.core.$strip>]>>]>;
export declare const AgentDefinitionSchema: () => z.ZodObject<{
    description: z.ZodString;
    tools: z.ZodOptional<z.ZodArray<z.ZodString>>;
    disallowedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
    prompt: z.ZodString;
    model: z.ZodOptional<z.ZodString>;
    mcpServers: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        type: z.ZodOptional<z.ZodLiteral<"stdio">>;
        command: z.ZodString;
        args: z.ZodOptional<z.ZodArray<z.ZodString>>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sse">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"http">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sdk">;
        name: z.ZodString;
    }, z.core.$strip>]>>]>>>;
    criticalSystemReminder_EXPERIMENTAL: z.ZodOptional<z.ZodString>;
    skills: z.ZodOptional<z.ZodArray<z.ZodString>>;
    initialPrompt: z.ZodOptional<z.ZodString>;
    maxTurns: z.ZodOptional<z.ZodNumber>;
    background: z.ZodOptional<z.ZodBoolean>;
    memory: z.ZodOptional<z.ZodEnum<{
        local: "local";
        user: "user";
        project: "project";
    }>>;
    effort: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        max: "max";
    }>, z.ZodNumber]>>;
    permissionMode: z.ZodOptional<z.ZodEnum<{
        plan: "plan";
        auto: "auto";
        default: "default";
        acceptEdits: "acceptEdits";
        bypassPermissions: "bypassPermissions";
        dontAsk: "dontAsk";
    }>>;
}, z.core.$strip>;
export declare const SettingSourceSchema: () => z.ZodEnum<{
    local: "local";
    user: "user";
    project: "project";
}>;
export declare const SdkPluginConfigSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"local">;
    path: z.ZodString;
}, z.core.$strip>;
export declare const RewindFilesResultSchema: () => z.ZodObject<{
    canRewind: z.ZodBoolean;
    error: z.ZodOptional<z.ZodString>;
    filesChanged: z.ZodOptional<z.ZodArray<z.ZodString>>;
    insertions: z.ZodOptional<z.ZodNumber>;
    deletions: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/** Placeholder for APIUserMessage from @anthropic-ai/sdk */
export declare const APIUserMessagePlaceholder: () => z.ZodUnknown;
/** Placeholder for APIAssistantMessage from @anthropic-ai/sdk */
export declare const APIAssistantMessagePlaceholder: () => z.ZodUnknown;
/** Placeholder for RawMessageStreamEvent from @anthropic-ai/sdk */
export declare const RawMessageStreamEventPlaceholder: () => z.ZodUnknown;
/** Placeholder for UUID from crypto */
export declare const UUIDPlaceholder: () => z.ZodString;
/** Placeholder for NonNullableUsage (mapped type over Usage) */
export declare const NonNullableUsagePlaceholder: () => z.ZodUnknown;
export declare const SDKAssistantMessageErrorSchema: () => z.ZodEnum<{
    unknown: "unknown";
    rate_limit: "rate_limit";
    invalid_request: "invalid_request";
    billing_error: "billing_error";
    authentication_failed: "authentication_failed";
    server_error: "server_error";
    max_output_tokens: "max_output_tokens";
}>;
export declare const SDKStatusSchema: () => z.ZodUnion<readonly [z.ZodLiteral<"compacting">, z.ZodNull]>;
export declare const SDKUserMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"user">;
    message: z.ZodUnknown;
    parent_tool_use_id: z.ZodNullable<z.ZodString>;
    isSynthetic: z.ZodOptional<z.ZodBoolean>;
    tool_use_result: z.ZodOptional<z.ZodUnknown>;
    priority: z.ZodOptional<z.ZodEnum<{
        next: "next";
        now: "now";
        later: "later";
    }>>;
    timestamp: z.ZodOptional<z.ZodString>;
    uuid: z.ZodOptional<z.ZodString>;
    session_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const SDKUserMessageReplaySchema: () => z.ZodObject<{
    type: z.ZodLiteral<"user">;
    message: z.ZodUnknown;
    parent_tool_use_id: z.ZodNullable<z.ZodString>;
    isSynthetic: z.ZodOptional<z.ZodBoolean>;
    tool_use_result: z.ZodOptional<z.ZodUnknown>;
    priority: z.ZodOptional<z.ZodEnum<{
        next: "next";
        now: "now";
        later: "later";
    }>>;
    timestamp: z.ZodOptional<z.ZodString>;
    uuid: z.ZodString;
    session_id: z.ZodString;
    isReplay: z.ZodLiteral<true>;
}, z.core.$strip>;
export declare const SDKRateLimitInfoSchema: () => z.ZodObject<{
    status: z.ZodEnum<{
        allowed: "allowed";
        allowed_warning: "allowed_warning";
        rejected: "rejected";
    }>;
    resetsAt: z.ZodOptional<z.ZodNumber>;
    rateLimitType: z.ZodOptional<z.ZodEnum<{
        five_hour: "five_hour";
        seven_day: "seven_day";
        seven_day_opus: "seven_day_opus";
        seven_day_sonnet: "seven_day_sonnet";
        overage: "overage";
    }>>;
    utilization: z.ZodOptional<z.ZodNumber>;
    overageStatus: z.ZodOptional<z.ZodEnum<{
        allowed: "allowed";
        allowed_warning: "allowed_warning";
        rejected: "rejected";
    }>>;
    overageResetsAt: z.ZodOptional<z.ZodNumber>;
    overageDisabledReason: z.ZodOptional<z.ZodEnum<{
        unknown: "unknown";
        overage_not_provisioned: "overage_not_provisioned";
        org_level_disabled: "org_level_disabled";
        org_level_disabled_until: "org_level_disabled_until";
        out_of_credits: "out_of_credits";
        seat_tier_level_disabled: "seat_tier_level_disabled";
        member_level_disabled: "member_level_disabled";
        seat_tier_zero_credit_limit: "seat_tier_zero_credit_limit";
        group_zero_credit_limit: "group_zero_credit_limit";
        member_zero_credit_limit: "member_zero_credit_limit";
        org_service_level_disabled: "org_service_level_disabled";
        org_service_zero_credit_limit: "org_service_zero_credit_limit";
        no_limits_configured: "no_limits_configured";
    }>>;
    isUsingOverage: z.ZodOptional<z.ZodBoolean>;
    surpassedThreshold: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const SDKAssistantMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"assistant">;
    message: z.ZodUnknown;
    parent_tool_use_id: z.ZodNullable<z.ZodString>;
    error: z.ZodOptional<z.ZodEnum<{
        unknown: "unknown";
        rate_limit: "rate_limit";
        invalid_request: "invalid_request";
        billing_error: "billing_error";
        authentication_failed: "authentication_failed";
        server_error: "server_error";
        max_output_tokens: "max_output_tokens";
    }>>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKRateLimitEventSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"rate_limit_event">;
    rate_limit_info: z.ZodObject<{
        status: z.ZodEnum<{
            allowed: "allowed";
            allowed_warning: "allowed_warning";
            rejected: "rejected";
        }>;
        resetsAt: z.ZodOptional<z.ZodNumber>;
        rateLimitType: z.ZodOptional<z.ZodEnum<{
            five_hour: "five_hour";
            seven_day: "seven_day";
            seven_day_opus: "seven_day_opus";
            seven_day_sonnet: "seven_day_sonnet";
            overage: "overage";
        }>>;
        utilization: z.ZodOptional<z.ZodNumber>;
        overageStatus: z.ZodOptional<z.ZodEnum<{
            allowed: "allowed";
            allowed_warning: "allowed_warning";
            rejected: "rejected";
        }>>;
        overageResetsAt: z.ZodOptional<z.ZodNumber>;
        overageDisabledReason: z.ZodOptional<z.ZodEnum<{
            unknown: "unknown";
            overage_not_provisioned: "overage_not_provisioned";
            org_level_disabled: "org_level_disabled";
            org_level_disabled_until: "org_level_disabled_until";
            out_of_credits: "out_of_credits";
            seat_tier_level_disabled: "seat_tier_level_disabled";
            member_level_disabled: "member_level_disabled";
            seat_tier_zero_credit_limit: "seat_tier_zero_credit_limit";
            group_zero_credit_limit: "group_zero_credit_limit";
            member_zero_credit_limit: "member_zero_credit_limit";
            org_service_level_disabled: "org_service_level_disabled";
            org_service_zero_credit_limit: "org_service_zero_credit_limit";
            no_limits_configured: "no_limits_configured";
        }>>;
        isUsingOverage: z.ZodOptional<z.ZodBoolean>;
        surpassedThreshold: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKStreamlinedTextMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"streamlined_text">;
    text: z.ZodString;
    session_id: z.ZodString;
    uuid: z.ZodString;
}, z.core.$strip>;
export declare const SDKStreamlinedToolUseSummaryMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"streamlined_tool_use_summary">;
    tool_summary: z.ZodString;
    session_id: z.ZodString;
    uuid: z.ZodString;
}, z.core.$strip>;
export declare const SDKPermissionDenialSchema: () => z.ZodObject<{
    tool_name: z.ZodString;
    tool_use_id: z.ZodString;
    tool_input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export declare const SDKResultSuccessSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"result">;
    subtype: z.ZodLiteral<"success">;
    duration_ms: z.ZodNumber;
    duration_api_ms: z.ZodNumber;
    is_error: z.ZodBoolean;
    num_turns: z.ZodNumber;
    result: z.ZodString;
    stop_reason: z.ZodNullable<z.ZodString>;
    total_cost_usd: z.ZodNumber;
    usage: z.ZodUnknown;
    modelUsage: z.ZodRecord<z.ZodString, z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        cacheReadInputTokens: z.ZodNumber;
        cacheCreationInputTokens: z.ZodNumber;
        webSearchRequests: z.ZodNumber;
        costUSD: z.ZodNumber;
        contextWindow: z.ZodNumber;
        maxOutputTokens: z.ZodNumber;
    }, z.core.$strip>>;
    permission_denials: z.ZodArray<z.ZodObject<{
        tool_name: z.ZodString;
        tool_use_id: z.ZodString;
        tool_input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>>;
    structured_output: z.ZodOptional<z.ZodUnknown>;
    fast_mode_state: z.ZodOptional<z.ZodEnum<{
        on: "on";
        off: "off";
        cooldown: "cooldown";
    }>>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKResultErrorSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"result">;
    subtype: z.ZodEnum<{
        error_during_execution: "error_during_execution";
        error_max_turns: "error_max_turns";
        error_max_budget_usd: "error_max_budget_usd";
        error_max_structured_output_retries: "error_max_structured_output_retries";
    }>;
    duration_ms: z.ZodNumber;
    duration_api_ms: z.ZodNumber;
    is_error: z.ZodBoolean;
    num_turns: z.ZodNumber;
    stop_reason: z.ZodNullable<z.ZodString>;
    total_cost_usd: z.ZodNumber;
    usage: z.ZodUnknown;
    modelUsage: z.ZodRecord<z.ZodString, z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        cacheReadInputTokens: z.ZodNumber;
        cacheCreationInputTokens: z.ZodNumber;
        webSearchRequests: z.ZodNumber;
        costUSD: z.ZodNumber;
        contextWindow: z.ZodNumber;
        maxOutputTokens: z.ZodNumber;
    }, z.core.$strip>>;
    permission_denials: z.ZodArray<z.ZodObject<{
        tool_name: z.ZodString;
        tool_use_id: z.ZodString;
        tool_input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>>;
    errors: z.ZodArray<z.ZodString>;
    fast_mode_state: z.ZodOptional<z.ZodEnum<{
        on: "on";
        off: "off";
        cooldown: "cooldown";
    }>>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKResultMessageSchema: () => z.ZodUnion<readonly [z.ZodObject<{
    type: z.ZodLiteral<"result">;
    subtype: z.ZodLiteral<"success">;
    duration_ms: z.ZodNumber;
    duration_api_ms: z.ZodNumber;
    is_error: z.ZodBoolean;
    num_turns: z.ZodNumber;
    result: z.ZodString;
    stop_reason: z.ZodNullable<z.ZodString>;
    total_cost_usd: z.ZodNumber;
    usage: z.ZodUnknown;
    modelUsage: z.ZodRecord<z.ZodString, z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        cacheReadInputTokens: z.ZodNumber;
        cacheCreationInputTokens: z.ZodNumber;
        webSearchRequests: z.ZodNumber;
        costUSD: z.ZodNumber;
        contextWindow: z.ZodNumber;
        maxOutputTokens: z.ZodNumber;
    }, z.core.$strip>>;
    permission_denials: z.ZodArray<z.ZodObject<{
        tool_name: z.ZodString;
        tool_use_id: z.ZodString;
        tool_input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>>;
    structured_output: z.ZodOptional<z.ZodUnknown>;
    fast_mode_state: z.ZodOptional<z.ZodEnum<{
        on: "on";
        off: "off";
        cooldown: "cooldown";
    }>>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"result">;
    subtype: z.ZodEnum<{
        error_during_execution: "error_during_execution";
        error_max_turns: "error_max_turns";
        error_max_budget_usd: "error_max_budget_usd";
        error_max_structured_output_retries: "error_max_structured_output_retries";
    }>;
    duration_ms: z.ZodNumber;
    duration_api_ms: z.ZodNumber;
    is_error: z.ZodBoolean;
    num_turns: z.ZodNumber;
    stop_reason: z.ZodNullable<z.ZodString>;
    total_cost_usd: z.ZodNumber;
    usage: z.ZodUnknown;
    modelUsage: z.ZodRecord<z.ZodString, z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        cacheReadInputTokens: z.ZodNumber;
        cacheCreationInputTokens: z.ZodNumber;
        webSearchRequests: z.ZodNumber;
        costUSD: z.ZodNumber;
        contextWindow: z.ZodNumber;
        maxOutputTokens: z.ZodNumber;
    }, z.core.$strip>>;
    permission_denials: z.ZodArray<z.ZodObject<{
        tool_name: z.ZodString;
        tool_use_id: z.ZodString;
        tool_input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>>;
    errors: z.ZodArray<z.ZodString>;
    fast_mode_state: z.ZodOptional<z.ZodEnum<{
        on: "on";
        off: "off";
        cooldown: "cooldown";
    }>>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>]>;
export declare const SDKSystemMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"init">;
    agents: z.ZodOptional<z.ZodArray<z.ZodString>>;
    apiKeySource: z.ZodEnum<{
        user: "user";
        project: "project";
        oauth: "oauth";
        org: "org";
        temporary: "temporary";
    }>;
    betas: z.ZodOptional<z.ZodArray<z.ZodString>>;
    claude_code_version: z.ZodString;
    cwd: z.ZodString;
    tools: z.ZodArray<z.ZodString>;
    mcp_servers: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        status: z.ZodString;
    }, z.core.$strip>>;
    model: z.ZodString;
    permissionMode: z.ZodEnum<{
        plan: "plan";
        auto: "auto";
        default: "default";
        acceptEdits: "acceptEdits";
        bypassPermissions: "bypassPermissions";
        dontAsk: "dontAsk";
    }>;
    slash_commands: z.ZodArray<z.ZodString>;
    output_style: z.ZodString;
    skills: z.ZodArray<z.ZodString>;
    plugins: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        path: z.ZodString;
        source: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    fast_mode_state: z.ZodOptional<z.ZodEnum<{
        on: "on";
        off: "off";
        cooldown: "cooldown";
    }>>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKPartialAssistantMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"stream_event">;
    event: z.ZodUnknown;
    parent_tool_use_id: z.ZodNullable<z.ZodString>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKCompactBoundaryMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"compact_boundary">;
    compact_metadata: z.ZodObject<{
        trigger: z.ZodEnum<{
            auto: "auto";
            manual: "manual";
        }>;
        pre_tokens: z.ZodNumber;
        preserved_segment: z.ZodOptional<z.ZodObject<{
            head_uuid: z.ZodString;
            anchor_uuid: z.ZodString;
            tail_uuid: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKStatusMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"status">;
    status: z.ZodUnion<readonly [z.ZodLiteral<"compacting">, z.ZodNull]>;
    permissionMode: z.ZodOptional<z.ZodEnum<{
        plan: "plan";
        auto: "auto";
        default: "default";
        acceptEdits: "acceptEdits";
        bypassPermissions: "bypassPermissions";
        dontAsk: "dontAsk";
    }>>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKPostTurnSummaryMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"post_turn_summary">;
    summarizes_uuid: z.ZodString;
    status_category: z.ZodEnum<{
        completed: "completed";
        waiting: "waiting";
        blocked: "blocked";
        failed: "failed";
        review_ready: "review_ready";
    }>;
    status_detail: z.ZodString;
    is_noteworthy: z.ZodBoolean;
    title: z.ZodString;
    description: z.ZodString;
    recent_action: z.ZodString;
    needs_action: z.ZodString;
    artifact_urls: z.ZodArray<z.ZodString>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKAPIRetryMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"api_retry">;
    attempt: z.ZodNumber;
    max_retries: z.ZodNumber;
    retry_delay_ms: z.ZodNumber;
    error_status: z.ZodNullable<z.ZodNumber>;
    error: z.ZodEnum<{
        unknown: "unknown";
        rate_limit: "rate_limit";
        invalid_request: "invalid_request";
        billing_error: "billing_error";
        authentication_failed: "authentication_failed";
        server_error: "server_error";
        max_output_tokens: "max_output_tokens";
    }>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKLocalCommandOutputMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"local_command_output">;
    content: z.ZodString;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKHookStartedMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"hook_started">;
    hook_id: z.ZodString;
    hook_name: z.ZodString;
    hook_event: z.ZodString;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKHookProgressMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"hook_progress">;
    hook_id: z.ZodString;
    hook_name: z.ZodString;
    hook_event: z.ZodString;
    stdout: z.ZodString;
    stderr: z.ZodString;
    output: z.ZodString;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKHookResponseMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"hook_response">;
    hook_id: z.ZodString;
    hook_name: z.ZodString;
    hook_event: z.ZodString;
    output: z.ZodString;
    stdout: z.ZodString;
    stderr: z.ZodString;
    exit_code: z.ZodOptional<z.ZodNumber>;
    outcome: z.ZodEnum<{
        error: "error";
        success: "success";
        cancelled: "cancelled";
    }>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKToolProgressMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"tool_progress">;
    tool_use_id: z.ZodString;
    tool_name: z.ZodString;
    parent_tool_use_id: z.ZodNullable<z.ZodString>;
    elapsed_time_seconds: z.ZodNumber;
    task_id: z.ZodOptional<z.ZodString>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKAuthStatusMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"auth_status">;
    isAuthenticating: z.ZodBoolean;
    output: z.ZodArray<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKFilesPersistedEventSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"files_persisted">;
    files: z.ZodArray<z.ZodObject<{
        filename: z.ZodString;
        file_id: z.ZodString;
    }, z.core.$strip>>;
    failed: z.ZodArray<z.ZodObject<{
        filename: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>>;
    processed_at: z.ZodString;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKTaskNotificationMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"task_notification">;
    task_id: z.ZodString;
    tool_use_id: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        stopped: "stopped";
    }>;
    output_file: z.ZodString;
    summary: z.ZodString;
    usage: z.ZodOptional<z.ZodObject<{
        total_tokens: z.ZodNumber;
        tool_uses: z.ZodNumber;
        duration_ms: z.ZodNumber;
    }, z.core.$strip>>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKTaskStartedMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"task_started">;
    task_id: z.ZodString;
    tool_use_id: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    task_type: z.ZodOptional<z.ZodString>;
    workflow_name: z.ZodOptional<z.ZodString>;
    prompt: z.ZodOptional<z.ZodString>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKSessionStateChangedMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"session_state_changed">;
    state: z.ZodEnum<{
        running: "running";
        idle: "idle";
        requires_action: "requires_action";
    }>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKTaskProgressMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"task_progress">;
    task_id: z.ZodString;
    tool_use_id: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    usage: z.ZodObject<{
        total_tokens: z.ZodNumber;
        tool_uses: z.ZodNumber;
        duration_ms: z.ZodNumber;
    }, z.core.$strip>;
    last_tool_name: z.ZodOptional<z.ZodString>;
    summary: z.ZodOptional<z.ZodString>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKToolUseSummaryMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"tool_use_summary">;
    summary: z.ZodString;
    preceding_tool_use_ids: z.ZodArray<z.ZodString>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKElicitationCompleteMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"elicitation_complete">;
    mcp_server_name: z.ZodString;
    elicitation_id: z.ZodString;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
/** @internal */
export declare const SDKPromptSuggestionMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"prompt_suggestion">;
    suggestion: z.ZodString;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKSessionInfoSchema: () => z.ZodObject<{
    sessionId: z.ZodString;
    summary: z.ZodString;
    lastModified: z.ZodNumber;
    fileSize: z.ZodOptional<z.ZodNumber>;
    customTitle: z.ZodOptional<z.ZodString>;
    firstPrompt: z.ZodOptional<z.ZodString>;
    gitBranch: z.ZodOptional<z.ZodString>;
    cwd: z.ZodOptional<z.ZodString>;
    tag: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const SDKMessageSchema: () => z.ZodUnion<readonly [z.ZodObject<{
    type: z.ZodLiteral<"assistant">;
    message: z.ZodUnknown;
    parent_tool_use_id: z.ZodNullable<z.ZodString>;
    error: z.ZodOptional<z.ZodEnum<{
        unknown: "unknown";
        rate_limit: "rate_limit";
        invalid_request: "invalid_request";
        billing_error: "billing_error";
        authentication_failed: "authentication_failed";
        server_error: "server_error";
        max_output_tokens: "max_output_tokens";
    }>>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"user">;
    message: z.ZodUnknown;
    parent_tool_use_id: z.ZodNullable<z.ZodString>;
    isSynthetic: z.ZodOptional<z.ZodBoolean>;
    tool_use_result: z.ZodOptional<z.ZodUnknown>;
    priority: z.ZodOptional<z.ZodEnum<{
        next: "next";
        now: "now";
        later: "later";
    }>>;
    timestamp: z.ZodOptional<z.ZodString>;
    uuid: z.ZodOptional<z.ZodString>;
    session_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"user">;
    message: z.ZodUnknown;
    parent_tool_use_id: z.ZodNullable<z.ZodString>;
    isSynthetic: z.ZodOptional<z.ZodBoolean>;
    tool_use_result: z.ZodOptional<z.ZodUnknown>;
    priority: z.ZodOptional<z.ZodEnum<{
        next: "next";
        now: "now";
        later: "later";
    }>>;
    timestamp: z.ZodOptional<z.ZodString>;
    uuid: z.ZodString;
    session_id: z.ZodString;
    isReplay: z.ZodLiteral<true>;
}, z.core.$strip>, z.ZodUnion<readonly [z.ZodObject<{
    type: z.ZodLiteral<"result">;
    subtype: z.ZodLiteral<"success">;
    duration_ms: z.ZodNumber;
    duration_api_ms: z.ZodNumber;
    is_error: z.ZodBoolean;
    num_turns: z.ZodNumber;
    result: z.ZodString;
    stop_reason: z.ZodNullable<z.ZodString>;
    total_cost_usd: z.ZodNumber;
    usage: z.ZodUnknown;
    modelUsage: z.ZodRecord<z.ZodString, z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        cacheReadInputTokens: z.ZodNumber;
        cacheCreationInputTokens: z.ZodNumber;
        webSearchRequests: z.ZodNumber;
        costUSD: z.ZodNumber;
        contextWindow: z.ZodNumber;
        maxOutputTokens: z.ZodNumber;
    }, z.core.$strip>>;
    permission_denials: z.ZodArray<z.ZodObject<{
        tool_name: z.ZodString;
        tool_use_id: z.ZodString;
        tool_input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>>;
    structured_output: z.ZodOptional<z.ZodUnknown>;
    fast_mode_state: z.ZodOptional<z.ZodEnum<{
        on: "on";
        off: "off";
        cooldown: "cooldown";
    }>>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"result">;
    subtype: z.ZodEnum<{
        error_during_execution: "error_during_execution";
        error_max_turns: "error_max_turns";
        error_max_budget_usd: "error_max_budget_usd";
        error_max_structured_output_retries: "error_max_structured_output_retries";
    }>;
    duration_ms: z.ZodNumber;
    duration_api_ms: z.ZodNumber;
    is_error: z.ZodBoolean;
    num_turns: z.ZodNumber;
    stop_reason: z.ZodNullable<z.ZodString>;
    total_cost_usd: z.ZodNumber;
    usage: z.ZodUnknown;
    modelUsage: z.ZodRecord<z.ZodString, z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        cacheReadInputTokens: z.ZodNumber;
        cacheCreationInputTokens: z.ZodNumber;
        webSearchRequests: z.ZodNumber;
        costUSD: z.ZodNumber;
        contextWindow: z.ZodNumber;
        maxOutputTokens: z.ZodNumber;
    }, z.core.$strip>>;
    permission_denials: z.ZodArray<z.ZodObject<{
        tool_name: z.ZodString;
        tool_use_id: z.ZodString;
        tool_input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>>;
    errors: z.ZodArray<z.ZodString>;
    fast_mode_state: z.ZodOptional<z.ZodEnum<{
        on: "on";
        off: "off";
        cooldown: "cooldown";
    }>>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>]>, z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"init">;
    agents: z.ZodOptional<z.ZodArray<z.ZodString>>;
    apiKeySource: z.ZodEnum<{
        user: "user";
        project: "project";
        oauth: "oauth";
        org: "org";
        temporary: "temporary";
    }>;
    betas: z.ZodOptional<z.ZodArray<z.ZodString>>;
    claude_code_version: z.ZodString;
    cwd: z.ZodString;
    tools: z.ZodArray<z.ZodString>;
    mcp_servers: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        status: z.ZodString;
    }, z.core.$strip>>;
    model: z.ZodString;
    permissionMode: z.ZodEnum<{
        plan: "plan";
        auto: "auto";
        default: "default";
        acceptEdits: "acceptEdits";
        bypassPermissions: "bypassPermissions";
        dontAsk: "dontAsk";
    }>;
    slash_commands: z.ZodArray<z.ZodString>;
    output_style: z.ZodString;
    skills: z.ZodArray<z.ZodString>;
    plugins: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        path: z.ZodString;
        source: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    fast_mode_state: z.ZodOptional<z.ZodEnum<{
        on: "on";
        off: "off";
        cooldown: "cooldown";
    }>>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"stream_event">;
    event: z.ZodUnknown;
    parent_tool_use_id: z.ZodNullable<z.ZodString>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"compact_boundary">;
    compact_metadata: z.ZodObject<{
        trigger: z.ZodEnum<{
            auto: "auto";
            manual: "manual";
        }>;
        pre_tokens: z.ZodNumber;
        preserved_segment: z.ZodOptional<z.ZodObject<{
            head_uuid: z.ZodString;
            anchor_uuid: z.ZodString;
            tail_uuid: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"status">;
    status: z.ZodUnion<readonly [z.ZodLiteral<"compacting">, z.ZodNull]>;
    permissionMode: z.ZodOptional<z.ZodEnum<{
        plan: "plan";
        auto: "auto";
        default: "default";
        acceptEdits: "acceptEdits";
        bypassPermissions: "bypassPermissions";
        dontAsk: "dontAsk";
    }>>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"api_retry">;
    attempt: z.ZodNumber;
    max_retries: z.ZodNumber;
    retry_delay_ms: z.ZodNumber;
    error_status: z.ZodNullable<z.ZodNumber>;
    error: z.ZodEnum<{
        unknown: "unknown";
        rate_limit: "rate_limit";
        invalid_request: "invalid_request";
        billing_error: "billing_error";
        authentication_failed: "authentication_failed";
        server_error: "server_error";
        max_output_tokens: "max_output_tokens";
    }>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"local_command_output">;
    content: z.ZodString;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"hook_started">;
    hook_id: z.ZodString;
    hook_name: z.ZodString;
    hook_event: z.ZodString;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"hook_progress">;
    hook_id: z.ZodString;
    hook_name: z.ZodString;
    hook_event: z.ZodString;
    stdout: z.ZodString;
    stderr: z.ZodString;
    output: z.ZodString;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"hook_response">;
    hook_id: z.ZodString;
    hook_name: z.ZodString;
    hook_event: z.ZodString;
    output: z.ZodString;
    stdout: z.ZodString;
    stderr: z.ZodString;
    exit_code: z.ZodOptional<z.ZodNumber>;
    outcome: z.ZodEnum<{
        error: "error";
        success: "success";
        cancelled: "cancelled";
    }>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"tool_progress">;
    tool_use_id: z.ZodString;
    tool_name: z.ZodString;
    parent_tool_use_id: z.ZodNullable<z.ZodString>;
    elapsed_time_seconds: z.ZodNumber;
    task_id: z.ZodOptional<z.ZodString>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"auth_status">;
    isAuthenticating: z.ZodBoolean;
    output: z.ZodArray<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"task_notification">;
    task_id: z.ZodString;
    tool_use_id: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        completed: "completed";
        failed: "failed";
        stopped: "stopped";
    }>;
    output_file: z.ZodString;
    summary: z.ZodString;
    usage: z.ZodOptional<z.ZodObject<{
        total_tokens: z.ZodNumber;
        tool_uses: z.ZodNumber;
        duration_ms: z.ZodNumber;
    }, z.core.$strip>>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"task_started">;
    task_id: z.ZodString;
    tool_use_id: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    task_type: z.ZodOptional<z.ZodString>;
    workflow_name: z.ZodOptional<z.ZodString>;
    prompt: z.ZodOptional<z.ZodString>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"task_progress">;
    task_id: z.ZodString;
    tool_use_id: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    usage: z.ZodObject<{
        total_tokens: z.ZodNumber;
        tool_uses: z.ZodNumber;
        duration_ms: z.ZodNumber;
    }, z.core.$strip>;
    last_tool_name: z.ZodOptional<z.ZodString>;
    summary: z.ZodOptional<z.ZodString>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"session_state_changed">;
    state: z.ZodEnum<{
        running: "running";
        idle: "idle";
        requires_action: "requires_action";
    }>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"files_persisted">;
    files: z.ZodArray<z.ZodObject<{
        filename: z.ZodString;
        file_id: z.ZodString;
    }, z.core.$strip>>;
    failed: z.ZodArray<z.ZodObject<{
        filename: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>>;
    processed_at: z.ZodString;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"tool_use_summary">;
    summary: z.ZodString;
    preceding_tool_use_ids: z.ZodArray<z.ZodString>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"rate_limit_event">;
    rate_limit_info: z.ZodObject<{
        status: z.ZodEnum<{
            allowed: "allowed";
            allowed_warning: "allowed_warning";
            rejected: "rejected";
        }>;
        resetsAt: z.ZodOptional<z.ZodNumber>;
        rateLimitType: z.ZodOptional<z.ZodEnum<{
            five_hour: "five_hour";
            seven_day: "seven_day";
            seven_day_opus: "seven_day_opus";
            seven_day_sonnet: "seven_day_sonnet";
            overage: "overage";
        }>>;
        utilization: z.ZodOptional<z.ZodNumber>;
        overageStatus: z.ZodOptional<z.ZodEnum<{
            allowed: "allowed";
            allowed_warning: "allowed_warning";
            rejected: "rejected";
        }>>;
        overageResetsAt: z.ZodOptional<z.ZodNumber>;
        overageDisabledReason: z.ZodOptional<z.ZodEnum<{
            unknown: "unknown";
            overage_not_provisioned: "overage_not_provisioned";
            org_level_disabled: "org_level_disabled";
            org_level_disabled_until: "org_level_disabled_until";
            out_of_credits: "out_of_credits";
            seat_tier_level_disabled: "seat_tier_level_disabled";
            member_level_disabled: "member_level_disabled";
            seat_tier_zero_credit_limit: "seat_tier_zero_credit_limit";
            group_zero_credit_limit: "group_zero_credit_limit";
            member_zero_credit_limit: "member_zero_credit_limit";
            org_service_level_disabled: "org_service_level_disabled";
            org_service_zero_credit_limit: "org_service_zero_credit_limit";
            no_limits_configured: "no_limits_configured";
        }>>;
        isUsingOverage: z.ZodOptional<z.ZodBoolean>;
        surpassedThreshold: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"system">;
    subtype: z.ZodLiteral<"elicitation_complete">;
    mcp_server_name: z.ZodString;
    elicitation_id: z.ZodString;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"prompt_suggestion">;
    suggestion: z.ZodString;
    uuid: z.ZodString;
    session_id: z.ZodString;
}, z.core.$strip>]>;
export declare const FastModeStateSchema: () => z.ZodEnum<{
    on: "on";
    off: "off";
    cooldown: "cooldown";
}>;
//# sourceMappingURL=coreSchemas.d.ts.map