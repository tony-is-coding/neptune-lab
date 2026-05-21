import type { EffortLevel } from 'src/entrypoints/sdk/runtimeTypes.js';
export type { EffortLevel };
export declare const EFFORT_LEVELS: readonly ["low", "medium", "high", "max"];
export type EffortValue = EffortLevel | number;
export declare function modelSupportsEffort(model: string): boolean;
export declare function modelSupportsMaxEffort(model: string): boolean;
export declare function isEffortLevel(value: string): value is EffortLevel;
export declare function parseEffortValue(value: unknown): EffortValue | undefined;
/**
 * Numeric values are model-default only and not persisted.
 * 'max' is session-scoped for external users (ants can persist it).
 * Write sites call this before saving to settings so the Zod schema
 * (which only accepts string levels) never rejects a write.
 */
export declare function toPersistableEffort(value: EffortValue | undefined): EffortLevel | undefined;
export declare function getInitialEffortSetting(): EffortLevel | undefined;
/**
 * Decide what effort level (if any) to persist when the user selects a model
 * in ModelPicker. Keeps an explicit prior /effort choice sticky even when it
 * matches the picked model's default, while letting purely-default and
 * session-ephemeral effort (CLI --effort, EffortCallout default) fall through
 * to undefined so it follows future model-default changes.
 *
 * priorPersisted must come from userSettings on disk
 * (getSettingsForSource('userSettings')?.effortLevel), NOT merged settings
 * (project/policy layers would leak into the user's global settings.json)
 * and NOT AppState.effortValue (includes session-scoped sources that
 * deliberately do not write to settings.json).
 */
export declare function resolvePickerEffortPersistence(picked: EffortLevel | undefined, modelDefault: EffortLevel, priorPersisted: EffortLevel | undefined, toggledInPicker: boolean): EffortLevel | undefined;
export declare function getEffortEnvOverride(): EffortValue | null | undefined;
/**
 * Resolve the effort value that will actually be sent to the API for a given
 * model, following the full precedence chain:
 *   env CLAUDE_CODE_EFFORT_LEVEL → appState.effortValue → model default
 *
 * Returns undefined when no effort parameter should be sent (env set to
 * 'unset', or no default exists for the model).
 */
export declare function resolveAppliedEffort(model: string, appStateEffortValue: EffortValue | undefined): EffortValue | undefined;
/**
 * Resolve the effort level to show the user. Wraps resolveAppliedEffort
 * with the 'high' fallback (what the API uses when no effort param is sent).
 * Single source of truth for the status bar and /effort output (CC-1088).
 */
export declare function getDisplayedEffortLevel(model: string, appStateEffort: EffortValue | undefined): EffortLevel;
/**
 * Build the ` with {level} effort` suffix shown in Logo/Spinner.
 * Returns empty string if the user hasn't explicitly set an effort value.
 * Delegates to resolveAppliedEffort() so the displayed level matches what
 * the API actually receives (including max→high clamp for non-Opus models).
 */
export declare function getEffortSuffix(model: string, effortValue: EffortValue | undefined): string;
export declare function isValidNumericEffort(value: number): boolean;
export declare function convertEffortValueToLevel(value: EffortValue): EffortLevel;
/**
 * Get user-facing description for effort levels
 *
 * @param level The effort level to describe
 * @returns Human-readable description
 */
export declare function getEffortLevelDescription(level: EffortLevel): string;
/**
 * Get user-facing description for effort values (both string and numeric)
 *
 * @param value The effort value to describe
 * @returns Human-readable description
 */
export declare function getEffortValueDescription(value: EffortValue): string;
export type OpusDefaultEffortConfig = {
    enabled: boolean;
    dialogTitle: string;
    dialogDescription: string;
};
export declare function getOpusDefaultEffortConfig(): OpusDefaultEffortConfig;
export declare function getDefaultEffortForModel(model: string): EffortValue | undefined;
//# sourceMappingURL=effort.d.ts.map