/**
 * Tool Search utilities for dynamically discovering deferred tools.
 *
 * When enabled, deferred tools (MCP and shouldDefer tools) are sent with
 * defer_loading: true and discovered via ToolSearchTool rather than being
 * loaded upfront.
 */
import { type ToolPermissionContext, type Tools } from '../Tool.js';
import type { AgentDefinition } from '@neptune/builtin-tools/tools/AgentTool/loadAgentsDir.js';
import type { Message } from '../types/message.js';
/**
 * Get the character threshold for auto-enabling tool search for a given model.
 * Used as fallback when the token counting API is unavailable.
 */
export declare function getAutoToolSearchCharThreshold(model: string): number;
/**
 * Tool search mode. Determines how deferrable tools (MCP + shouldDefer) are
 * surfaced:
 *   - 'tst': Tool Search Tool — deferred tools discovered via ToolSearchTool (always enabled)
 *   - 'tst-auto': auto — tools deferred only when they exceed threshold
 *   - 'standard': tool search disabled — all tools exposed inline
 */
export type ToolSearchMode = 'tst' | 'tst-auto' | 'standard';
/**
 * Determines the tool search mode from ENABLE_TOOL_SEARCH.
 *
 *   ENABLE_TOOL_SEARCH    Mode
 *   auto / auto:1-99      tst-auto
 *   true / auto:0         tst
 *   false / auto:100      standard
 *   (unset)               tst (default: always defer MCP and shouldDefer tools)
 */
export declare function getToolSearchMode(): ToolSearchMode;
/**
 * Check if a model supports tool_reference blocks (required for tool search).
 *
 * This uses a negative test: models are assumed to support tool_reference
 * UNLESS they match a pattern in the unsupported list. This ensures new
 * models work by default without code changes.
 *
 * Currently, Haiku models do NOT support tool_reference. This can be
 * updated via GrowthBook feature 'tengu_tool_search_unsupported_models'.
 *
 * @param model The model name to check
 * @returns true if the model supports tool_reference, false otherwise
 */
export declare function modelSupportsToolReference(model: string): boolean;
export declare function isToolSearchEnabledOptimistic(): boolean;
/**
 * Check if ToolSearchTool is available in the provided tools list.
 * If ToolSearchTool is not available (e.g., disallowed via disallowedTools),
 * tool search cannot function and should be disabled.
 *
 * @param tools Array of tools with a 'name' property
 * @returns true if ToolSearchTool is in the tools list, false otherwise
 */
export declare function isToolSearchToolAvailable(tools: readonly {
    name: string;
}[]): boolean;
/**
 * Check if tool search (MCP tool deferral with tool_reference) is enabled for a specific request.
 *
 * This is the definitive check that includes:
 * - MCP mode (Tst, TstAuto, McpCli, Standard)
 * - Model compatibility (haiku doesn't support tool_reference)
 * - ToolSearchTool availability (must be in tools list)
 * - Threshold check for TstAuto mode
 *
 * Use this when making actual API calls where all context is available.
 *
 * @param model The model to check for tool_reference support
 * @param tools Array of available tools (including MCP tools)
 * @param getToolPermissionContext Function to get tool permission context
 * @param agents Array of agent definitions
 * @param source Optional identifier for the caller (for debugging)
 * @returns true if tool search should be enabled for this request
 */
export declare function isToolSearchEnabled(model: string, tools: Tools, getToolPermissionContext: () => Promise<ToolPermissionContext>, agents: AgentDefinition[], source?: string): Promise<boolean>;
/**
 * Check if an object is a tool_reference block.
 * tool_reference is a beta feature not in the SDK types, so we need runtime checks.
 */
export declare function isToolReferenceBlock(obj: unknown): boolean;
/**
 * Extract tool names from tool_reference blocks in message history.
 *
 * When dynamic tool loading is enabled, MCP tools are not predeclared in the
 * tools array. Instead, they are discovered via ToolSearchTool which returns
 * tool_reference blocks. This function scans the message history to find all
 * tool names that have been referenced, so we can include only those tools
 * in subsequent API requests.
 *
 * This approach:
 * - Eliminates the need to predeclare all MCP tools upfront
 * - Removes limits on total quantity of MCP tools
 *
 * Compaction replaces tool_reference-bearing messages with a summary, so it
 * snapshots the discovered set onto compactMetadata.preCompactDiscoveredTools
 * on the boundary marker; this scan reads it back. Snip instead protects the
 * tool_reference-carrying messages from removal.
 *
 * @param messages Array of messages that may contain tool_result blocks with tool_reference content
 * @returns Set of tool names that have been discovered via tool_reference blocks
 */
export declare function extractDiscoveredToolNames(messages: Message[]): Set<string>;
export type DeferredToolsDelta = {
    addedNames: string[];
    /** Rendered lines for addedNames; the scan reconstructs from names. */
    addedLines: string[];
    removedNames: string[];
};
/**
 * Call-site discriminator for the tengu_deferred_tools_pool_change event.
 * The scan runs from several sites with different expected-prior semantics
 * (inc-4747):
 *   - attachments_main: main-thread getAttachments → prior=0 is a BUG on fire-2+
 *   - attachments_subagent: subagent getAttachments → prior=0 is EXPECTED
 *     (fresh conversation, initialMessages has no DTD)
 *   - compact_full: compact.ts passes [] → prior=0 is EXPECTED
 *   - compact_partial: compact.ts passes messagesToKeep → depends on what survived
 *   - reactive_compact: reactiveCompact.ts passes preservedMessages → same
 * Without this the 96%-prior=0 stat is dominated by EXPECTED buckets and
 * the real main-thread cross-turn bug (if any) is invisible in BQ.
 */
export type DeferredToolsDeltaScanContext = {
    callSite: 'attachments_main' | 'attachments_subagent' | 'compact_full' | 'compact_partial' | 'reactive_compact';
    querySource?: string;
};
/**
 * True → announce deferred tools via persisted delta attachments.
 * False → claude.ts keeps its per-call <available-deferred-tools>
 * header prepend (the attachment does not fire).
 */
export declare function isDeferredToolsDeltaEnabled(): boolean;
/**
 * Diff the current deferred-tool pool against what's already been
 * announced in this conversation (reconstructed by scanning for prior
 * deferred_tools_delta attachments). Returns null if nothing changed.
 *
 * A name that was announced but has since stopped being deferred — yet
 * is still in the base pool — is NOT reported as removed. It's now
 * loaded directly, so telling the model "no longer available" would be
 * wrong.
 */
export declare function getDeferredToolsDelta(tools: Tools, messages: Message[], scanContext?: DeferredToolsDeltaScanContext): DeferredToolsDelta | null;
//# sourceMappingURL=toolSearch.d.ts.map