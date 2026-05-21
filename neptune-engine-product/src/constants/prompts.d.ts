import type { Tools } from '../Tool.js';
import type { MCPServerConnection } from '../services/mcp/types.js';
export declare const CLAUDE_CODE_DOCS_MAP_URL = "https://code.claude.com/docs/en/claude_code_docs_map.md";
/**
 * Boundary marker separating static (cross-org cacheable) content from dynamic content.
 * Everything BEFORE this marker in the system prompt array can use scope: 'global'.
 * Everything AFTER contains user/session-specific content and should not be cached.
 *
 * WARNING: Do not remove or reorder this marker without updating cache logic in:
 * - src/utils/api.ts (splitSysPromptPrefix)
 * - src/services/api/claude.ts (buildSystemPromptBlocks)
 */
export declare const SYSTEM_PROMPT_DYNAMIC_BOUNDARY = "__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__";
export declare function prependBullets(items: Array<string | string[]>): string[];
export declare function getSystemPrompt(tools: Tools, model: string, additionalWorkingDirectories?: string[], mcpClients?: MCPServerConnection[]): Promise<string[]>;
export declare function computeEnvInfo(modelId: string, additionalWorkingDirectories?: string[]): Promise<string>;
export declare function computeSimpleEnvInfo(modelId: string, additionalWorkingDirectories?: string[]): Promise<string>;
export declare function getUnameSR(): string;
export declare const DEFAULT_AGENT_PROMPT = "You are an agent for Claude Code, Anthropic's official CLI for Claude. Given the user's message, you should use the tools available to complete the task. Complete the task fully\u2014don't gold-plate, but don't leave it half-done. When you complete the task, respond with a concise report covering what was done and any key findings \u2014 the caller will relay this to the user, so it only needs the essentials.";
export declare function enhanceSystemPromptWithEnvDetails(existingSystemPrompt: string[], model: string, additionalWorkingDirectories?: string[], enabledToolNames?: ReadonlySet<string>): Promise<string[]>;
/**
 * Returns instructions for using the scratchpad directory if enabled.
 * The scratchpad is a per-session directory where Claude can write temporary files.
 */
export declare function getScratchpadInstructions(): string | null;
//# sourceMappingURL=prompts.d.ts.map