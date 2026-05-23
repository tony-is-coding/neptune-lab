import type { BetaToolUnion } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { ScopedMcpServerConfig } from 'src/services/mcp/types.js';
import type { AgentId } from 'src/types/ids.js';
import type { z } from 'zod/v4';
import type { Tool, ToolPermissionContext, Tools } from '../Tool.js';
import type { AgentDefinition } from '@neptune/builtin-tools/tools/AgentTool/loadAgentsDir.js';
import type { Message } from '../types/message.js';
import type { SystemPrompt } from './systemPromptType.js';
export type CacheScope = 'global' | 'org';
export type SystemPromptBlock = {
    text: string;
    cacheScope: CacheScope | null;
};
export declare function toolToAPISchema(tool: Tool, options: {
    getToolPermissionContext: () => Promise<ToolPermissionContext>;
    tools: Tools;
    agents: AgentDefinition[];
    allowedAgentTypes?: string[];
    model?: string;
    /** When true, mark this tool with defer_loading for tool search */
    deferLoading?: boolean;
    cacheControl?: {
        type: 'ephemeral';
        scope?: 'global' | 'org';
        ttl?: '5m' | '1h';
    };
}): Promise<BetaToolUnion>;
/**
 * Log stats about first block for analyzing prefix matching config
 * (see https://console.statsig.com/4aF3Ewatb6xPVpCwxb5nA3/dynamic_configs/claude_cli_system_prompt_prefixes)
 */
export declare function logAPIPrefix(systemPrompt: SystemPrompt): void;
/**
 * Split system prompt blocks by content type for API matching and cache control.
 * See https://console.statsig.com/4aF3Ewatb6xPVpCwxb5nA3/dynamic_configs/claude_cli_system_prompt_prefixes
 *
 * Behavior depends on feature flags and options:
 *
 * 1. MCP tools present (skipGlobalCacheForSystemPrompt=true):
 *    Returns up to 3 blocks with org-level caching (no global cache on system prompt):
 *    - Attribution header (cacheScope=null)
 *    - System prompt prefix (cacheScope='org')
 *    - Everything else concatenated (cacheScope='org')
 *
 * 2. Global cache mode with boundary marker (1P only, boundary found):
 *    Returns up to 4 blocks:
 *    - Attribution header (cacheScope=null)
 *    - System prompt prefix (cacheScope=null)
 *    - Static content before boundary (cacheScope='global')
 *    - Dynamic content after boundary (cacheScope=null)
 *
 * 3. Default mode (3P providers, or boundary missing):
 *    Returns up to 3 blocks with org-level caching:
 *    - Attribution header (cacheScope=null)
 *    - System prompt prefix (cacheScope='org')
 *    - Everything else concatenated (cacheScope='org')
 */
export declare function splitSysPromptPrefix(systemPrompt: SystemPrompt, options?: {
    skipGlobalCacheForSystemPrompt?: boolean;
}): SystemPromptBlock[];
export declare function appendSystemContext(systemPrompt: SystemPrompt, context: {
    [k: string]: string;
}): string[];
export declare function prependUserContext(messages: Message[], context: {
    [k: string]: string;
}): Message[];
/**
 * Log metrics about context and system prompt size
 */
export declare function logContextMetrics(mcpConfigs: Record<string, ScopedMcpServerConfig>, toolPermissionContext: ToolPermissionContext): Promise<void>;
export declare function normalizeToolInput<T extends Tool>(tool: T, input: z.infer<T['inputSchema']>, agentId?: AgentId): z.infer<T['inputSchema']>;
export declare function normalizeToolInputForAPI<T extends Tool>(tool: T, input: z.infer<T['inputSchema']>): z.infer<T['inputSchema']>;
//# sourceMappingURL=api.d.ts.map