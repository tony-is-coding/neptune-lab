import z from 'zod/v4';
import type { PermissionBehavior, PermissionRule, PermissionRuleSource, PermissionRuleValue } from '../../types/permissions.js';
export type { PermissionBehavior, PermissionRule, PermissionRuleSource, PermissionRuleValue, };
/**
 * ToolPermissionBehavior is the behavior associated with a permission rule.
 * 'allow' means the rule allows the tool to run.
 * 'deny' means the rule denies the tool from running.
 * 'ask' means the rule forces a prompt to be shown to the user.
 */
export declare const permissionBehaviorSchema: () => z.ZodEnum<{
    deny: "deny";
    allow: "allow";
    ask: "ask";
}>;
/**
 * PermissionRuleValue is the content of a permission rule.
 * @param toolName - The name of the tool this rule applies to
 * @param ruleContent - The optional content of the rule.
 *   Each tool may implement custom handling in `checkPermissions()`
 */
export declare const permissionRuleValueSchema: () => z.ZodObject<{
    toolName: z.ZodString;
    ruleContent: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=PermissionRule.d.ts.map