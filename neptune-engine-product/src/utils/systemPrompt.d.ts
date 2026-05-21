import type { ToolUseContext } from '../Tool.js';
import type { AgentDefinition } from '@neptune/builtin-tools/tools/AgentTool/loadAgentsDir.js';
import { type SystemPrompt } from './systemPromptType.js';
export { asSystemPrompt, type SystemPrompt } from './systemPromptType.js';
/**
 * Builds the effective system prompt array based on priority:
 * 0. Override system prompt (if set, e.g., via loop mode - REPLACES all other prompts)
 * 1. Coordinator system prompt (if coordinator mode is active)
 * 2. Agent system prompt (if mainThreadAgentDefinition is set)
 *    - In proactive mode: agent prompt is APPENDED to default (agent adds domain
 *      instructions on top of the autonomous agent prompt, like teammates do)
 *    - Otherwise: agent prompt REPLACES default
 * 3. Custom system prompt (if specified via --system-prompt)
 * 4. Default system prompt (the standard Claude Code prompt)
 *
 * Plus appendSystemPrompt is always added at the end if specified (except when override is set).
 */
export declare function buildEffectiveSystemPrompt({ mainThreadAgentDefinition, toolUseContext, customSystemPrompt, defaultSystemPrompt, appendSystemPrompt, overrideSystemPrompt, }: {
    mainThreadAgentDefinition: AgentDefinition | undefined;
    toolUseContext: Pick<ToolUseContext, 'options'>;
    customSystemPrompt: string | undefined;
    defaultSystemPrompt: string[];
    appendSystemPrompt: string | undefined;
    overrideSystemPrompt?: string | null;
}): SystemPrompt;
//# sourceMappingURL=systemPrompt.d.ts.map