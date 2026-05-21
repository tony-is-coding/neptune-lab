/**
 * Sandbox types for the Claude Code Agent SDK
 *
 * This file is the single source of truth for sandbox configuration types.
 * Both the SDK and the settings validation import from here.
 */
import { z } from 'zod/v4';
/**
 * Network configuration schema for sandbox.
 */
export declare const SandboxNetworkConfigSchema: () => z.ZodOptional<z.ZodObject<{
    allowedDomains: z.ZodOptional<z.ZodArray<z.ZodString>>;
    allowManagedDomainsOnly: z.ZodOptional<z.ZodBoolean>;
    allowUnixSockets: z.ZodOptional<z.ZodArray<z.ZodString>>;
    allowAllUnixSockets: z.ZodOptional<z.ZodBoolean>;
    allowLocalBinding: z.ZodOptional<z.ZodBoolean>;
    httpProxyPort: z.ZodOptional<z.ZodNumber>;
    socksProxyPort: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>>;
/**
 * Filesystem configuration schema for sandbox.
 */
export declare const SandboxFilesystemConfigSchema: () => z.ZodOptional<z.ZodObject<{
    allowWrite: z.ZodOptional<z.ZodArray<z.ZodString>>;
    denyWrite: z.ZodOptional<z.ZodArray<z.ZodString>>;
    denyRead: z.ZodOptional<z.ZodArray<z.ZodString>>;
    allowRead: z.ZodOptional<z.ZodArray<z.ZodString>>;
    allowManagedReadPathsOnly: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>>;
/**
 * Sandbox settings schema.
 */
export declare const SandboxSettingsSchema: () => z.ZodObject<{
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
}, z.core.$loose>;
export type SandboxSettings = z.infer<ReturnType<typeof SandboxSettingsSchema>>;
export type SandboxNetworkConfig = NonNullable<z.infer<ReturnType<typeof SandboxNetworkConfigSchema>>>;
export type SandboxFilesystemConfig = NonNullable<z.infer<ReturnType<typeof SandboxFilesystemConfigSchema>>>;
export type SandboxIgnoreViolations = NonNullable<SandboxSettings['ignoreViolations']>;
//# sourceMappingURL=sandboxTypes.d.ts.map