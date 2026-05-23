import { z } from 'zod/v4';
/**
 * First-layer defense against official marketplace impersonation.
 *
 * This validation blocks direct impersonation attempts like "anthropic-official",
 * "claude-marketplace", etc. Indirect variations (e.g., "my-claude-marketplace")
 * are not blocked intentionally to avoid false positives on legitimate names.
 * Source org verification provides additional protection at registration/install time.
 */
/**
 * Official marketplace names that are reserved for Anthropic/Claude official use.
 * These names are allowed ONLY for official marketplaces and blocked for third parties.
 */
export declare const ALLOWED_OFFICIAL_MARKETPLACE_NAMES: Set<string>;
/**
 * Check if auto-update is enabled for a marketplace.
 * Uses the stored value if set, otherwise defaults based on whether
 * it's an official Anthropic marketplace (true) or not (false).
 * Official marketplaces in NO_AUTO_UPDATE_OFFICIAL_MARKETPLACES are excluded
 * from the auto-update default.
 *
 * @param marketplaceName - The name of the marketplace
 * @param entry - The marketplace entry (may have autoUpdate set)
 * @returns Whether auto-update is enabled for this marketplace
 */
export declare function isMarketplaceAutoUpdate(marketplaceName: string, entry: {
    autoUpdate?: boolean;
}): boolean;
/**
 * Pattern to detect names that impersonate official Anthropic/Claude marketplaces.
 *
 * Matches names containing variations like:
 * - "official" combined with "anthropic" or "claude" (e.g., "official-claude-plugins")
 * - "anthropic" or "claude" combined with "official" (e.g., "claude-official")
 * - Names starting with "anthropic" or "claude" followed by official-sounding terms
 *   like "marketplace", "plugins" (e.g., "anthropic-marketplace-new", "claude-plugins-v2")
 *
 * The pattern is case-insensitive.
 */
export declare const BLOCKED_OFFICIAL_NAME_PATTERN: RegExp;
/**
 * Check if a marketplace name impersonates an official Anthropic/Claude marketplace.
 *
 * @param name - The marketplace name to check
 * @returns true if the name is blocked (impersonates official), false if allowed
 */
export declare function isBlockedOfficialName(name: string): boolean;
/**
 * The official GitHub organization for Anthropic marketplaces.
 * Reserved names must come from this org.
 */
export declare const OFFICIAL_GITHUB_ORG = "anthropics";
/**
 * Validate that a marketplace with a reserved name comes from the official source.
 *
 * Reserved names (in ALLOWED_OFFICIAL_MARKETPLACE_NAMES) can only be used by
 * marketplaces from the official Anthropic GitHub organization.
 *
 * @param name - The marketplace name
 * @param source - The marketplace source configuration
 * @returns An error message if validation fails, or null if valid
 */
export declare function validateOfficialNameSource(name: string, source: {
    source: string;
    repo?: string;
    url?: string;
}): string | null;
/**
 * Schema for plugin author information
 */
