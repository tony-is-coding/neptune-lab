import type { ScopedLspServerConfig } from './types.js';
/**
 * Get all configured LSP servers from plugins.
 * LSP servers are only supported via plugins, not user/project settings.
 *
 * @returns Object containing servers configuration keyed by scoped server name
 */
export declare function getAllLspServers(): Promise<{
    servers: Record<string, ScopedLspServerConfig>;
}>;
//# sourceMappingURL=config.d.ts.map