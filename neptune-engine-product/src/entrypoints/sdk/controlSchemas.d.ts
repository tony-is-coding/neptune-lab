/**
 * SDK Control Schemas - Zod schemas for the control protocol.
 *
 * These schemas define the control protocol between SDK implementations and the CLI.
 * Used by SDK builders (e.g., Python SDK) to communicate with the CLI process.
 *
 * SDK consumers should use coreSchemas.ts instead.
 */
import { z } from 'zod/v4';
export declare const JSONRPCMessagePlaceholder: () => z.ZodUnknown;
export declare const SDKHookCallbackMatcherSchema: () => z.ZodObject<{
    matcher: z.ZodOptional<z.ZodString>;
    hookCallbackIds: z.ZodArray<z.ZodString>;
    timeout: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const SDKControlInitializeRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"initialize">;
    hooks: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
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
    }>, z.ZodArray<z.ZodObject<{
        matcher: z.ZodOptional<z.ZodString>;
        hookCallbackIds: z.ZodArray<z.ZodString>;
        timeout: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>>;
    sdkMcpServers: z.ZodOptional<z.ZodArray<z.ZodString>>;
    jsonSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    systemPrompt: z.ZodOptional<z.ZodString>;
    appendSystemPrompt: z.ZodOptional<z.ZodString>;
    agents: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
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
    }, z.core.$strip>>>;
    promptSuggestions: z.ZodOptional<z.ZodBoolean>;
    agentProgressSummaries: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const SDKControlInitializeResponseSchema: () => z.ZodObject<{
    commands: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        argumentHint: z.ZodString;
    }, z.core.$strip>>;
    agents: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        model: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    output_style: z.ZodString;
    available_output_styles: z.ZodArray<z.ZodString>;
    models: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
    account: z.ZodObject<{
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
    pid: z.ZodOptional<z.ZodNumber>;
    fast_mode_state: z.ZodOptional<z.ZodEnum<{
        on: "on";
        off: "off";
        cooldown: "cooldown";
    }>>;
}, z.core.$strip>;
export declare const SDKControlInterruptRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"interrupt">;
}, z.core.$strip>;
export declare const SDKControlPermissionRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"can_use_tool">;
    tool_name: z.ZodString;
    input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
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
    blocked_path: z.ZodOptional<z.ZodString>;
    decision_reason: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    display_name: z.ZodOptional<z.ZodString>;
    tool_use_id: z.ZodString;
    agent_id: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const SDKControlSetPermissionModeRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"set_permission_mode">;
    mode: z.ZodEnum<{
        plan: "plan";
        auto: "auto";
        default: "default";
        acceptEdits: "acceptEdits";
        bypassPermissions: "bypassPermissions";
        dontAsk: "dontAsk";
    }>;
    ultraplan: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const SDKControlSetModelRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"set_model">;
    model: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const SDKControlSetMaxThinkingTokensRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"set_max_thinking_tokens">;
    max_thinking_tokens: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
