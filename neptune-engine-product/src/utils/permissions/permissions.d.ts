import type { CanUseToolFn } from '../../types/permissions.js';
import type { Tool, ToolPermissionContext, ToolUseContext } from '../../Tool.js';
import type { PermissionAskDecision, PermissionDecisionReason, PermissionDenyDecision } from './PermissionResult.js';
import type { PermissionBehavior, PermissionRule, PermissionRuleSource } from './PermissionRule.js';
export declare function permissionRuleSourceDisplayString(source: PermissionRuleSource): string;
export declare function getAllowRules(context: ToolPermissionContext): PermissionRule[];
/**
 * Creates a permission request message that explain the permission request
 */
export declare function createPermissionRequestMessage(toolName: string, decisionReason?: PermissionDecisionReason): string;
export declare function getDenyRules(context: ToolPermissionContext): PermissionRule[];
export declare function getAskRules(context: ToolPermissionContext): PermissionRule[];
/**
 * Check if the entire tool is listed in the always allow rules
 * For example, this finds "Bash" but not "Bash(prefix:*)" for BashTool
 */
export declare function toolAlwaysAllowedRule(context: ToolPermissionContext, tool: Pick<Tool, 'name' | 'mcpInfo'>): PermissionRule | null;
/**
 * Check if the tool is listed in the always deny rules
 */
export declare function getDenyRuleForTool(context: ToolPermissionContext, tool: Pick<Tool, 'name' | 'mcpInfo'>): PermissionRule | null;
/**
 * Check if the tool is listed in the always ask rules
 */
export declare function getAskRuleForTool(context: ToolPermissionContext, tool: Pick<Tool, 'name' | 'mcpInfo'>): PermissionRule | null;
/**
 * Check if a specific agent is denied via Agent(agentType) syntax.
 * For example, Agent(Explore) would deny the Explore agent.
 */
export declare function getDenyRuleForAgent(context: ToolPermissionContext, agentToolName: string, agentType: string): PermissionRule | null;
/**
 * Filter agents to exclude those that are denied via Agent(agentType) syntax.
 */
export declare function filterDeniedAgents<T extends {
    agentType: string;
}>(agents: T[], context: ToolPermissionContext, agentToolName: string): T[];
/**
 * Map of rule contents to the associated rule for a given tool.
 * e.g. the string key is "prefix:*" from "Bash(prefix:*)" for BashTool
 */
export declare function getRuleByContentsForTool(context: ToolPermissionContext, tool: Tool, behavior: PermissionBehavior): Map<string, PermissionRule>;
export declare function getRuleByContentsForToolName(context: ToolPermissionContext, toolName: string, behavior: PermissionBehavior): Map<string, PermissionRule>;
export declare const hasPermissionsToUseTool: CanUseToolFn;
/**
 * Check only the rule-based steps of the permission pipeline — the subset
 * that bypassPermissions mode respects (everything that fires before step 2a).
 *
 * Returns a deny/ask decision if a rule blocks the tool, or null if no rule
 * objects. Unlike hasPermissionsToUseTool, this does NOT run the auto mode classifier,
 * mode-based transformations (dontAsk/auto/asyncAgent), PermissionRequest hooks,
 * or bypassPermissions / always-allowed checks.
 *
 * Caller must pre-check tool.requiresUserInteraction() — step 1e is not replicated.
 */
export declare function checkRuleBasedPermissions(tool: Tool, input: {
    [key: string]: unknown;
}, context: ToolUseContext): Promise<PermissionAskDecision | PermissionDenyDecision | null>;
type EditPermissionRuleArgs = {
    initialContext: ToolPermissionContext;
    setToolPermissionContext: (updatedContext: ToolPermissionContext) => void;
};
/**
 * Delete a permission rule from the appropriate destination
 */
export declare function deletePermissionRule({ rule, initialContext, setToolPermissionContext, }: EditPermissionRuleArgs & {
    rule: PermissionRule;
}): Promise<void>;
/**
 * Apply permission rules to context (additive - for initial setup)
 */
export declare function applyPermissionRulesToPermissionContext(toolPermissionContext: ToolPermissionContext, rules: PermissionRule[]): ToolPermissionContext;
/**
 * Sync permission rules from disk (replacement - for settings changes)
 */
export declare function syncPermissionRulesFromDisk(toolPermissionContext: ToolPermissionContext, rules: PermissionRule[]): ToolPermissionContext;
export {};
//# sourceMappingURL=permissions.d.ts.map