export declare const PluginAuthorSchema: () => z.ZodObject<{
    name: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Schema for plugin hooks configuration (hooks.json)
 *
 * Defines the hooks that a plugin can provide to intercept and modify
 * Claude Code behavior at various lifecycle events.
 */
export declare const PluginHooksSchema: () => z.ZodObject<{
    description: z.ZodOptional<z.ZodString>;
    hooks: z.ZodLazy<z.ZodRecord<z.ZodEnum<{
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
}, z.core.$strip>;
/**
 * Schema for command metadata when using object-mapping format
 *
 * Allows marketplace entries to provide rich metadata for commands including
 * custom descriptions and frontmatter overrides.
 *
 * Commands can be defined with either:
 * - source: Path to a markdown file
 * - content: Inline markdown content
 */
export declare const CommandMetadataSchema: () => z.ZodObject<{
    source: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodString]>>;
    content: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    argumentHint: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    allowedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
/**
 * Schema for individual LSP server configuration.
 */
export declare const LspServerConfigSchema: () => z.ZodObject<{
    command: z.ZodString;
    args: z.ZodOptional<z.ZodArray<z.ZodString>>;
    extensionToLanguage: z.ZodRecord<z.ZodString, z.ZodString>;
    transport: z.ZodDefault<z.ZodEnum<{
        stdio: "stdio";
        socket: "socket";
    }>>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    initializationOptions: z.ZodOptional<z.ZodUnknown>;
    settings: z.ZodOptional<z.ZodUnknown>;
    workspaceFolder: z.ZodOptional<z.ZodString>;
    startupTimeout: z.ZodOptional<z.ZodNumber>;
    shutdownTimeout: z.ZodOptional<z.ZodNumber>;
    restartOnCrash: z.ZodOptional<z.ZodBoolean>;
    maxRestarts: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
/**
 * Plugin manifest file (plugin.json)
 *
 * This schema validates the structure of plugin manifests and provides
 * runtime type checking when loading plugins from disk.
 *
 * Unknown top-level fields are silently stripped (zod default) rather than
 * rejected. This keeps plugin loading resilient to custom/future top-level
 * fields that plugin authors may add. Nested config objects (userConfig
 * options, channels, lspServers) remain strict — unknown keys inside those
 * still fail, since a typo there is more likely to be an author mistake
 * than a vendor extension. Type mismatches and other validation errors
 * still fail at all levels. For developer feedback on unknown top-level
 * fields, use `claude plugin validate`.
 */
export declare const PluginManifestSchema: () => z.ZodObject<{
    userConfig: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        type: z.ZodEnum<{
            string: "string";
            number: "number";
            boolean: "boolean";
            file: "file";
            directory: "directory";
        }>;
        title: z.ZodString;
        description: z.ZodString;
        required: z.ZodOptional<z.ZodBoolean>;
        default: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
        multiple: z.ZodOptional<z.ZodBoolean>;
        sensitive: z.ZodOptional<z.ZodBoolean>;
        min: z.ZodOptional<z.ZodNumber>;
        max: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>>>;
    settings: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    lspServers: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
        command: z.ZodString;
        args: z.ZodOptional<z.ZodArray<z.ZodString>>;
        extensionToLanguage: z.ZodRecord<z.ZodString, z.ZodString>;
        transport: z.ZodDefault<z.ZodEnum<{
            stdio: "stdio";
            socket: "socket";
        }>>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        initializationOptions: z.ZodOptional<z.ZodUnknown>;
        settings: z.ZodOptional<z.ZodUnknown>;
        workspaceFolder: z.ZodOptional<z.ZodString>;
        startupTimeout: z.ZodOptional<z.ZodNumber>;
        shutdownTimeout: z.ZodOptional<z.ZodNumber>;
        restartOnCrash: z.ZodOptional<z.ZodBoolean>;
        maxRestarts: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
        command: z.ZodString;
        args: z.ZodOptional<z.ZodArray<z.ZodString>>;
        extensionToLanguage: z.ZodRecord<z.ZodString, z.ZodString>;
        transport: z.ZodDefault<z.ZodEnum<{
            stdio: "stdio";
            socket: "socket";
        }>>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        initializationOptions: z.ZodOptional<z.ZodUnknown>;
        settings: z.ZodOptional<z.ZodUnknown>;
        workspaceFolder: z.ZodOptional<z.ZodString>;
        startupTimeout: z.ZodOptional<z.ZodNumber>;
        shutdownTimeout: z.ZodOptional<z.ZodNumber>;
        restartOnCrash: z.ZodOptional<z.ZodBoolean>;
        maxRestarts: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>]>>]>>;
    mcpServers: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodString]>, z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        type: z.ZodOptional<z.ZodLiteral<"stdio">>;
        command: z.ZodString;
        args: z.ZodDefault<z.ZodArray<z.ZodString>>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sse">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        headersHelper: z.ZodOptional<z.ZodString>;
        oauth: z.ZodOptional<z.ZodObject<{
            clientId: z.ZodOptional<z.ZodString>;
            callbackPort: z.ZodOptional<z.ZodNumber>;
            authServerMetadataUrl: z.ZodOptional<z.ZodString>;
            xaa: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sse-ide">;
        url: z.ZodString;
        ideName: z.ZodString;
        ideRunningInWindows: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"ws-ide">;
        url: z.ZodString;
        ideName: z.ZodString;
        authToken: z.ZodOptional<z.ZodString>;
        ideRunningInWindows: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"http">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        headersHelper: z.ZodOptional<z.ZodString>;
        oauth: z.ZodOptional<z.ZodObject<{
            clientId: z.ZodOptional<z.ZodString>;
            callbackPort: z.ZodOptional<z.ZodNumber>;
            authServerMetadataUrl: z.ZodOptional<z.ZodString>;
            xaa: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"ws">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        headersHelper: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sdk">;
        name: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"claudeai-proxy">;
        url: z.ZodString;
        id: z.ZodString;
    }, z.core.$strip>]>>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodString]>, z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        type: z.ZodOptional<z.ZodLiteral<"stdio">>;
        command: z.ZodString;
        args: z.ZodDefault<z.ZodArray<z.ZodString>>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sse">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        headersHelper: z.ZodOptional<z.ZodString>;
        oauth: z.ZodOptional<z.ZodObject<{
            clientId: z.ZodOptional<z.ZodString>;
            callbackPort: z.ZodOptional<z.ZodNumber>;
            authServerMetadataUrl: z.ZodOptional<z.ZodString>;
            xaa: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sse-ide">;
        url: z.ZodString;
        ideName: z.ZodString;
        ideRunningInWindows: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"ws-ide">;
        url: z.ZodString;
        ideName: z.ZodString;
        authToken: z.ZodOptional<z.ZodString>;
        ideRunningInWindows: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"http">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        headersHelper: z.ZodOptional<z.ZodString>;
        oauth: z.ZodOptional<z.ZodObject<{
            clientId: z.ZodOptional<z.ZodString>;
            callbackPort: z.ZodOptional<z.ZodNumber>;
            authServerMetadataUrl: z.ZodOptional<z.ZodString>;
            xaa: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"ws">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        headersHelper: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sdk">;
        name: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"claudeai-proxy">;
        url: z.ZodString;
        id: z.ZodString;
    }, z.core.$strip>]>>]>>]>>;
    channels: z.ZodOptional<z.ZodArray<z.ZodObject<{
        server: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        userConfig: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            type: z.ZodEnum<{
                string: "string";
                number: "number";
                boolean: "boolean";
                file: "file";
                directory: "directory";
            }>;
            title: z.ZodString;
            description: z.ZodString;
            required: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
            multiple: z.ZodOptional<z.ZodBoolean>;
            sensitive: z.ZodOptional<z.ZodBoolean>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>>;
    }, z.core.$strict>>>;
    outputStyles: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    skills: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    agents: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    commands: z.ZodOptional<z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodString, z.ZodString]>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodString]>>, z.ZodRecord<z.ZodString, z.ZodObject<{
        source: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodString]>>;
        content: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        argumentHint: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        allowedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>]>>;
    hooks: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodLazy<z.ZodRecord<z.ZodEnum<{
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
    }, z.core.$strip>>>>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodLazy<z.ZodRecord<z.ZodEnum<{
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
    }, z.core.$strip>>>>]>>]>>;
    name: z.ZodString;
    version: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        email: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    homepage: z.ZodOptional<z.ZodString>;
    repository: z.ZodOptional<z.ZodString>;
    license: z.ZodOptional<z.ZodString>;
    keywords: z.ZodOptional<z.ZodArray<z.ZodString>>;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>, z.ZodPipe<z.ZodObject<{
        name: z.ZodString;
        marketplace: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>, z.ZodTransform<string, {
        [x: string]: unknown;
        name: string;
        marketplace?: string;
    }>>]>>>;
}, z.core.$strip>;
/**
 * Schema for marketplace source locations
 *
 * Defines various ways to reference marketplace manifests including
 * direct URLs, GitHub repos, git URLs, npm packages, and local paths.
 */