export declare const SDKControlMcpStatusRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"mcp_status">;
}, z.core.$strip>;
export declare const SDKControlMcpStatusResponseSchema: () => z.ZodObject<{
    mcpServers: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const SDKControlGetContextUsageRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"get_context_usage">;
}, z.core.$strip>;
export declare const SDKControlGetContextUsageResponseSchema: () => z.ZodObject<{
    categories: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        tokens: z.ZodNumber;
        color: z.ZodString;
        isDeferred: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    totalTokens: z.ZodNumber;
    maxTokens: z.ZodNumber;
    rawMaxTokens: z.ZodNumber;
    percentage: z.ZodNumber;
    gridRows: z.ZodArray<z.ZodArray<z.ZodObject<{
        color: z.ZodString;
        isFilled: z.ZodBoolean;
        categoryName: z.ZodString;
        tokens: z.ZodNumber;
        percentage: z.ZodNumber;
        squareFullness: z.ZodNumber;
    }, z.core.$strip>>>;
    model: z.ZodString;
    memoryFiles: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        type: z.ZodString;
        tokens: z.ZodNumber;
    }, z.core.$strip>>;
    mcpTools: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        serverName: z.ZodString;
        tokens: z.ZodNumber;
        isLoaded: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    deferredBuiltinTools: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        tokens: z.ZodNumber;
        isLoaded: z.ZodBoolean;
    }, z.core.$strip>>>;
    systemTools: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        tokens: z.ZodNumber;
    }, z.core.$strip>>>;
    systemPromptSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        tokens: z.ZodNumber;
    }, z.core.$strip>>>;
    agents: z.ZodArray<z.ZodObject<{
        agentType: z.ZodString;
        source: z.ZodString;
        tokens: z.ZodNumber;
    }, z.core.$strip>>;
    slashCommands: z.ZodOptional<z.ZodObject<{
        totalCommands: z.ZodNumber;
        includedCommands: z.ZodNumber;
        tokens: z.ZodNumber;
    }, z.core.$strip>>;
    skills: z.ZodOptional<z.ZodObject<{
        totalSkills: z.ZodNumber;
        includedSkills: z.ZodNumber;
        tokens: z.ZodNumber;
        skillFrontmatter: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            source: z.ZodString;
            tokens: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    autoCompactThreshold: z.ZodOptional<z.ZodNumber>;
    isAutoCompactEnabled: z.ZodBoolean;
    messageBreakdown: z.ZodOptional<z.ZodObject<{
        toolCallTokens: z.ZodNumber;
        toolResultTokens: z.ZodNumber;
        attachmentTokens: z.ZodNumber;
        assistantMessageTokens: z.ZodNumber;
        userMessageTokens: z.ZodNumber;
        toolCallsByType: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            callTokens: z.ZodNumber;
            resultTokens: z.ZodNumber;
        }, z.core.$strip>>;
        attachmentsByType: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            tokens: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    apiUsage: z.ZodNullable<z.ZodObject<{
        input_tokens: z.ZodNumber;
        output_tokens: z.ZodNumber;
        cache_creation_input_tokens: z.ZodNumber;
        cache_read_input_tokens: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const SDKControlRewindFilesRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"rewind_files">;
    user_message_id: z.ZodString;
    dry_run: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const SDKControlRewindFilesResponseSchema: () => z.ZodObject<{
    canRewind: z.ZodBoolean;
    error: z.ZodOptional<z.ZodString>;
    filesChanged: z.ZodOptional<z.ZodArray<z.ZodString>>;
    insertions: z.ZodOptional<z.ZodNumber>;
    deletions: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const SDKControlCancelAsyncMessageRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"cancel_async_message">;
    message_uuid: z.ZodString;
}, z.core.$strip>;
export declare const SDKControlCancelAsyncMessageResponseSchema: () => z.ZodObject<{
    cancelled: z.ZodBoolean;
}, z.core.$strip>;
export declare const SDKControlSeedReadStateRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"seed_read_state">;
    path: z.ZodString;
    mtime: z.ZodNumber;
}, z.core.$strip>;
export declare const SDKHookCallbackRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"hook_callback">;
    callback_id: z.ZodString;
    input: z.ZodUnion<readonly [z.ZodIntersection<z.ZodObject<{
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
    tool_use_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const SDKControlMcpMessageRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"mcp_message">;
    server_name: z.ZodString;
    message: z.ZodUnknown;
}, z.core.$strip>;
export declare const SDKControlMcpSetServersRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"mcp_set_servers">;
    servers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
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
    }, z.core.$strip>]>>;
}, z.core.$strip>;
export declare const SDKControlMcpSetServersResponseSchema: () => z.ZodObject<{
    added: z.ZodArray<z.ZodString>;
    removed: z.ZodArray<z.ZodString>;
    errors: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strip>;
export declare const SDKControlReloadPluginsRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"reload_plugins">;
}, z.core.$strip>;
export declare const SDKControlReloadPluginsResponseSchema: () => z.ZodObject<{
    commands: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        argumentHint: z.ZodString;
    }, z.core.$strip>>;
    agents: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        model: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    plugins: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        path: z.ZodString;
        source: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    mcpServers: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
    error_count: z.ZodNumber;
}, z.core.$strip>;
export declare const SDKControlMcpReconnectRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"mcp_reconnect">;
    serverName: z.ZodString;
}, z.core.$strip>;
export declare const SDKControlMcpToggleRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"mcp_toggle">;
    serverName: z.ZodString;
    enabled: z.ZodBoolean;
}, z.core.$strip>;
export declare const SDKControlStopTaskRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"stop_task">;
    task_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKControlApplyFlagSettingsRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"apply_flag_settings">;
    settings: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export declare const SDKControlGetSettingsRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"get_settings">;
}, z.core.$strip>;
export declare const SDKControlGetSettingsResponseSchema: () => z.ZodObject<{
    effective: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    sources: z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            userSettings: "userSettings";
            projectSettings: "projectSettings";
            localSettings: "localSettings";
            flagSettings: "flagSettings";
            policySettings: "policySettings";
        }>;
        settings: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>>;
    applied: z.ZodOptional<z.ZodObject<{
        model: z.ZodString;
        effort: z.ZodNullable<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
            max: "max";
        }>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const SDKControlElicitationRequestSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"elicitation">;
    mcp_server_name: z.ZodString;
    message: z.ZodString;
    mode: z.ZodOptional<z.ZodEnum<{
        url: "url";
        form: "form";
    }>>;
    url: z.ZodOptional<z.ZodString>;
    elicitation_id: z.ZodOptional<z.ZodString>;
    requested_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const SDKControlElicitationResponseSchema: () => z.ZodObject<{
    action: z.ZodEnum<{
        cancel: "cancel";
        accept: "accept";
        decline: "decline";
    }>;
    content: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const SDKControlRequestInnerSchema: () => z.ZodUnion<readonly [z.ZodObject<{
    subtype: z.ZodLiteral<"interrupt">;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"can_use_tool">;
    tool_name: z.ZodString;
    input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
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
    blocked_path: z.ZodOptional<z.ZodString>;
    decision_reason: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    display_name: z.ZodOptional<z.ZodString>;
    tool_use_id: z.ZodString;
    agent_id: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"initialize">;
    hooks: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
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
    }>, z.ZodArray<z.ZodObject<{
        matcher: z.ZodOptional<z.ZodString>;
        hookCallbackIds: z.ZodArray<z.ZodString>;
        timeout: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>>;
    sdkMcpServers: z.ZodOptional<z.ZodArray<z.ZodString>>;
    jsonSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    systemPrompt: z.ZodOptional<z.ZodString>;
    appendSystemPrompt: z.ZodOptional<z.ZodString>;
    agents: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
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
    }, z.core.$strip>>>;
    promptSuggestions: z.ZodOptional<z.ZodBoolean>;
    agentProgressSummaries: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"set_permission_mode">;
    mode: z.ZodEnum<{
        plan: "plan";
        auto: "auto";
        default: "default";
        acceptEdits: "acceptEdits";
        bypassPermissions: "bypassPermissions";
        dontAsk: "dontAsk";
    }>;
    ultraplan: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"set_model">;
    model: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"set_max_thinking_tokens">;
    max_thinking_tokens: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"mcp_status">;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"get_context_usage">;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"hook_callback">;
    callback_id: z.ZodString;
    input: z.ZodUnion<readonly [z.ZodIntersection<z.ZodObject<{
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
    tool_use_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"mcp_message">;
    server_name: z.ZodString;
    message: z.ZodUnknown;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"rewind_files">;
    user_message_id: z.ZodString;
    dry_run: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"cancel_async_message">;
    message_uuid: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"seed_read_state">;
    path: z.ZodString;
    mtime: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"mcp_set_servers">;
    servers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
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
    }, z.core.$strip>]>>;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"reload_plugins">;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"mcp_reconnect">;
    serverName: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"mcp_toggle">;
    serverName: z.ZodString;
    enabled: z.ZodBoolean;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"stop_task">;
    task_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"apply_flag_settings">;
    settings: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"get_settings">;
}, z.core.$strip>, z.ZodObject<{
    subtype: z.ZodLiteral<"elicitation">;
    mcp_server_name: z.ZodString;
    message: z.ZodString;
    mode: z.ZodOptional<z.ZodEnum<{
        url: "url";
        form: "form";
    }>>;
    url: z.ZodOptional<z.ZodString>;
    elicitation_id: z.ZodOptional<z.ZodString>;
    requested_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>]>;
export declare const SDKControlRequestSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"control_request">;
    request_id: z.ZodString;
    request: z.ZodUnion<readonly [z.ZodObject<{
        subtype: z.ZodLiteral<"interrupt">;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"can_use_tool">;
        tool_name: z.ZodString;
        input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
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
        blocked_path: z.ZodOptional<z.ZodString>;
        decision_reason: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        display_name: z.ZodOptional<z.ZodString>;
        tool_use_id: z.ZodString;
        agent_id: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"initialize">;
        hooks: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
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
        }>, z.ZodArray<z.ZodObject<{
            matcher: z.ZodOptional<z.ZodString>;
            hookCallbackIds: z.ZodArray<z.ZodString>;
            timeout: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>>;
        sdkMcpServers: z.ZodOptional<z.ZodArray<z.ZodString>>;
        jsonSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        systemPrompt: z.ZodOptional<z.ZodString>;
        appendSystemPrompt: z.ZodOptional<z.ZodString>;
        agents: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
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
        }, z.core.$strip>>>;
        promptSuggestions: z.ZodOptional<z.ZodBoolean>;
        agentProgressSummaries: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"set_permission_mode">;
        mode: z.ZodEnum<{
            plan: "plan";
            auto: "auto";
            default: "default";
            acceptEdits: "acceptEdits";
            bypassPermissions: "bypassPermissions";
            dontAsk: "dontAsk";
        }>;
        ultraplan: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"set_model">;
        model: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"set_max_thinking_tokens">;
        max_thinking_tokens: z.ZodNullable<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"mcp_status">;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"get_context_usage">;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"hook_callback">;
        callback_id: z.ZodString;
        input: z.ZodUnion<readonly [z.ZodIntersection<z.ZodObject<{
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
        tool_use_id: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"mcp_message">;
        server_name: z.ZodString;
        message: z.ZodUnknown;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"rewind_files">;
        user_message_id: z.ZodString;
        dry_run: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"cancel_async_message">;
        message_uuid: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"seed_read_state">;
        path: z.ZodString;
        mtime: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"mcp_set_servers">;
        servers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$strip>]>>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"reload_plugins">;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"mcp_reconnect">;
        serverName: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"mcp_toggle">;
        serverName: z.ZodString;
        enabled: z.ZodBoolean;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"stop_task">;
        task_id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"apply_flag_settings">;
        settings: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"get_settings">;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"elicitation">;
        mcp_server_name: z.ZodString;
        message: z.ZodString;
        mode: z.ZodOptional<z.ZodEnum<{
            url: "url";
            form: "form";
        }>>;
        url: z.ZodOptional<z.ZodString>;
        elicitation_id: z.ZodOptional<z.ZodString>;
        requested_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>]>;
}, z.core.$strip>;
export declare const ControlResponseSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"success">;
    request_id: z.ZodString;
    response: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const ControlErrorResponseSchema: () => z.ZodObject<{
    subtype: z.ZodLiteral<"error">;
    request_id: z.ZodString;
    error: z.ZodString;
    pending_permission_requests: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodObject<{
        type: z.ZodLiteral<"control_request">;
        request_id: z.ZodString;
        request: z.ZodUnion<readonly [z.ZodObject<{
            subtype: z.ZodLiteral<"interrupt">;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"can_use_tool">;
            tool_name: z.ZodString;
            input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
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
            blocked_path: z.ZodOptional<z.ZodString>;
            decision_reason: z.ZodOptional<z.ZodString>;
            title: z.ZodOptional<z.ZodString>;
            display_name: z.ZodOptional<z.ZodString>;
            tool_use_id: z.ZodString;
            agent_id: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"initialize">;
            hooks: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
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
            }>, z.ZodArray<z.ZodObject<{
                matcher: z.ZodOptional<z.ZodString>;
                hookCallbackIds: z.ZodArray<z.ZodString>;
                timeout: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>>>;
            sdkMcpServers: z.ZodOptional<z.ZodArray<z.ZodString>>;
            jsonSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            systemPrompt: z.ZodOptional<z.ZodString>;
            appendSystemPrompt: z.ZodOptional<z.ZodString>;
            agents: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
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
            }, z.core.$strip>>>;
            promptSuggestions: z.ZodOptional<z.ZodBoolean>;
            agentProgressSummaries: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"set_permission_mode">;
            mode: z.ZodEnum<{
                plan: "plan";
                auto: "auto";
                default: "default";
                acceptEdits: "acceptEdits";
                bypassPermissions: "bypassPermissions";
                dontAsk: "dontAsk";
            }>;
            ultraplan: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"set_model">;
            model: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"set_max_thinking_tokens">;
            max_thinking_tokens: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"mcp_status">;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"get_context_usage">;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"hook_callback">;
            callback_id: z.ZodString;
            input: z.ZodUnion<readonly [z.ZodIntersection<z.ZodObject<{
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
            tool_use_id: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"mcp_message">;
            server_name: z.ZodString;
            message: z.ZodUnknown;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"rewind_files">;
            user_message_id: z.ZodString;
            dry_run: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"cancel_async_message">;
            message_uuid: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"seed_read_state">;
            path: z.ZodString;
            mtime: z.ZodNumber;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"mcp_set_servers">;
            servers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
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
            }, z.core.$strip>]>>;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"reload_plugins">;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"mcp_reconnect">;
            serverName: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"mcp_toggle">;
            serverName: z.ZodString;
            enabled: z.ZodBoolean;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"stop_task">;
            task_id: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"apply_flag_settings">;
            settings: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"get_settings">;
        }, z.core.$strip>, z.ZodObject<{
            subtype: z.ZodLiteral<"elicitation">;
            mcp_server_name: z.ZodString;
            message: z.ZodString;
            mode: z.ZodOptional<z.ZodEnum<{
                url: "url";
                form: "form";
            }>>;
            url: z.ZodOptional<z.ZodString>;
            elicitation_id: z.ZodOptional<z.ZodString>;
            requested_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>]>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
export declare const SDKControlResponseSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"control_response">;
    response: z.ZodUnion<readonly [z.ZodObject<{
        subtype: z.ZodLiteral<"success">;
        request_id: z.ZodString;
        response: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"error">;
        request_id: z.ZodString;
        error: z.ZodString;
        pending_permission_requests: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodObject<{
            type: z.ZodLiteral<"control_request">;
            request_id: z.ZodString;
            request: z.ZodUnion<readonly [z.ZodObject<{
                subtype: z.ZodLiteral<"interrupt">;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"can_use_tool">;
                tool_name: z.ZodString;
                input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
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
                blocked_path: z.ZodOptional<z.ZodString>;
                decision_reason: z.ZodOptional<z.ZodString>;
                title: z.ZodOptional<z.ZodString>;
                display_name: z.ZodOptional<z.ZodString>;
                tool_use_id: z.ZodString;
                agent_id: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"initialize">;
                hooks: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
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
                }>, z.ZodArray<z.ZodObject<{
                    matcher: z.ZodOptional<z.ZodString>;
                    hookCallbackIds: z.ZodArray<z.ZodString>;
                    timeout: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>>>;
                sdkMcpServers: z.ZodOptional<z.ZodArray<z.ZodString>>;
                jsonSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                systemPrompt: z.ZodOptional<z.ZodString>;
                appendSystemPrompt: z.ZodOptional<z.ZodString>;
                agents: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
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
                }, z.core.$strip>>>;
                promptSuggestions: z.ZodOptional<z.ZodBoolean>;
                agentProgressSummaries: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"set_permission_mode">;
                mode: z.ZodEnum<{
                    plan: "plan";
                    auto: "auto";
                    default: "default";
                    acceptEdits: "acceptEdits";
                    bypassPermissions: "bypassPermissions";
                    dontAsk: "dontAsk";
                }>;
                ultraplan: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"set_model">;
                model: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"set_max_thinking_tokens">;
                max_thinking_tokens: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"mcp_status">;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"get_context_usage">;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"hook_callback">;
                callback_id: z.ZodString;
                input: z.ZodUnion<readonly [z.ZodIntersection<z.ZodObject<{
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
                tool_use_id: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"mcp_message">;
                server_name: z.ZodString;
                message: z.ZodUnknown;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"rewind_files">;
                user_message_id: z.ZodString;
                dry_run: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"cancel_async_message">;
                message_uuid: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"seed_read_state">;
                path: z.ZodString;
                mtime: z.ZodNumber;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"mcp_set_servers">;
                servers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
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
                }, z.core.$strip>]>>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"reload_plugins">;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"mcp_reconnect">;
                serverName: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"mcp_toggle">;
                serverName: z.ZodString;
                enabled: z.ZodBoolean;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"stop_task">;
                task_id: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"apply_flag_settings">;
                settings: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"get_settings">;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"elicitation">;
                mcp_server_name: z.ZodString;
                message: z.ZodString;
                mode: z.ZodOptional<z.ZodEnum<{
                    url: "url";
                    form: "form";
                }>>;
                url: z.ZodOptional<z.ZodString>;
                elicitation_id: z.ZodOptional<z.ZodString>;
                requested_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            }, z.core.$strip>]>;
        }, z.core.$strip>>>>;
    }, z.core.$strip>]>;
}, z.core.$strip>;
export declare const SDKControlCancelRequestSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"control_cancel_request">;
    request_id: z.ZodString;
}, z.core.$strip>;
export declare const SDKKeepAliveMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"keep_alive">;
}, z.core.$strip>;
export declare const SDKUpdateEnvironmentVariablesMessageSchema: () => z.ZodObject<{
    type: z.ZodLiteral<"update_environment_variables">;
    variables: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strip>;
export declare const StdoutMessageSchema: () => z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodObject<{
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
}, z.core.$strip>]>, z.ZodObject<{
    type: z.ZodLiteral<"streamlined_text">;
    text: z.ZodString;
    session_id: z.ZodString;
    uuid: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"streamlined_tool_use_summary">;
    tool_summary: z.ZodString;
    session_id: z.ZodString;
    uuid: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
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
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"control_response">;
    response: z.ZodUnion<readonly [z.ZodObject<{
        subtype: z.ZodLiteral<"success">;
        request_id: z.ZodString;
        response: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"error">;
        request_id: z.ZodString;
        error: z.ZodString;
        pending_permission_requests: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodObject<{
            type: z.ZodLiteral<"control_request">;
            request_id: z.ZodString;
            request: z.ZodUnion<readonly [z.ZodObject<{
                subtype: z.ZodLiteral<"interrupt">;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"can_use_tool">;
                tool_name: z.ZodString;
                input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
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
                blocked_path: z.ZodOptional<z.ZodString>;
                decision_reason: z.ZodOptional<z.ZodString>;
                title: z.ZodOptional<z.ZodString>;
                display_name: z.ZodOptional<z.ZodString>;
                tool_use_id: z.ZodString;
                agent_id: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"initialize">;
                hooks: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
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
                }>, z.ZodArray<z.ZodObject<{
                    matcher: z.ZodOptional<z.ZodString>;
                    hookCallbackIds: z.ZodArray<z.ZodString>;
                    timeout: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>>>;
                sdkMcpServers: z.ZodOptional<z.ZodArray<z.ZodString>>;
                jsonSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                systemPrompt: z.ZodOptional<z.ZodString>;
                appendSystemPrompt: z.ZodOptional<z.ZodString>;
                agents: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
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
                }, z.core.$strip>>>;
                promptSuggestions: z.ZodOptional<z.ZodBoolean>;
                agentProgressSummaries: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"set_permission_mode">;
                mode: z.ZodEnum<{
                    plan: "plan";
                    auto: "auto";
                    default: "default";
                    acceptEdits: "acceptEdits";
                    bypassPermissions: "bypassPermissions";
                    dontAsk: "dontAsk";
                }>;
                ultraplan: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"set_model">;
                model: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"set_max_thinking_tokens">;
                max_thinking_tokens: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"mcp_status">;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"get_context_usage">;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"hook_callback">;
                callback_id: z.ZodString;
                input: z.ZodUnion<readonly [z.ZodIntersection<z.ZodObject<{
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
                tool_use_id: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"mcp_message">;
                server_name: z.ZodString;
                message: z.ZodUnknown;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"rewind_files">;
                user_message_id: z.ZodString;
                dry_run: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"cancel_async_message">;
                message_uuid: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"seed_read_state">;
                path: z.ZodString;
                mtime: z.ZodNumber;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"mcp_set_servers">;
                servers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
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
                }, z.core.$strip>]>>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"reload_plugins">;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"mcp_reconnect">;
                serverName: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"mcp_toggle">;
                serverName: z.ZodString;
                enabled: z.ZodBoolean;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"stop_task">;
                task_id: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"apply_flag_settings">;
                settings: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"get_settings">;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"elicitation">;
                mcp_server_name: z.ZodString;
                message: z.ZodString;
                mode: z.ZodOptional<z.ZodEnum<{
                    url: "url";
                    form: "form";
                }>>;
                url: z.ZodOptional<z.ZodString>;
                elicitation_id: z.ZodOptional<z.ZodString>;
                requested_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            }, z.core.$strip>]>;
        }, z.core.$strip>>>>;
    }, z.core.$strip>]>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"control_request">;
    request_id: z.ZodString;
    request: z.ZodUnion<readonly [z.ZodObject<{
        subtype: z.ZodLiteral<"interrupt">;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"can_use_tool">;
        tool_name: z.ZodString;
        input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
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
        blocked_path: z.ZodOptional<z.ZodString>;
        decision_reason: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        display_name: z.ZodOptional<z.ZodString>;
        tool_use_id: z.ZodString;
        agent_id: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"initialize">;
        hooks: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
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
        }>, z.ZodArray<z.ZodObject<{
            matcher: z.ZodOptional<z.ZodString>;
            hookCallbackIds: z.ZodArray<z.ZodString>;
            timeout: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>>;
        sdkMcpServers: z.ZodOptional<z.ZodArray<z.ZodString>>;
        jsonSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        systemPrompt: z.ZodOptional<z.ZodString>;
        appendSystemPrompt: z.ZodOptional<z.ZodString>;
        agents: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
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
        }, z.core.$strip>>>;
        promptSuggestions: z.ZodOptional<z.ZodBoolean>;
        agentProgressSummaries: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"set_permission_mode">;
        mode: z.ZodEnum<{
            plan: "plan";
            auto: "auto";
            default: "default";
            acceptEdits: "acceptEdits";
            bypassPermissions: "bypassPermissions";
            dontAsk: "dontAsk";
        }>;
        ultraplan: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"set_model">;
        model: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"set_max_thinking_tokens">;
        max_thinking_tokens: z.ZodNullable<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"mcp_status">;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"get_context_usage">;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"hook_callback">;
        callback_id: z.ZodString;
        input: z.ZodUnion<readonly [z.ZodIntersection<z.ZodObject<{
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
        tool_use_id: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"mcp_message">;
        server_name: z.ZodString;
        message: z.ZodUnknown;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"rewind_files">;
        user_message_id: z.ZodString;
        dry_run: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"cancel_async_message">;
        message_uuid: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"seed_read_state">;
        path: z.ZodString;
        mtime: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"mcp_set_servers">;
        servers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$strip>]>>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"reload_plugins">;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"mcp_reconnect">;
        serverName: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"mcp_toggle">;
        serverName: z.ZodString;
        enabled: z.ZodBoolean;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"stop_task">;
        task_id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"apply_flag_settings">;
        settings: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"get_settings">;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"elicitation">;
        mcp_server_name: z.ZodString;
        message: z.ZodString;
        mode: z.ZodOptional<z.ZodEnum<{
            url: "url";
            form: "form";
        }>>;
        url: z.ZodOptional<z.ZodString>;
        elicitation_id: z.ZodOptional<z.ZodString>;
        requested_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>]>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"control_cancel_request">;
    request_id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"keep_alive">;
}, z.core.$strip>]>;
export declare const StdinMessageSchema: () => z.ZodUnion<readonly [z.ZodObject<{
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
    type: z.ZodLiteral<"control_request">;
    request_id: z.ZodString;
    request: z.ZodUnion<readonly [z.ZodObject<{
        subtype: z.ZodLiteral<"interrupt">;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"can_use_tool">;
        tool_name: z.ZodString;
        input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
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
        blocked_path: z.ZodOptional<z.ZodString>;
        decision_reason: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        display_name: z.ZodOptional<z.ZodString>;
        tool_use_id: z.ZodString;
        agent_id: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"initialize">;
        hooks: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
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
        }>, z.ZodArray<z.ZodObject<{
            matcher: z.ZodOptional<z.ZodString>;
            hookCallbackIds: z.ZodArray<z.ZodString>;
            timeout: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>>;
        sdkMcpServers: z.ZodOptional<z.ZodArray<z.ZodString>>;
        jsonSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        systemPrompt: z.ZodOptional<z.ZodString>;
        appendSystemPrompt: z.ZodOptional<z.ZodString>;
        agents: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
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
        }, z.core.$strip>>>;
        promptSuggestions: z.ZodOptional<z.ZodBoolean>;
        agentProgressSummaries: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"set_permission_mode">;
        mode: z.ZodEnum<{
            plan: "plan";
            auto: "auto";
            default: "default";
            acceptEdits: "acceptEdits";
            bypassPermissions: "bypassPermissions";
            dontAsk: "dontAsk";
        }>;
        ultraplan: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"set_model">;
        model: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"set_max_thinking_tokens">;
        max_thinking_tokens: z.ZodNullable<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"mcp_status">;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"get_context_usage">;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"hook_callback">;
        callback_id: z.ZodString;
        input: z.ZodUnion<readonly [z.ZodIntersection<z.ZodObject<{
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
        tool_use_id: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"mcp_message">;
        server_name: z.ZodString;
        message: z.ZodUnknown;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"rewind_files">;
        user_message_id: z.ZodString;
        dry_run: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"cancel_async_message">;
        message_uuid: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"seed_read_state">;
        path: z.ZodString;
        mtime: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"mcp_set_servers">;
        servers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$strip>]>>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"reload_plugins">;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"mcp_reconnect">;
        serverName: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"mcp_toggle">;
        serverName: z.ZodString;
        enabled: z.ZodBoolean;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"stop_task">;
        task_id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"apply_flag_settings">;
        settings: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"get_settings">;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"elicitation">;
        mcp_server_name: z.ZodString;
        message: z.ZodString;
        mode: z.ZodOptional<z.ZodEnum<{
            url: "url";
            form: "form";
        }>>;
        url: z.ZodOptional<z.ZodString>;
        elicitation_id: z.ZodOptional<z.ZodString>;
        requested_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>]>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"control_response">;
    response: z.ZodUnion<readonly [z.ZodObject<{
        subtype: z.ZodLiteral<"success">;
        request_id: z.ZodString;
        response: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        subtype: z.ZodLiteral<"error">;
        request_id: z.ZodString;
        error: z.ZodString;
        pending_permission_requests: z.ZodOptional<z.ZodArray<z.ZodLazy<z.ZodObject<{
            type: z.ZodLiteral<"control_request">;
            request_id: z.ZodString;
            request: z.ZodUnion<readonly [z.ZodObject<{
                subtype: z.ZodLiteral<"interrupt">;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"can_use_tool">;
                tool_name: z.ZodString;
                input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
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
                blocked_path: z.ZodOptional<z.ZodString>;
                decision_reason: z.ZodOptional<z.ZodString>;
                title: z.ZodOptional<z.ZodString>;
                display_name: z.ZodOptional<z.ZodString>;
                tool_use_id: z.ZodString;
                agent_id: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"initialize">;
                hooks: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
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
                }>, z.ZodArray<z.ZodObject<{
                    matcher: z.ZodOptional<z.ZodString>;
                    hookCallbackIds: z.ZodArray<z.ZodString>;
                    timeout: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>>>;
                sdkMcpServers: z.ZodOptional<z.ZodArray<z.ZodString>>;
                jsonSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                systemPrompt: z.ZodOptional<z.ZodString>;
                appendSystemPrompt: z.ZodOptional<z.ZodString>;
                agents: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
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
                }, z.core.$strip>>>;
                promptSuggestions: z.ZodOptional<z.ZodBoolean>;
                agentProgressSummaries: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"set_permission_mode">;
                mode: z.ZodEnum<{
                    plan: "plan";
                    auto: "auto";
                    default: "default";
                    acceptEdits: "acceptEdits";
                    bypassPermissions: "bypassPermissions";
                    dontAsk: "dontAsk";
                }>;
                ultraplan: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"set_model">;
                model: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"set_max_thinking_tokens">;
                max_thinking_tokens: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"mcp_status">;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"get_context_usage">;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"hook_callback">;
                callback_id: z.ZodString;
                input: z.ZodUnion<readonly [z.ZodIntersection<z.ZodObject<{
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
                tool_use_id: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"mcp_message">;
                server_name: z.ZodString;
                message: z.ZodUnknown;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"rewind_files">;
                user_message_id: z.ZodString;
                dry_run: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"cancel_async_message">;
                message_uuid: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"seed_read_state">;
                path: z.ZodString;
                mtime: z.ZodNumber;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"mcp_set_servers">;
                servers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
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
                }, z.core.$strip>]>>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"reload_plugins">;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"mcp_reconnect">;
                serverName: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"mcp_toggle">;
                serverName: z.ZodString;
                enabled: z.ZodBoolean;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"stop_task">;
                task_id: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"apply_flag_settings">;
                settings: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"get_settings">;
            }, z.core.$strip>, z.ZodObject<{
                subtype: z.ZodLiteral<"elicitation">;
                mcp_server_name: z.ZodString;
                message: z.ZodString;
                mode: z.ZodOptional<z.ZodEnum<{
                    url: "url";
                    form: "form";
                }>>;
                url: z.ZodOptional<z.ZodString>;
                elicitation_id: z.ZodOptional<z.ZodString>;
                requested_schema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            }, z.core.$strip>]>;
        }, z.core.$strip>>>>;
    }, z.core.$strip>]>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"keep_alive">;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"update_environment_variables">;
    variables: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strip>]>;
//# sourceMappingURL=controlSchemas.d.ts.map