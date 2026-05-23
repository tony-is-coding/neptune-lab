import { z } from 'zod/v4';
export { type AgentHook, type BashCommandHook, type HookCommand, HookCommandSchema, type HookMatcher, HookMatcherSchema, HooksSchema, type HooksSettings, type HttpHook, type PromptHook, } from '../../schemas/hooks.js';
import { type HookCommand } from '../../schemas/hooks.js';
/**
 * Schema for environment variables
 */
export declare const EnvironmentVariablesSchema: () => z.ZodRecord<z.ZodString, z.ZodCoercedString<unknown>>;
/**
 * Schema for permissions section
 */
export declare const PermissionsSchema: () => z.ZodObject<{
    additionalDirectories: z.ZodOptional<z.ZodArray<z.ZodString>>;
    disableAutoMode?: z.ZodOptional<z.ZodEnum<{
        disable: "disable";
    }>>;
    allow: z.ZodOptional<z.ZodArray<z.ZodString>>;
    deny: z.ZodOptional<z.ZodArray<z.ZodString>>;
    ask: z.ZodOptional<z.ZodArray<z.ZodString>>;
    defaultMode: z.ZodOptional<z.ZodEnum<{
        plan: "plan";
        auto: "auto";
        default: "default";
        acceptEdits: "acceptEdits";
        bypassPermissions: "bypassPermissions";
        dontAsk: "dontAsk";
    }>>;
    disableBypassPermissionsMode: z.ZodOptional<z.ZodEnum<{
        disable: "disable";
    }>>;
}, z.core.$loose>;
/**
 * Schema for extra marketplaces defined in repository settings
 * Same as KnownMarketplace but without lastUpdated (which is managed automatically)
 */