export declare const MarketplaceSourceSchema: () => z.ZodDiscriminatedUnion<[z.ZodObject<{
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
export declare const gitSha: () => z.ZodString;
/**
 * Schema for plugin source locations
 *
 * Defines various ways to reference and install plugins including
 * local paths, npm packages, Python packages, git URLs, and GitHub repos.
 */
export declare const PluginSourceSchema: () => z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
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
/**
 * Check if a plugin source is a local path (stored in marketplace directory).
 *
 * Local plugins have their source as a string starting with './' (relative to marketplace).
 * External plugins have their source as an object (npm, pip, git, github, etc.).
 *
 * This function provides a semantic wrapper around the './' prefix check, making
 * the intent clear and centralizing the logic for determining plugin source type.
 *
 * @param source The plugin source from PluginMarketplaceEntry
 * @returns true if the source is a local path, false if it's an external source
 */
export declare function isLocalPluginSource(source: PluginSource): source is string;
/**
 * Whether a marketplace source points at a user-controlled local filesystem path.
 *
 * For local sources (`file`/`directory`), `installLocation` IS the user's path —
 * it lives outside the plugins cache dir and marketplace operations on it are
 * read-only. For remote sources (`github`/`git`/`url`/`npm`), `installLocation`
 * is a cache-dir entry managed by Claude Code and subject to rm/re-clone.
 *
 * Contrast with isLocalPluginSource, which operates on PluginSource (the
 * per-plugin source inside a marketplace entry) and checks for `./` prefix.
 */
export declare function isLocalMarketplaceSource(source: MarketplaceSource): source is Extract<MarketplaceSource, {
    source: 'file' | 'directory';
}>;
/**
 * Schema for individual plugin entries in a marketplace
 *
 * When strict=true (default): Plugin.json is required, marketplace fields supplement it
 * When strict=false: Plugin.json is optional, marketplace provides full manifest
 *
 * Unknown fields are silently stripped (zod default) rather than rejected.
 * Marketplace entries are validated as an array — if one entry rejected
 * unknown keys, the whole marketplace.json would fail to parse and ALL
 * plugins from that marketplace would become unavailable. Stripping keeps
 * the blast radius to zero for custom/future fields.
 */
export declare const PluginMarketplaceEntrySchema: () => z.ZodObject<{
    userConfig: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        type: z.ZodEnum<{
            string: "string";
            number: "number";
            boolean: "boolean";
            file: "file";
            directory: "directory";
        }>;
        title: z.ZodString;
        description: z.ZodString;
        required: z.ZodOptional<z.ZodBoolean>;
        default: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
        multiple: z.ZodOptional<z.ZodBoolean>;
        sensitive: z.ZodOptional<z.ZodBoolean>;
        min: z.ZodOptional<z.ZodNumber>;
        max: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>>>>;
    settings: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
    lspServers: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
        command: z.ZodString;
        args: z.ZodOptional<z.ZodArray<z.ZodString>>;
        extensionToLanguage: z.ZodRecord<z.ZodString, z.ZodString>;
        transport: z.ZodDefault<z.ZodEnum<{
            stdio: "stdio";
            socket: "socket";
        }>>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        initializationOptions: z.ZodOptional<z.ZodUnknown>;
        settings: z.ZodOptional<z.ZodUnknown>;
        workspaceFolder: z.ZodOptional<z.ZodString>;
        startupTimeout: z.ZodOptional<z.ZodNumber>;
        shutdownTimeout: z.ZodOptional<z.ZodNumber>;
        restartOnCrash: z.ZodOptional<z.ZodBoolean>;
        maxRestarts: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
        command: z.ZodString;
        args: z.ZodOptional<z.ZodArray<z.ZodString>>;
        extensionToLanguage: z.ZodRecord<z.ZodString, z.ZodString>;
        transport: z.ZodDefault<z.ZodEnum<{
            stdio: "stdio";
            socket: "socket";
        }>>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        initializationOptions: z.ZodOptional<z.ZodUnknown>;
        settings: z.ZodOptional<z.ZodUnknown>;
        workspaceFolder: z.ZodOptional<z.ZodString>;
        startupTimeout: z.ZodOptional<z.ZodNumber>;
        shutdownTimeout: z.ZodOptional<z.ZodNumber>;
        restartOnCrash: z.ZodOptional<z.ZodBoolean>;
        maxRestarts: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>]>>]>>>;
    mcpServers: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodString]>, z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        type: z.ZodOptional<z.ZodLiteral<"stdio">>;
        command: z.ZodString;
        args: z.ZodDefault<z.ZodArray<z.ZodString>>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sse">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        headersHelper: z.ZodOptional<z.ZodString>;
        oauth: z.ZodOptional<z.ZodObject<{
            clientId: z.ZodOptional<z.ZodString>;
            callbackPort: z.ZodOptional<z.ZodNumber>;
            authServerMetadataUrl: z.ZodOptional<z.ZodString>;
            xaa: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sse-ide">;
        url: z.ZodString;
        ideName: z.ZodString;
        ideRunningInWindows: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"ws-ide">;
        url: z.ZodString;
        ideName: z.ZodString;
        authToken: z.ZodOptional<z.ZodString>;
        ideRunningInWindows: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"http">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        headersHelper: z.ZodOptional<z.ZodString>;
        oauth: z.ZodOptional<z.ZodObject<{
            clientId: z.ZodOptional<z.ZodString>;
            callbackPort: z.ZodOptional<z.ZodNumber>;
            authServerMetadataUrl: z.ZodOptional<z.ZodString>;
            xaa: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"ws">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        headersHelper: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sdk">;
        name: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"claudeai-proxy">;
        url: z.ZodString;
        id: z.ZodString;
    }, z.core.$strip>]>>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodString]>, z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        type: z.ZodOptional<z.ZodLiteral<"stdio">>;
        command: z.ZodString;
        args: z.ZodDefault<z.ZodArray<z.ZodString>>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sse">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        headersHelper: z.ZodOptional<z.ZodString>;
        oauth: z.ZodOptional<z.ZodObject<{
            clientId: z.ZodOptional<z.ZodString>;
            callbackPort: z.ZodOptional<z.ZodNumber>;
            authServerMetadataUrl: z.ZodOptional<z.ZodString>;
            xaa: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sse-ide">;
        url: z.ZodString;
        ideName: z.ZodString;
        ideRunningInWindows: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"ws-ide">;
        url: z.ZodString;
        ideName: z.ZodString;
        authToken: z.ZodOptional<z.ZodString>;
        ideRunningInWindows: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"http">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        headersHelper: z.ZodOptional<z.ZodString>;
        oauth: z.ZodOptional<z.ZodObject<{
            clientId: z.ZodOptional<z.ZodString>;
            callbackPort: z.ZodOptional<z.ZodNumber>;
            authServerMetadataUrl: z.ZodOptional<z.ZodString>;
            xaa: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"ws">;
        url: z.ZodString;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        headersHelper: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"sdk">;
        name: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"claudeai-proxy">;
        url: z.ZodString;
        id: z.ZodString;
    }, z.core.$strip>]>>]>>]>>>;
    channels: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        server: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        userConfig: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            type: z.ZodEnum<{
                string: "string";
                number: "number";
                boolean: "boolean";
                file: "file";
                directory: "directory";
            }>;
            title: z.ZodString;
            description: z.ZodString;
            required: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
            multiple: z.ZodOptional<z.ZodBoolean>;
            sensitive: z.ZodOptional<z.ZodBoolean>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>>;
    }, z.core.$strict>>>>;
    outputStyles: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
    skills: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
    agents: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
    commands: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodString, z.ZodString]>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodString]>>, z.ZodRecord<z.ZodString, z.ZodObject<{
        source: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodString]>>;
        content: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        argumentHint: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        allowedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>]>>>;
    hooks: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodLazy<z.ZodRecord<z.ZodEnum<{
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
    }, z.core.$strip>>>>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodLazy<z.ZodRecord<z.ZodEnum<{
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
    }, z.core.$strip>>>>]>>]>>>;
    version: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    author: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        email: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    homepage: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    repository: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    license: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    keywords: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    dependencies: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>, z.ZodPipe<z.ZodObject<{
        name: z.ZodString;
        marketplace: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>, z.ZodTransform<string, {
        [x: string]: unknown;
        name: string;
        marketplace?: string;
    }>>]>>>>;
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
    category: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    strict: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
