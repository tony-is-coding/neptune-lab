import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import type { ToolUseContext } from '../Tool.js';
import type { Command } from '../types/command.js';
import type { HooksSettings } from '../utils/settings/types.js';
/**
 * Definition for a bundled skill that ships with the CLI.
 * These are registered programmatically at startup.
 */
export type BundledSkillDefinition = {
    name: string;
    description: string;
    aliases?: string[];
    whenToUse?: string;
    argumentHint?: string;
    allowedTools?: string[];
    model?: string;
    disableModelInvocation?: boolean;
    userInvocable?: boolean;
    isEnabled?: () => boolean;
    hooks?: HooksSettings;
    context?: 'inline' | 'fork';
    agent?: string;
    /**
     * Additional reference files to extract to disk on first invocation.
     * Keys are relative paths (forward slashes, no `..`), values are content.
     * When set, the skill prompt is prefixed with a "Base directory for this
     * skill: <dir>" line so the model can Read/Grep these files on demand —
     * same contract as disk-based skills.
     */
    files?: Record<string, string>;
    getPromptForCommand: (args: string, context: ToolUseContext) => Promise<ContentBlockParam[]>;
};
/**
 * Register a bundled skill that will be available to the model.
 * Call this at module initialization or in an init function.
 *
 * Bundled skills are compiled into the CLI binary and available to all users.
 * They follow the same pattern as registerPostSamplingHook() for internal features.
 */
export declare function registerBundledSkill(definition: BundledSkillDefinition): void;
/**
 * Get all registered bundled skills.
 * Returns a copy to prevent external mutation.
 */
export declare function getBundledSkills(): Command[];
/**
 * Clear bundled skills registry (for testing).
 */
export declare function clearBundledSkills(): void;
/**
 * Deterministic extraction directory for a bundled skill's reference files.
 */
export declare function getBundledSkillExtractDir(skillName: string): string;
//# sourceMappingURL=bundledSkills.d.ts.map