export declare const ExtraKnownMarketplaceSchema: () => z.ZodObject<{
    source: z.ZodDiscriminatedUnion<[z.ZodObject<{
        source: z.ZodLiteral<"url">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"github">;
        repo: z.ZodString;
        ref: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
        sparsePaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"git">;
        url: z.ZodString;
        ref: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
        sparsePaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"npm">;
        package: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"file">;
        path: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"directory">;
        path: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"hostPattern">;
        hostPattern: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"pathPattern">;
        pathPattern: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"settings">;
        name: z.ZodString;
        plugins: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            source: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                source: z.ZodLiteral<"npm">;
                package: z.ZodUnion<[z.ZodString, z.ZodString]>;
                version: z.ZodOptional<z.ZodString>;
                registry: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                source: z.ZodLiteral<"pip">;
                package: z.ZodString;
                version: z.ZodOptional<z.ZodString>;
                registry: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                source: z.ZodLiteral<"url">;
                url: z.ZodString;
                ref: z.ZodOptional<z.ZodString>;
                sha: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                source: z.ZodLiteral<"github">;
                repo: z.ZodString;
                ref: z.ZodOptional<z.ZodString>;
                sha: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                source: z.ZodLiteral<"git-subdir">;
                url: z.ZodString;
                path: z.ZodString;
                ref: z.ZodOptional<z.ZodString>;
                sha: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            description: z.ZodOptional<z.ZodString>;
            version: z.ZodOptional<z.ZodString>;
            strict: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
        owner: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            email: z.ZodOptional<z.ZodString>;
            url: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>], "source">;
    installLocation: z.ZodOptional<z.ZodString>;
    autoUpdate: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
/**
 * Schema for allowed MCP server entry in enterprise allowlist.
 * Supports matching by serverName, serverCommand, or serverUrl (mutually exclusive).
 */
export declare const AllowedMcpServerEntrySchema: () => z.ZodObject<{
    serverName: z.ZodOptional<z.ZodString>;
    serverCommand: z.ZodOptional<z.ZodArray<z.ZodString>>;
    serverUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Schema for denied MCP server entry in enterprise denylist.
 * Supports matching by serverName, serverCommand, or serverUrl (mutually exclusive).
 */
export declare const DeniedMcpServerEntrySchema: () => z.ZodObject<{
    serverName: z.ZodOptional<z.ZodString>;
    serverCommand: z.ZodOptional<z.ZodArray<z.ZodString>>;
    serverUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Unified schema for settings files
 *
 * ⚠️ BACKWARD COMPATIBILITY NOTICE ⚠️
 *
 * This schema defines the structure of user settings files (.claude/settings.json).
 * We support backward-compatible changes! Here's how:
 *
 * ✅ ALLOWED CHANGES:
 * - Adding new optional fields (always use .optional())
 * - Adding new enum values (keeping existing ones)
 * - Adding new properties to objects
 * - Making validation more permissive
 * - Using union types for gradual migration (e.g., z.union([oldType, newType]))
 *
 * ❌ BREAKING CHANGES TO AVOID:
 * - Removing fields (mark as deprecated instead)
 * - Removing enum values
 * - Making optional fields required
 * - Making types more restrictive
 * - Renaming fields without keeping the old name
 *
 * TO ENSURE BACKWARD COMPATIBILITY:
 * 1. Run: npm run test:file -- test/utils/settings/backward-compatibility.test.ts
 * 2. If tests fail, you've introduced a breaking change
 * 3. When adding new fields, add a test to BACKWARD_COMPATIBILITY_CONFIGS
 *
 * The settings system handles backward compatibility automatically:
 * - When updating settings, invalid fields are preserved in the file (see settings.ts lines 233-249)
 * - Type coercion via z.coerce (e.g., env vars convert numbers to strings)
 * - .passthrough() preserves unknown fields in permissions object
 * - Invalid settings are simply not used, but remain in the file to be fixed by the user
 */
/**
 * Surfaces lockable by `strictPluginOnlyCustomization`. Exported so the
 * schema preprocess (below) and the runtime helper (pluginOnlyPolicy.ts)
 * share one source of truth.
 */
export declare const CUSTOMIZATION_SURFACES: readonly ["skills", "agents", "hooks", "mcp"];
export declare const SettingsSchema: () => z.ZodObject<{
    disableAutoMode: z.ZodOptional<z.ZodEnum<{
        disable: "disable";
    }>>;
    sshConfigs: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        sshHost: z.ZodString;
        sshPort: z.ZodOptional<z.ZodNumber>;
        sshIdentityFile: z.ZodOptional<z.ZodString>;
        startDirectory: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    claudeMdExcludes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    pluginTrustMessage: z.ZodOptional<z.ZodString>;
    skipAutoPermissionPrompt?: z.ZodOptional<z.ZodBoolean>;
    useAutoModeDuringPlan?: z.ZodOptional<z.ZodBoolean>;
    autoMode?: z.ZodOptional<z.ZodObject<{
        environment: z.ZodOptional<z.ZodArray<z.ZodString>>;
        deny?: z.ZodOptional<z.ZodArray<z.ZodString>>;
        allow: z.ZodOptional<z.ZodArray<z.ZodString>>;
        soft_deny: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    prefersReducedMotion: z.ZodOptional<z.ZodBoolean>;
    autoMemoryEnabled: z.ZodOptional<z.ZodBoolean>;
    autoMemoryDirectory: z.ZodOptional<z.ZodString>;
    autoDreamEnabled: z.ZodOptional<z.ZodBoolean>;
    showThinkingSummaries: z.ZodOptional<z.ZodBoolean>;
    skipDangerousModePermissionPrompt: z.ZodOptional<z.ZodBoolean>;
    defaultView?: z.ZodOptional<z.ZodEnum<{
        chat: "chat";
        transcript: "transcript";
    }>>;
    channelsEnabled: z.ZodOptional<z.ZodBoolean>;
    allowedChannelPlugins: z.ZodOptional<z.ZodArray<z.ZodObject<{
        marketplace: z.ZodString;
        plugin: z.ZodString;
    }, z.core.$strip>>>;
    assistant?: z.ZodOptional<z.ZodBoolean>;
    assistantName?: z.ZodOptional<z.ZodString>;
    voiceEnabled?: z.ZodOptional<z.ZodBoolean>;
    minSleepDurationMs?: z.ZodOptional<z.ZodNumber>;
    maxSleepDurationMs?: z.ZodOptional<z.ZodNumber>;
    classifierPermissionsEnabled?: z.ZodOptional<z.ZodBoolean>;
    minimumVersion: z.ZodOptional<z.ZodString>;
    plansDirectory: z.ZodOptional<z.ZodString>;
    disableDeepLinkRegistration?: z.ZodOptional<z.ZodEnum<{
        disable: "disable";
    }>>;
    fileSuggestion: z.ZodOptional<z.ZodObject<{
        type: z.ZodLiteral<"command">;
        command: z.ZodString;
    }, z.core.$strip>>;
    respectGitignore: z.ZodOptional<z.ZodBoolean>;
    cleanupPeriodDays: z.ZodOptional<z.ZodNumber>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodCoercedString<unknown>>>;
    attribution: z.ZodOptional<z.ZodObject<{
        commit: z.ZodOptional<z.ZodString>;
        pr: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    includeCoAuthoredBy: z.ZodOptional<z.ZodBoolean>;
    includeGitInstructions: z.ZodOptional<z.ZodBoolean>;
    permissions: z.ZodOptional<z.ZodObject<{
        additionalDirectories: z.ZodOptional<z.ZodArray<z.ZodString>>;
        disableAutoMode?: z.ZodOptional<z.ZodEnum<{
            disable: "disable";
        }>>;
        allow: z.ZodOptional<z.ZodArray<z.ZodString>>;
        deny: z.ZodOptional<z.ZodArray<z.ZodString>>;
        ask: z.ZodOptional<z.ZodArray<z.ZodString>>;
        defaultMode: z.ZodOptional<z.ZodEnum<{
            plan: "plan";
            auto: "auto";
            default: "default";
            acceptEdits: "acceptEdits";
            bypassPermissions: "bypassPermissions";
            dontAsk: "dontAsk";
        }>>;
        disableBypassPermissionsMode: z.ZodOptional<z.ZodEnum<{
            disable: "disable";
        }>>;
    }, z.core.$loose>>;
    modelType: z.ZodOptional<z.ZodEnum<{
        openai: "openai";
        gemini: "gemini";
        grok: "grok";
        anthropic: "anthropic";
    }>>;
    model: z.ZodOptional<z.ZodString>;
    availableModels: z.ZodOptional<z.ZodArray<z.ZodString>>;
    modelOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    enableAllProjectMcpServers: z.ZodOptional<z.ZodBoolean>;
    enabledMcpjsonServers: z.ZodOptional<z.ZodArray<z.ZodString>>;
    disabledMcpjsonServers: z.ZodOptional<z.ZodArray<z.ZodString>>;
    allowedMcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
        serverName: z.ZodOptional<z.ZodString>;
        serverCommand: z.ZodOptional<z.ZodArray<z.ZodString>>;
        serverUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    deniedMcpServers: z.ZodOptional<z.ZodArray<z.ZodObject<{
        serverName: z.ZodOptional<z.ZodString>;
        serverCommand: z.ZodOptional<z.ZodArray<z.ZodString>>;
        serverUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    hooks: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
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
    }, z.core.$strip>>>>;
    worktree: z.ZodOptional<z.ZodObject<{
        symlinkDirectories: z.ZodOptional<z.ZodArray<z.ZodString>>;
        sparsePaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    disableAllHooks: z.ZodOptional<z.ZodBoolean>;
    defaultShell: z.ZodOptional<z.ZodEnum<{
        bash: "bash";
        powershell: "powershell";
    }>>;
    allowManagedHooksOnly: z.ZodOptional<z.ZodBoolean>;
    allowedHttpHookUrls: z.ZodOptional<z.ZodArray<z.ZodString>>;
    httpHookAllowedEnvVars: z.ZodOptional<z.ZodArray<z.ZodString>>;
    allowManagedPermissionRulesOnly: z.ZodOptional<z.ZodBoolean>;
    allowManagedMcpServersOnly: z.ZodOptional<z.ZodBoolean>;
    strictPluginOnlyCustomization: z.ZodCatch<z.ZodOptional<z.ZodPreprocess<z.ZodUnion<readonly [z.ZodBoolean, z.ZodArray<z.ZodEnum<{
        mcp: "mcp";
        hooks: "hooks";
        skills: "skills";
        agents: "agents";
    }>>]>>>>;
    statusLine: z.ZodOptional<z.ZodObject<{
        type: z.ZodLiteral<"command">;
        command: z.ZodString;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    enabledPlugins: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodArray<z.ZodString>, z.ZodBoolean, z.ZodUndefined]>>>;
    extraKnownMarketplaces: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        source: z.ZodDiscriminatedUnion<[z.ZodObject<{
            source: z.ZodLiteral<"url">;
            url: z.ZodString;
            headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, z.core.$strip>, z.ZodObject<{
            source: z.ZodLiteral<"github">;
            repo: z.ZodString;
            ref: z.ZodOptional<z.ZodString>;
            path: z.ZodOptional<z.ZodString>;
            sparsePaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>, z.ZodObject<{
            source: z.ZodLiteral<"git">;
            url: z.ZodString;
            ref: z.ZodOptional<z.ZodString>;
            path: z.ZodOptional<z.ZodString>;
            sparsePaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>, z.ZodObject<{
            source: z.ZodLiteral<"npm">;
            package: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            source: z.ZodLiteral<"file">;
            path: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            source: z.ZodLiteral<"directory">;
            path: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            source: z.ZodLiteral<"hostPattern">;
            hostPattern: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            source: z.ZodLiteral<"pathPattern">;
            pathPattern: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            source: z.ZodLiteral<"settings">;
            name: z.ZodString;
            plugins: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                source: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                    source: z.ZodLiteral<"npm">;
                    package: z.ZodUnion<[z.ZodString, z.ZodString]>;
                    version: z.ZodOptional<z.ZodString>;
                    registry: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>, z.ZodObject<{
                    source: z.ZodLiteral<"pip">;
                    package: z.ZodString;
                    version: z.ZodOptional<z.ZodString>;
                    registry: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>, z.ZodObject<{
                    source: z.ZodLiteral<"url">;
                    url: z.ZodString;
                    ref: z.ZodOptional<z.ZodString>;
                    sha: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>, z.ZodObject<{
                    source: z.ZodLiteral<"github">;
                    repo: z.ZodString;
                    ref: z.ZodOptional<z.ZodString>;
                    sha: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>, z.ZodObject<{
                    source: z.ZodLiteral<"git-subdir">;
                    url: z.ZodString;
                    path: z.ZodString;
                    ref: z.ZodOptional<z.ZodString>;
                    sha: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>]>;
                description: z.ZodOptional<z.ZodString>;
                version: z.ZodOptional<z.ZodString>;
                strict: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            owner: z.ZodOptional<z.ZodObject<{
                name: z.ZodString;
                email: z.ZodOptional<z.ZodString>;
                url: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>], "source">;
        installLocation: z.ZodOptional<z.ZodString>;
        autoUpdate: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>;
    strictKnownMarketplaces: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        source: z.ZodLiteral<"url">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"github">;
        repo: z.ZodString;
        ref: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
        sparsePaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"git">;
        url: z.ZodString;
        ref: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
        sparsePaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"npm">;
        package: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"file">;
        path: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"directory">;
        path: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"hostPattern">;
        hostPattern: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"pathPattern">;
        pathPattern: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"settings">;
        name: z.ZodString;
        plugins: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            source: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                source: z.ZodLiteral<"npm">;
                package: z.ZodUnion<[z.ZodString, z.ZodString]>;
                version: z.ZodOptional<z.ZodString>;
                registry: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                source: z.ZodLiteral<"pip">;
                package: z.ZodString;
                version: z.ZodOptional<z.ZodString>;
                registry: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                source: z.ZodLiteral<"url">;
                url: z.ZodString;
                ref: z.ZodOptional<z.ZodString>;
                sha: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                source: z.ZodLiteral<"github">;
                repo: z.ZodString;
                ref: z.ZodOptional<z.ZodString>;
                sha: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                source: z.ZodLiteral<"git-subdir">;
                url: z.ZodString;
                path: z.ZodString;
                ref: z.ZodOptional<z.ZodString>;
                sha: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            description: z.ZodOptional<z.ZodString>;
            version: z.ZodOptional<z.ZodString>;
            strict: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
        owner: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            email: z.ZodOptional<z.ZodString>;
            url: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>], "source">>>;
    blockedMarketplaces: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        source: z.ZodLiteral<"url">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"github">;
        repo: z.ZodString;
        ref: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
        sparsePaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"git">;
        url: z.ZodString;
        ref: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
        sparsePaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"npm">;
        package: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"file">;
        path: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"directory">;
        path: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"hostPattern">;
        hostPattern: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"pathPattern">;
        pathPattern: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        source: z.ZodLiteral<"settings">;
        name: z.ZodString;
        plugins: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            source: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
                source: z.ZodLiteral<"npm">;
                package: z.ZodUnion<[z.ZodString, z.ZodString]>;
                version: z.ZodOptional<z.ZodString>;
                registry: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                source: z.ZodLiteral<"pip">;
                package: z.ZodString;
                version: z.ZodOptional<z.ZodString>;
                registry: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                source: z.ZodLiteral<"url">;
                url: z.ZodString;
                ref: z.ZodOptional<z.ZodString>;
                sha: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                source: z.ZodLiteral<"github">;
                repo: z.ZodString;
                ref: z.ZodOptional<z.ZodString>;
                sha: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>, z.ZodObject<{
                source: z.ZodLiteral<"git-subdir">;
                url: z.ZodString;
                path: z.ZodString;
                ref: z.ZodOptional<z.ZodString>;
                sha: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>]>;
            description: z.ZodOptional<z.ZodString>;
            version: z.ZodOptional<z.ZodString>;
            strict: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
        owner: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            email: z.ZodOptional<z.ZodString>;
            url: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>], "source">>>;
    forceLoginMethod: z.ZodOptional<z.ZodEnum<{
        claudeai: "claudeai";
        console: "console";
    }>>;
    forceLoginOrgUUID: z.ZodOptional<z.ZodString>;
    otelHeadersHelper: z.ZodOptional<z.ZodString>;
    outputStyle: z.ZodOptional<z.ZodString>;
    language: z.ZodOptional<z.ZodString>;
    skipWebFetchPreflight: z.ZodOptional<z.ZodBoolean>;
    sandbox: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodOptional<z.ZodBoolean>;
        failIfUnavailable: z.ZodOptional<z.ZodBoolean>;
        autoAllowBashIfSandboxed: z.ZodOptional<z.ZodBoolean>;
        allowUnsandboxedCommands: z.ZodOptional<z.ZodBoolean>;
        network: z.ZodOptional<z.ZodObject<{
            allowedDomains: z.ZodOptional<z.ZodArray<z.ZodString>>;
            allowManagedDomainsOnly: z.ZodOptional<z.ZodBoolean>;
            allowUnixSockets: z.ZodOptional<z.ZodArray<z.ZodString>>;
            allowAllUnixSockets: z.ZodOptional<z.ZodBoolean>;
            allowLocalBinding: z.ZodOptional<z.ZodBoolean>;
            httpProxyPort: z.ZodOptional<z.ZodNumber>;
            socksProxyPort: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        filesystem: z.ZodOptional<z.ZodObject<{
            allowWrite: z.ZodOptional<z.ZodArray<z.ZodString>>;
            denyWrite: z.ZodOptional<z.ZodArray<z.ZodString>>;
            denyRead: z.ZodOptional<z.ZodArray<z.ZodString>>;
            allowRead: z.ZodOptional<z.ZodArray<z.ZodString>>;
            allowManagedReadPathsOnly: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
        ignoreViolations: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
        enableWeakerNestedSandbox: z.ZodOptional<z.ZodBoolean>;
        enableWeakerNetworkIsolation: z.ZodOptional<z.ZodBoolean>;
        excludedCommands: z.ZodOptional<z.ZodArray<z.ZodString>>;
        ripgrep: z.ZodOptional<z.ZodObject<{
            command: z.ZodString;
            args: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
    }, z.core.$loose>>;
    feedbackSurveyRate: z.ZodOptional<z.ZodNumber>;
    spinnerTipsEnabled: z.ZodOptional<z.ZodBoolean>;
    spinnerVerbs: z.ZodOptional<z.ZodObject<{
        mode: z.ZodEnum<{
            replace: "replace";
            append: "append";
        }>;
        verbs: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    spinnerTipsOverride: z.ZodOptional<z.ZodObject<{
        excludeDefault: z.ZodOptional<z.ZodBoolean>;
        tips: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    syntaxHighlightingDisabled: z.ZodOptional<z.ZodBoolean>;
    terminalTitleFromRename: z.ZodOptional<z.ZodBoolean>;
    alwaysThinkingEnabled: z.ZodOptional<z.ZodBoolean>;
    effortLevel: z.ZodCatch<z.ZodOptional<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        max: "max";
    }>>>;
    advisorModel: z.ZodOptional<z.ZodString>;
    fastMode: z.ZodOptional<z.ZodBoolean>;
    fastModePerSessionOptIn: z.ZodOptional<z.ZodBoolean>;
    promptSuggestionEnabled: z.ZodOptional<z.ZodBoolean>;
    poorMode: z.ZodOptional<z.ZodBoolean>;
    showClearContextOnPlanAccept: z.ZodOptional<z.ZodBoolean>;
    agent: z.ZodOptional<z.ZodString>;
    companyAnnouncements: z.ZodOptional<z.ZodArray<z.ZodString>>;
    pluginConfigs: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        mcpServers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>>>;
        options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>>;
    }, z.core.$strip>>>;
    remote: z.ZodOptional<z.ZodObject<{
        defaultEnvironmentId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    autoUpdatesChannel: z.ZodOptional<z.ZodEnum<{
        latest: "latest";
        stable: "stable";
    }>>;
    xaaIdp?: z.ZodOptional<z.ZodObject<{
        issuer: z.ZodString;
        clientId: z.ZodString;
        callbackPort: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    $schema: z.ZodOptional<z.ZodLiteral<"https://json.schemastore.org/claude-code-settings.json">>;
    apiKeyHelper: z.ZodOptional<z.ZodString>;
    awsCredentialExport: z.ZodOptional<z.ZodString>;
    awsAuthRefresh: z.ZodOptional<z.ZodString>;
    gcpAuthRefresh: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
/**
 * Internal type for plugin hooks - includes plugin context for execution.
 * Not a Zod schema since it's not user-facing (plugins provide native hooks).
 */
export type PluginHookMatcher = {
    matcher?: string;
    hooks: HookCommand[];
    pluginRoot: string;
    pluginName: string;
    pluginId: string;
};
/**
 * Internal type for skill hooks - includes skill context for execution.
 * Not a Zod schema since it's not user-facing (skills provide native hooks).
 */
export type SkillHookMatcher = {
    matcher?: string;
    hooks: HookCommand[];
    skillRoot: string;
    skillName: string;
};
export type AllowedMcpServerEntry = z.infer<ReturnType<typeof AllowedMcpServerEntrySchema>>;
export type DeniedMcpServerEntry = z.infer<ReturnType<typeof DeniedMcpServerEntrySchema>>;
export type SettingsJson = z.infer<ReturnType<typeof SettingsSchema>>;
/**
 * Type guard for MCP server entry with serverName
 */
export declare function isMcpServerNameEntry(entry: AllowedMcpServerEntry | DeniedMcpServerEntry): entry is {
    serverName: string;
};
/**
 * Type guard for MCP server entry with serverCommand
 */
export declare function isMcpServerCommandEntry(entry: AllowedMcpServerEntry | DeniedMcpServerEntry): entry is {
    serverCommand: string[];
};
/**
 * Type guard for MCP server entry with serverUrl
 */
export declare function isMcpServerUrlEntry(entry: AllowedMcpServerEntry | DeniedMcpServerEntry): entry is {
    serverUrl: string;
};
/**
 * User configuration values for MCPB MCP servers
 */
export type UserConfigValues = Record<string, string | number | boolean | string[]>;
/**
 * Plugin configuration stored in settings.json
 */
export type PluginConfig = {
    mcpServers?: {
        [serverName: string]: UserConfigValues;
    };
};
//# sourceMappingURL=types.d.ts.map