/**
 * Schema for plugin marketplace configuration
 *
 * Defines the structure for curated collections of plugins that can
 * be discovered and installed from a central repository.
 */
export declare const PluginMarketplaceSchema: () => z.ZodObject<{
    name: z.ZodString;
    owner: z.ZodObject<{
        name: z.ZodString;
        email: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    plugins: z.ZodArray<z.ZodObject<{
        userConfig: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            type: z.ZodEnum<{
                string: "string";
                number: "number";
                boolean: "boolean";
                file: "file";
                directory: "directory";
            }>;
            title: z.ZodString;
            description: z.ZodString;
            required: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
            multiple: z.ZodOptional<z.ZodBoolean>;
            sensitive: z.ZodOptional<z.ZodBoolean>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>>>>;
        settings: z.ZodOptional<z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
        lspServers: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
            command: z.ZodString;
            args: z.ZodOptional<z.ZodArray<z.ZodString>>;
            extensionToLanguage: z.ZodRecord<z.ZodString, z.ZodString>;
            transport: z.ZodDefault<z.ZodEnum<{
                stdio: "stdio";
                socket: "socket";
            }>>;
            env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            initializationOptions: z.ZodOptional<z.ZodUnknown>;
            settings: z.ZodOptional<z.ZodUnknown>;
            workspaceFolder: z.ZodOptional<z.ZodString>;
            startupTimeout: z.ZodOptional<z.ZodNumber>;
            shutdownTimeout: z.ZodOptional<z.ZodNumber>;
            restartOnCrash: z.ZodOptional<z.ZodBoolean>;
            maxRestarts: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
            command: z.ZodString;
            args: z.ZodOptional<z.ZodArray<z.ZodString>>;
            extensionToLanguage: z.ZodRecord<z.ZodString, z.ZodString>;
            transport: z.ZodDefault<z.ZodEnum<{
                stdio: "stdio";
                socket: "socket";
            }>>;
            env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            initializationOptions: z.ZodOptional<z.ZodUnknown>;
            settings: z.ZodOptional<z.ZodUnknown>;
            workspaceFolder: z.ZodOptional<z.ZodString>;
            startupTimeout: z.ZodOptional<z.ZodNumber>;
            shutdownTimeout: z.ZodOptional<z.ZodNumber>;
            restartOnCrash: z.ZodOptional<z.ZodBoolean>;
            maxRestarts: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>]>>]>>>;
        mcpServers: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodString]>, z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            type: z.ZodOptional<z.ZodLiteral<"stdio">>;
            command: z.ZodString;
            args: z.ZodDefault<z.ZodArray<z.ZodString>>;
            env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"sse">;
            url: z.ZodString;
            headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            headersHelper: z.ZodOptional<z.ZodString>;
            oauth: z.ZodOptional<z.ZodObject<{
                clientId: z.ZodOptional<z.ZodString>;
                callbackPort: z.ZodOptional<z.ZodNumber>;
                authServerMetadataUrl: z.ZodOptional<z.ZodString>;
                xaa: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"sse-ide">;
            url: z.ZodString;
            ideName: z.ZodString;
            ideRunningInWindows: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"ws-ide">;
            url: z.ZodString;
            ideName: z.ZodString;
            authToken: z.ZodOptional<z.ZodString>;
            ideRunningInWindows: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"http">;
            url: z.ZodString;
            headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            headersHelper: z.ZodOptional<z.ZodString>;
            oauth: z.ZodOptional<z.ZodObject<{
                clientId: z.ZodOptional<z.ZodString>;
                callbackPort: z.ZodOptional<z.ZodNumber>;
                authServerMetadataUrl: z.ZodOptional<z.ZodString>;
                xaa: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"ws">;
            url: z.ZodString;
            headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            headersHelper: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"sdk">;
            name: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"claudeai-proxy">;
            url: z.ZodString;
            id: z.ZodString;
        }, z.core.$strip>]>>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodString]>, z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            type: z.ZodOptional<z.ZodLiteral<"stdio">>;
            command: z.ZodString;
            args: z.ZodDefault<z.ZodArray<z.ZodString>>;
            env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"sse">;
            url: z.ZodString;
            headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            headersHelper: z.ZodOptional<z.ZodString>;
            oauth: z.ZodOptional<z.ZodObject<{
                clientId: z.ZodOptional<z.ZodString>;
                callbackPort: z.ZodOptional<z.ZodNumber>;
                authServerMetadataUrl: z.ZodOptional<z.ZodString>;
                xaa: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"sse-ide">;
            url: z.ZodString;
            ideName: z.ZodString;
            ideRunningInWindows: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"ws-ide">;
            url: z.ZodString;
            ideName: z.ZodString;
            authToken: z.ZodOptional<z.ZodString>;
            ideRunningInWindows: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"http">;
            url: z.ZodString;
            headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            headersHelper: z.ZodOptional<z.ZodString>;
            oauth: z.ZodOptional<z.ZodObject<{
                clientId: z.ZodOptional<z.ZodString>;
                callbackPort: z.ZodOptional<z.ZodNumber>;
                authServerMetadataUrl: z.ZodOptional<z.ZodString>;
                xaa: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"ws">;
            url: z.ZodString;
            headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            headersHelper: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"sdk">;
            name: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"claudeai-proxy">;
            url: z.ZodString;
            id: z.ZodString;
        }, z.core.$strip>]>>]>>]>>>;
        channels: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
            server: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
            userConfig: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                type: z.ZodEnum<{
                    string: "string";
                    number: "number";
                    boolean: "boolean";
                    file: "file";
                    directory: "directory";
                }>;
                title: z.ZodString;
                description: z.ZodString;
                required: z.ZodOptional<z.ZodBoolean>;
                default: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodString>]>>;
                multiple: z.ZodOptional<z.ZodBoolean>;
                sensitive: z.ZodOptional<z.ZodBoolean>;
                min: z.ZodOptional<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strict>>>;
        }, z.core.$strict>>>>;
        outputStyles: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
        skills: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
        agents: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>>;
        commands: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodString, z.ZodString]>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodString]>>, z.ZodRecord<z.ZodString, z.ZodObject<{
            source: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodString]>>;
            content: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            argumentHint: z.ZodOptional<z.ZodString>;
            model: z.ZodOptional<z.ZodString>;
            allowedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>]>>>;
        hooks: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodLazy<z.ZodRecord<z.ZodEnum<{
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
        }, z.core.$strip>>>>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodLazy<z.ZodRecord<z.ZodEnum<{
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
        }, z.core.$strip>>>>]>>]>>>;
        version: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        author: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            email: z.ZodOptional<z.ZodString>;
            url: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        homepage: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        repository: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        license: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        keywords: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
        dependencies: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>, z.ZodPipe<z.ZodObject<{
            name: z.ZodString;
            marketplace: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>, z.ZodTransform<string, {
            [x: string]: unknown;
            name: string;
            marketplace?: string;
        }>>]>>>>;
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
        category: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        strict: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>>;
    forceRemoveDeletedPlugins: z.ZodOptional<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodObject<{
        pluginRoot: z.ZodOptional<z.ZodString>;
        version: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    allowCrossMarketplaceDependenciesOn: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
/**
 * Schema for plugin ID format
 *
 * Plugin IDs follow the format: "plugin-name@marketplace-name"
 * Both parts allow alphanumeric characters, hyphens, dots, and underscores.
 *
 * Examples:
 * - "code-formatter@anthropic-tools"
 * - "db_assistant@company-internal"
 * - "my.plugin@personal-marketplace"
 */
export declare const PluginIdSchema: () => z.ZodString;
/**
 * Schema for entries in a plugin's `dependencies` array.
 *
 * Accepts three forms, all normalized to a plain "name" or "name@mkt" string
 * by the transform — downstream code (qualifyDependency, resolveDependencyClosure,
 * verifyAndDemote) never sees versions or objects:
 *
 *   "plugin"                → bare, resolved against declaring plugin's marketplace
 *   "plugin@marketplace"    → qualified
 *   "plugin@mkt@^1.2"       → trailing @^version silently stripped (forwards-compat)
 *   {name, marketplace?, …} → object form, version etc. stripped (forwards-compat)
 *
 * The latter two are permitted-but-ignored so future clients adding version
 * constraints don't cause old clients to fail schema validation and reject
 * the whole plugin. See CC-993 for the eventual version-range design.
 */
export declare const DependencyRefSchema: () => z.ZodUnion<readonly [z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>, z.ZodPipe<z.ZodObject<{
    name: z.ZodString;
    marketplace: z.ZodOptional<z.ZodString>;
}, z.core.$loose>, z.ZodTransform<string, {
    [x: string]: unknown;
    name: string;
    marketplace?: string;
}>>]>;
/**
 * Schema for plugin reference in settings (repo or user level)
 *
 * Can be either:
 * - Simple string: "plugin-name@marketplace-name"
 * - Object with additional configuration
 *
 * The plugin source (npm, git, local) is defined in the marketplace entry itself,
 * not in the plugin reference.
 *
 * Examples:
 * - "code-formatter@anthropic-tools"
 * - "db-assistant@company-internal"
 * - { id: "formatter@tools", version: "^2.0.0", required: true }
 */
export declare const SettingsPluginEntrySchema: () => z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    id: z.ZodString;
    version: z.ZodOptional<z.ZodString>;
    required: z.ZodOptional<z.ZodBoolean>;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>]>;
