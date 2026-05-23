/**
 * Undercover mode — safety utilities for contributing to public/open-source repos.
 *
 * When active, Claude Code adds safety instructions to commit/PR prompts and
 * strips all attribution to avoid leaking internal model codenames, project
 * names, or other Anthropic-internal information. The model is not told what
 * model it is.
 *
 * Activation:
 *   - CLAUDE_CODE_UNDERCOVER=1 — force ON (even in internal repos)
 *   - Otherwise AUTO: active UNLESS the repo remote matches the internal
 *     allowlist (INTERNAL_MODEL_REPOS in commitAttribution.ts). Safe default
 *     is ON — Claude may push to public remotes from a CWD that isn't itself
 *     a git checkout (e.g. /tmp crash repro).
 *   - There is NO force-OFF. This guards against model codename leaks — if
 *     we're not confident we're in an internal repo, we stay undercover.
 *
 * All code paths are gated on process.env.USER_TYPE === 'ant'. Since USER_TYPE is
 * a build-time --define, the bundler constant-folds these checks and dead-code-
 * eliminates the ant-only branches from external builds. In external builds every
 * function in this file reduces to a trivial return.
 */
export declare function isUndercover(): boolean;
export declare function getUndercoverInstructions(): string;
/**
 * Check whether to show the one-time explainer dialog for auto-undercover.
 * True when: undercover is active via auto-detection (not forced via env),
 * and the user hasn't seen the notice before. Pure — the component marks the
 * flag on mount.
 */
export declare function shouldShowUndercoverAutoNotice(): boolean;
//# sourceMappingURL=undercover.d.ts.map