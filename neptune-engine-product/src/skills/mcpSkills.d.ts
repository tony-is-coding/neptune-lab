import type { Command } from '../commands.js';
import type { MCPServerConnection } from '../services/mcp/types.js';
/**
 * Discovers skills exposed as `skill://` resources by an MCP server.
 *
 * Each matching resource is read, its markdown content is parsed for
 * frontmatter, and the result is converted into a Command that the skill
 * system can index and invoke just like a local `.md` skill file.
 *
 * Memoized by server name so repeated calls within a connection lifecycle
 * return the cached result. Callers invalidate via `.cache.delete(name)`.
 */
export declare const fetchMcpSkillsForClient: {
    (client: MCPServerConnection): Promise<Command[]>;
    cache: {
        clear: () => void;
        size: () => number;
        delete: (key: string) => boolean;
        get: (key: string) => Promise<Command[]>;
        has: (key: string) => boolean;
    };
};
//# sourceMappingURL=mcpSkills.d.ts.map