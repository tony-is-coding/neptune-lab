import { type ToolPermissionContext, type Tools, type ToolUseContext } from '../Tool.js';
import type { AgentDefinition, AgentDefinitionsResult } from '@neptune/builtin-tools/tools/AgentTool/loadAgentsDir.js';
import type { Message } from '../types/message.js';
import type { SettingSource } from './settings/constants.js';
import type { Theme } from './theme.js';
/**
 * Fixed token overhead added by the API when tools are present.
 * The API adds a tool prompt preamble (~500 tokens) once per API call when tools are present.
 * When we count tools individually via the token counting API, each call includes this overhead,
 * leading to N × overhead instead of 1 × overhead for N tools.
 * We subtract this overhead from per-tool counts to show accurate tool content sizes.
 */
export declare const TOOL_TOKEN_COUNT_OVERHEAD = 500;
interface ContextCategory {
    name: string;
    tokens: number;
    color: keyof Theme;
    /** When true, these tokens are deferred and don't count toward context usage */
    isDeferred?: boolean;
}
interface GridSquare {
    color: keyof Theme;
    isFilled: boolean;
    categoryName: string;
    tokens: number;
    percentage: number;
    squareFullness: number;
}
interface MemoryFile {
    path: string;
    type: string;
    tokens: number;
}
interface McpTool {
    name: string;
    serverName: string;
    tokens: number;
    isLoaded?: boolean;
}
export interface DeferredBuiltinTool {
    name: string;
    tokens: number;
    isLoaded: boolean;
}
export interface SystemToolDetail {
    name: string;
    tokens: number;
}
export interface SystemPromptSectionDetail {
    name: string;
    tokens: number;
}
interface Agent {
    agentType: string;
    source: SettingSource | 'built-in' | 'plugin';
    tokens: number;
}
interface SlashCommandInfo {
    readonly totalCommands: number;
    readonly includedCommands: number;
    readonly tokens: number;
}
/** Individual skill detail for context display */
interface SkillFrontmatter {
    name: string;
    source: SettingSource | 'plugin';
    tokens: number;
}
/**
 * Information about skills included in the context window.
 */
interface SkillInfo {
    /** Total number of available skills */
    readonly totalSkills: number;
    /** Number of skills included within token budget */
    readonly includedSkills: number;
    /** Total tokens consumed by skills */
    readonly tokens: number;
    /** Individual skill details */
    readonly skillFrontmatter: SkillFrontmatter[];
}
export interface ContextData {
    readonly categories: ContextCategory[];
    readonly totalTokens: number;
    readonly maxTokens: number;
    readonly rawMaxTokens: number;
    readonly percentage: number;
    readonly gridRows: GridSquare[][];
    readonly model: string;
    readonly memoryFiles: MemoryFile[];
    readonly mcpTools: McpTool[];
    /** Ant-only: per-tool breakdown of deferred built-in tools */
    readonly deferredBuiltinTools?: DeferredBuiltinTool[];
    /** Ant-only: per-tool breakdown of always-loaded built-in tools */
    readonly systemTools?: SystemToolDetail[];
    /** Ant-only: per-section breakdown of system prompt */
    readonly systemPromptSections?: SystemPromptSectionDetail[];
    readonly agents: Agent[];
    readonly slashCommands?: SlashCommandInfo;
    /** Skill statistics */
    readonly skills?: SkillInfo;
    readonly autoCompactThreshold?: number;
    readonly isAutoCompactEnabled: boolean;
    messageBreakdown?: {
        toolCallTokens: number;
        toolResultTokens: number;
        attachmentTokens: number;
        assistantMessageTokens: number;
        userMessageTokens: number;
        toolCallsByType: Array<{
            name: string;
            callTokens: number;
            resultTokens: number;
        }>;
        attachmentsByType: Array<{
            name: string;
            tokens: number;
        }>;
    };
    /** Actual token usage from last API response (if available) */
    readonly apiUsage: {
        input_tokens: number;
        output_tokens: number;
        cache_creation_input_tokens: number;
        cache_read_input_tokens: number;
    } | null;
}
export declare function countToolDefinitionTokens(tools: Tools, getToolPermissionContext: () => Promise<ToolPermissionContext>, agentInfo: AgentDefinitionsResult | null, model?: string): Promise<number>;
export declare function countMcpToolTokens(tools: Tools, getToolPermissionContext: () => Promise<ToolPermissionContext>, agentInfo: AgentDefinitionsResult | null, model: string, messages?: Message[]): Promise<{
    mcpToolTokens: number;
    mcpToolDetails: McpTool[];
    deferredToolTokens: number;
    loadedMcpToolNames: Set<string>;
}>;
export declare function analyzeContextUsage(messages: Message[], model: string, getToolPermissionContext: () => Promise<ToolPermissionContext>, tools: Tools, agentDefinitions: AgentDefinitionsResult, terminalWidth?: number, toolUseContext?: Pick<ToolUseContext, 'options'>, mainThreadAgentDefinition?: AgentDefinition, 
/** Original messages before microcompact, used to extract API usage */
originalMessages?: Message[]): Promise<ContextData>;
export {};
//# sourceMappingURL=analyzeContext.d.ts.map