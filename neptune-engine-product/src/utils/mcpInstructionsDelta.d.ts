import type { MCPServerConnection } from '../services/mcp/types.js';
import type { Message } from '../types/message.js';
export type McpInstructionsDelta = {
    /** Server names — for stateless-scan reconstruction. */
    addedNames: string[];
    /** Rendered "## {name}\n{instructions}" blocks for addedNames. */
    addedBlocks: string[];
    removedNames: string[];
};
/**
 * Client-authored instruction block to announce when a server connects,
 * in addition to (or instead of) the server's own `InitializeResult.instructions`.
 * Lets first-party servers (e.g., claude-in-chrome) carry client-side
 * context the server itself doesn't know about.
 */
export type ClientSideInstruction = {
    serverName: string;
    block: string;
};
/**
 * True → announce MCP server instructions via persisted delta attachments.
 * False → prompts.ts keeps its DANGEROUS_uncachedSystemPromptSection
 * (rebuilt every turn; cache-busts on late connect).
 *
 * Env override for local testing: CLAUDE_CODE_MCP_INSTR_DELTA=true/false
 * wins over both ant bypass and the GrowthBook gate.
 */
export declare function isMcpInstructionsDeltaEnabled(): boolean;
/**
 * Diff the current set of connected MCP servers that have instructions
 * (server-authored via InitializeResult, or client-side synthesized)
 * against what's already been announced in this conversation. Null if
 * nothing changed.
 *
 * Instructions are immutable for the life of a connection (set once at
 * handshake), so the scan diffs on server NAME, not on content.
 */
export declare function getMcpInstructionsDelta(mcpClients: MCPServerConnection[], messages: Message[], clientSideInstructions: ClientSideInstruction[]): McpInstructionsDelta | null;
//# sourceMappingURL=mcpInstructionsDelta.d.ts.map