/**
 * Shared helpers for building the API cache-key prefix (systemPrompt,
 * userContext, systemContext) for query() calls.
 *
 * Lives in its own file because it imports from context.ts and
 * constants/prompts.ts, which are high in the dependency graph. Putting
 * these imports in systemPrompt.ts or sideQuestion.ts (both reachable
 * from commands.ts) would create cycles. Only entrypoint-layer files
 * import from here (QueryEngine.ts, cli/print.ts).
 */
import type { Command } from '../commands.js';
import type { MCPServerConnection } from '../services/mcp/types.js';
import type { AppState } from '../state/AppStateStore.js';
import type { Tools } from '../Tool.js';
import type { AgentDefinition } from '@neptune/builtin-tools/tools/AgentTool/loadAgentsDir.js';
import type { Message } from '../types/message.js';
import type { FileStateCache } from './fileStateCache.js';
import type { CacheSafeParams } from './forkedAgent.js';
import { type ThinkingConfig } from './thinking.js';
/**
 * Fetch the three context pieces that form the API cache-key prefix:
 * systemPrompt parts, userContext, systemContext.
 *
 * When customSystemPrompt is set, the default getSystemPrompt build and
 * getSystemContext are skipped — the custom prompt replaces the default
 * entirely, and systemContext would be appended to a default that isn't
 * being used.
 *
 * Callers assemble the final systemPrompt from defaultSystemPrompt (or
 * customSystemPrompt) + optional extras + appendSystemPrompt. QueryEngine
 * injects coordinator userContext and memory-mechanics prompt on top;
 * sideQuestion's fallback uses the base result directly.
 */
export declare function fetchSystemPromptParts({ tools, mainLoopModel, additionalWorkingDirectories, mcpClients, customSystemPrompt, }: {
    tools: Tools;
    mainLoopModel: string;
    additionalWorkingDirectories: string[];
    mcpClients: MCPServerConnection[];
    customSystemPrompt: string | undefined;
}): Promise<{
    defaultSystemPrompt: string[];
    userContext: {
        [k: string]: string;
    };
    systemContext: {
        [k: string]: string;
    };
}>;
/**
 * Build CacheSafeParams from raw inputs when getLastCacheSafeParams() is null.
 *
 * Used by the SDK side_question handler (print.ts) on resume before a turn
 * completes — there's no stopHooks snapshot yet. Mirrors the system prompt
 * assembly in QueryEngine.ts:ask() so the rebuilt prefix matches what the
 * main loop will send, preserving the cache hit in the common case.
 *
 * May still miss the cache if the main loop applies extras this path doesn't
 * know about (coordinator mode, memory-mechanics prompt). That's acceptable —
 * the alternative is returning null and failing the side question entirely.
 */
export declare function buildSideQuestionFallbackParams({ tools, commands, mcpClients, messages, readFileState, getAppState, setAppState, customSystemPrompt, appendSystemPrompt, thinkingConfig, agents, }: {
    tools: Tools;
    commands: Command[];
    mcpClients: MCPServerConnection[];
    messages: Message[];
    readFileState: FileStateCache;
    getAppState: () => AppState;
    setAppState: (f: (prev: AppState) => AppState) => void;
    customSystemPrompt: string | undefined;
    appendSystemPrompt: string | undefined;
    thinkingConfig: ThinkingConfig | undefined;
    agents: AgentDefinition[];
}): Promise<CacheSafeParams>;
//# sourceMappingURL=queryContext.d.ts.map