/**
 * Schema for installed plugin metadata (V1 format)
 *
 * Tracks the actual installation state of a plugin. All plugins are
 * installed from marketplaces, which contain the actual source details
 * (npm, git, local, etc.). The plugin ID is the key in the plugins record,
 * so it's not duplicated here.
 *
 * Example entry for key "code-formatter@anthropic-tools":
 * {
 *   "version": "1.2.0",
 *   "installedAt": "2024-01-15T10:30:00Z",
 *   "marketplace": "anthropic-tools",
 *   "installPath": "/home/user/.claude/plugins/installed/anthropic-tools/code-formatter"
 * }
 */
export declare const InstalledPluginSchema: () => z.ZodObject<{
    version: z.ZodString;
    installedAt: z.ZodString;
    lastUpdated: z.ZodOptional<z.ZodString>;
    installPath: z.ZodString;
    gitCommitSha: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Schema for the installed_plugins.json file (V1 format)
 *
 * Contains a version number and maps plugin IDs to their installation metadata.
 * Maintained automatically by Claude Code, not edited by users.
 *
 * The version field tracks schema changes. When the version doesn't match
 * the current schema version, Claude Code will update the file on next startup.
 *
 * Example file:
 * {
 *   "version": 1,
 *   "plugins": {
 *     "code-formatter@anthropic-tools": { ... },
 *     "db-assistant@company-internal": { ... }
 *   }
 * }
 */
export declare const InstalledPluginsFileSchemaV1: () => z.ZodObject<{
    version: z.ZodLiteral<1>;
    plugins: z.ZodRecord<z.ZodString, z.ZodObject<{
        version: z.ZodString;
        installedAt: z.ZodString;
        lastUpdated: z.ZodOptional<z.ZodString>;
        installPath: z.ZodString;
        gitCommitSha: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Scope types for plugin installation (V2)
 *
 * Plugins can be installed at different scopes:
 * - managed: Enterprise/system-wide (read-only, platform-specific paths)
 * - user: User's global settings (~/.claude/settings.json)
 * - project: Shared project settings ($project/.claude/settings.json)
 * - local: Personal project overrides ($project/.claude/settings.local.json)
 *
 * Note: 'flag' scope plugins (from --settings) are session-only and
 * are NOT persisted to installed_plugins.json.
 */
export declare const PluginScopeSchema: () => z.ZodEnum<{
    local: "local";
    user: "user";
    project: "project";
    managed: "managed";
}>;
/**
 * Schema for a single plugin installation entry (V2)
 *
 * Each plugin can have multiple installations at different scopes.
 * For example, the same plugin could be installed at user scope with v1.0
 * and at project scope with v1.1.
 */
export declare const PluginInstallationEntrySchema: () => z.ZodObject<{
    scope: z.ZodEnum<{
        local: "local";
        user: "user";
        project: "project";
        managed: "managed";
    }>;
    projectPath: z.ZodOptional<z.ZodString>;
    installPath: z.ZodString;
    version: z.ZodOptional<z.ZodString>;
    installedAt: z.ZodOptional<z.ZodString>;
    lastUpdated: z.ZodOptional<z.ZodString>;
    gitCommitSha: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Schema for the installed_plugins.json file (V2 format)
 *
 * V2 changes from V1:
 * - Each plugin ID maps to an ARRAY of installations (one per scope)
 * - Supports multi-scope installation (same plugin at different scopes/versions)
 *
 * Example file:
 * {
 *   "version": 2,
 *   "plugins": {
 *     "code-formatter@anthropic-tools": [
 *       { "scope": "user", "installPath": "...", "version": "1.0.0" },
 *       { "scope": "project", "projectPath": "/path/to/project", "installPath": "...", "version": "1.1.0" }
 *     ]
 *   }
 * }
 */
export declare const InstalledPluginsFileSchemaV2: () => z.ZodObject<{
    version: z.ZodLiteral<2>;
    plugins: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodObject<{
        scope: z.ZodEnum<{
            local: "local";
            user: "user";
            project: "project";
            managed: "managed";
        }>;
        projectPath: z.ZodOptional<z.ZodString>;
        installPath: z.ZodString;
        version: z.ZodOptional<z.ZodString>;
        installedAt: z.ZodOptional<z.ZodString>;
        lastUpdated: z.ZodOptional<z.ZodString>;
        gitCommitSha: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
/**
 * Combined schema that accepts both V1 and V2 formats
 * Used for reading existing files before migration
 */
export declare const InstalledPluginsFileSchema: () => z.ZodUnion<readonly [z.ZodObject<{
    version: z.ZodLiteral<1>;
    plugins: z.ZodRecord<z.ZodString, z.ZodObject<{
        version: z.ZodString;
        installedAt: z.ZodString;
        lastUpdated: z.ZodOptional<z.ZodString>;
        installPath: z.ZodString;
        gitCommitSha: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    version: z.ZodLiteral<2>;
    plugins: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodObject<{
        scope: z.ZodEnum<{
            local: "local";
            user: "user";
            project: "project";
            managed: "managed";
        }>;
        projectPath: z.ZodOptional<z.ZodString>;
        installPath: z.ZodString;
        version: z.ZodOptional<z.ZodString>;
        installedAt: z.ZodOptional<z.ZodString>;
        lastUpdated: z.ZodOptional<z.ZodString>;
        gitCommitSha: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
}, z.core.$strip>]>;
/**
 * Schema for a known marketplace entry
 *
 * Tracks metadata about a registered marketplace in the user's configuration.
 * Each entry contains the source location, cache path, and last update time.
 *
 * Example entry:
 * {
 *   "source": { "source": "github", "repo": "anthropic/claude-plugins" },
 *   "installLocation": "/home/user/.claude/plugins/cached/marketplaces/anthropic-tools",
 *   "lastUpdated": "2024-01-15T10:30:00Z"
 * }
 */
export declare const KnownMarketplaceSchema: () => z.ZodObject<{
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
    installLocation: z.ZodString;
    lastUpdated: z.ZodString;
    autoUpdate: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
/**
 * Schema for the known_marketplaces.json file
 *
 * Maps marketplace names to their source and cache metadata.
 * Used to track which marketplaces are registered and where to find them.
 *
 * Example file:
 * {
 *   "anthropic-tools": { "source": { ... }, "installLocation": "...", "lastUpdated": "..." },
 *   "company-internal": { "source": { ... }, "installLocation": "...", "lastUpdated": "..." }
 * }
 */
export declare const KnownMarketplacesFileSchema: () => z.ZodRecord<z.ZodString, z.ZodObject<{
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
    installLocation: z.ZodString;
    lastUpdated: z.ZodString;
    autoUpdate: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>>;
/**
 * Metadata for plugin command definitions.
 *
 * Commands can be defined with either:
 * - `source`: Path to a markdown file (e.g., "./README.md")
 * - `content`: Inline markdown content string
 *
 * INVARIANT: Exactly one of `source` or `content` must be present.
 * This invariant is enforced at runtime by CommandMetadataSchema validation.
 *
 * Validation occurs at plugin manifest parsing. Metadata is assumed valid
 * after passing through createPluginFromPath().
 *
 * @see CommandMetadataSchema for runtime validation rules
 */
export type CommandMetadata = z.infer<ReturnType<typeof CommandMetadataSchema>>;
export type MarketplaceSource = z.infer<ReturnType<typeof MarketplaceSourceSchema>>;
export type PluginAuthor = z.infer<ReturnType<typeof PluginAuthorSchema>>;
export type PluginSource = z.infer<ReturnType<typeof PluginSourceSchema>>;
export type PluginManifest = z.infer<ReturnType<typeof PluginManifestSchema>>;
export type PluginManifestChannel = NonNullable<PluginManifest['channels']>[number];
export type PluginMarketplace = z.infer<ReturnType<typeof PluginMarketplaceSchema>>;
export type PluginMarketplaceEntry = z.infer<ReturnType<typeof PluginMarketplaceEntrySchema>>;
export type PluginId = z.infer<ReturnType<typeof PluginIdSchema>>;
export type InstalledPlugin = z.infer<ReturnType<typeof InstalledPluginSchema>>;
export type InstalledPluginsFileV1 = z.infer<ReturnType<typeof InstalledPluginsFileSchemaV1>>;
export type InstalledPluginsFileV2 = z.infer<ReturnType<typeof InstalledPluginsFileSchemaV2>>;
export type PluginScope = z.infer<ReturnType<typeof PluginScopeSchema>>;
export type PluginInstallationEntry = z.infer<ReturnType<typeof PluginInstallationEntrySchema>>;
export type KnownMarketplace = z.infer<ReturnType<typeof KnownMarketplaceSchema>>;
export type KnownMarketplacesFile = z.infer<ReturnType<typeof KnownMarketplacesFileSchema>>;
//# sourceMappingURL=schemas.d.ts.map