import type { AppState } from 'src/state/AppState.js';
import type { HooksSettings } from '../settings/types.js';
/**
 * Registers hooks from a skill's frontmatter as session hooks.
 *
 * Hooks are registered as session-scoped hooks that persist for the duration
 * of the session. If a hook has `once: true`, it will be automatically removed
 * after its first successful execution.
 *
 * @param setAppState - Function to update the app state
 * @param sessionId - The current session ID
 * @param hooks - The hooks settings from the skill's frontmatter
 * @param skillName - The name of the skill (for logging)
 * @param skillRoot - The base directory of the skill (for CLAUDE_PLUGIN_ROOT env var)
 */
export declare function registerSkillHooks(setAppState: (updater: (prev: AppState) => AppState) => void, sessionId: string, hooks: HooksSettings, skillName: string, skillRoot?: string): void;
//# sourceMappingURL=registerSkillHooks.d.ts.map