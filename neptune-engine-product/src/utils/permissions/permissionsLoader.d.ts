import { type EditableSettingSource, type SettingSource } from '../settings/constants.js';
import type { PermissionBehavior, PermissionRule, PermissionRuleValue } from './PermissionRule.js';
/**
 * Returns true if allowManagedPermissionRulesOnly is enabled in managed settings (policySettings).
 * When enabled, only permission rules from managed settings are respected.
 */
export declare function shouldAllowManagedPermissionRulesOnly(): boolean;
/**
 * Returns true if "always allow" options should be shown in permission prompts.
 * When allowManagedPermissionRulesOnly is enabled, these options are hidden.
 */
export declare function shouldShowAlwaysAllowOptions(): boolean;
/**
 * Loads all permission rules from all relevant sources (managed and project settings)
 * @returns Array of all permission rules
 */
export declare function loadAllPermissionRulesFromDisk(): PermissionRule[];
/**
 * Loads permission rules from a specific source
 * @param source The source to load from
 * @returns Array of permission rules from that source
 */
export declare function getPermissionRulesForSource(source: SettingSource): PermissionRule[];
export type PermissionRuleFromEditableSettings = PermissionRule & {
    source: EditableSettingSource;
};
/**
 * Deletes a rule from the project permissions file
 * @param rule The rule to delete
 * @returns Promise resolving to a boolean indicating success
 */
export declare function deletePermissionRuleFromSettings(rule: PermissionRuleFromEditableSettings): boolean;
/**
 * Adds rules to the project permissions file
 * @param ruleValues The rule values to add
 * @returns Promise resolving to a boolean indicating success
 */
export declare function addPermissionRulesToSettings({ ruleValues, ruleBehavior, }: {
    ruleValues: PermissionRuleValue[];
    ruleBehavior: PermissionBehavior;
}, source: EditableSettingSource): boolean;
//# sourceMappingURL=permissionsLoader.d.ts.map