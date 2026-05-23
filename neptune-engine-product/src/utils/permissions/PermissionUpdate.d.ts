import type { ToolPermissionContext } from '../../Tool.js';
import type { AdditionalWorkingDirectory, WorkingDirectorySource } from '../../types/permissions.js';
import type { EditableSettingSource } from '../settings/constants.js';
import type { PermissionRuleValue } from './PermissionRule.js';
import type { PermissionUpdate, PermissionUpdateDestination } from './PermissionUpdateSchema.js';
export type { AdditionalWorkingDirectory, WorkingDirectorySource };
export declare function extractRules(updates: PermissionUpdate[] | undefined): PermissionRuleValue[];
export declare function hasRules(updates: PermissionUpdate[] | undefined): boolean;
/**
 * Applies a single permission update to the context and returns the updated context
 * @param context The current permission context
 * @param update The permission update to apply
 * @returns The updated permission context
 */
export declare function applyPermissionUpdate(context: ToolPermissionContext, update: PermissionUpdate): ToolPermissionContext;
/**
 * Applies multiple permission updates to the context and returns the updated context
 * @param context The current permission context
 * @param updates The permission updates to apply
 * @returns The updated permission context
 */
export declare function applyPermissionUpdates(context: ToolPermissionContext, updates: PermissionUpdate[]): ToolPermissionContext;
export declare function supportsPersistence(destination: PermissionUpdateDestination): destination is EditableSettingSource;
/**
 * Persists a permission update to the appropriate settings source
 * @param update The permission update to persist
 */
export declare function persistPermissionUpdate(update: PermissionUpdate): void;
/**
 * Persists multiple permission updates to the appropriate settings sources
 * Only persists updates with persistable sources
 * @param updates The permission updates to persist
 */
export declare function persistPermissionUpdates(updates: PermissionUpdate[]): void;
/**
 * Creates a Read rule suggestion for a directory.
 * @param dirPath The directory path to create a rule for
 * @param destination The destination for the permission rule (defaults to 'session')
 * @returns A PermissionUpdate for a Read rule, or undefined for the root directory
 */
export declare function createReadRuleSuggestion(dirPath: string, destination?: PermissionUpdateDestination): PermissionUpdate | undefined;
//# sourceMappingURL=PermissionUpdate.d.ts.map