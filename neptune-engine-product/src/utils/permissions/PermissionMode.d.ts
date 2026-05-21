import z from 'zod/v4';
import { EXTERNAL_PERMISSION_MODES, type ExternalPermissionMode, PERMISSION_MODES, type PermissionMode } from '../../types/permissions.js';
export { EXTERNAL_PERMISSION_MODES, PERMISSION_MODES, type ExternalPermissionMode, type PermissionMode, };
export declare const permissionModeSchema: () => z.ZodEnum<{
    plan: "plan";
    auto: "auto";
    default: "default";
    acceptEdits: "acceptEdits";
    bypassPermissions: "bypassPermissions";
    dontAsk: "dontAsk";
}>;
export declare const externalPermissionModeSchema: () => z.ZodEnum<{
    plan: "plan";
    default: "default";
    acceptEdits: "acceptEdits";
    bypassPermissions: "bypassPermissions";
    dontAsk: "dontAsk";
}>;
type ModeColorKey = 'text' | 'planMode' | 'permission' | 'autoAccept' | 'error' | 'warning';
/**
 * Type guard to check if a PermissionMode is an ExternalPermissionMode.
 * auto is ant-only and excluded from external modes.
 */
export declare function isExternalPermissionMode(mode: PermissionMode): mode is ExternalPermissionMode;
export declare function toExternalPermissionMode(mode: PermissionMode): ExternalPermissionMode;
export declare function permissionModeFromString(str: string): PermissionMode;
export declare function permissionModeTitle(mode: PermissionMode): string;
export declare function isDefaultMode(mode: PermissionMode | undefined): boolean;
export declare function permissionModeShortTitle(mode: PermissionMode): string;
export declare function permissionModeSymbol(mode: PermissionMode): string;
export declare function getModeColor(mode: PermissionMode): ModeColorKey;
//# sourceMappingURL=PermissionMode.d.ts.map