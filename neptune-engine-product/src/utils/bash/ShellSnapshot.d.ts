/**
 * Creates ripgrep shell integration (alias or function)
 * @returns Object with type and the shell snippet to use
 */
export declare function createRipgrepShellIntegration(): {
    type: 'alias' | 'function';
    snippet: string;
};
/**
 * Creates shell integration for `find` and `grep`, backed by bfs and ugrep
 * embedded in the bun binary (ant-native only). Unlike the rg integration,
 * this always shadows the system find/grep since bfs/ugrep are drop-in
 * replacements and we want consistent fast behavior.
 *
 * These wrappers replace the GlobTool/GrepTool dedicated tools (which are
 * removed from the tool registry when embedded search tools are available),
 * so they're tuned to match those tools' semantics, not GNU find/grep.
 *
 * `find` ↔ GlobTool:
 * - Inject `-regextype findutils-default`: bfs defaults to POSIX BRE for
 *   -regex, but GNU find defaults to emacs-flavor (which supports `\|`
 *   alternation). Without this, `find . -regex '.*\.\(js\|ts\)'` silently
 *   returns zero results. A later user-supplied -regextype still overrides.
 * - No gitignore filtering: GlobTool passes `--no-ignore` to rg. bfs has no
 *   gitignore support anyway, so this matches by default.
 * - Hidden files included: both GlobTool (`--hidden`) and bfs's default.
 *
 * Caveat: even with findutils-default, Oniguruma (bfs's regex engine) uses
 * leftmost-first alternation, not POSIX leftmost-longest. Patterns where
 * one alternative is a prefix of another (e.g., `\(ts\|tsx\)`) may miss
 * matches that GNU find catches. Workaround: put the longer alternative first.
 *
 * `grep` ↔ GrepTool (file filtering) + GNU grep (regex syntax):
 * - `-G` (basic regex / BRE): GNU grep defaults to BRE where `\|` is
 *   alternation. ugrep defaults to ERE where `|` is alternation and `\|` is a
 *   literal pipe. Without -G, `grep "foo\|bar"` silently returns zero results.
 *   User-supplied `-E`, `-F`, or `-P` later in argv overrides this.
 * - `--ignore-files`: respect .gitignore (GrepTool uses rg's default, which
 *   respects gitignore). Override with `grep --no-ignore-files`.
 * - `--hidden`: include hidden files (GrepTool passes `--hidden` to rg).
 *   Override with `grep --no-hidden`.
 * - `--exclude-dir` for VCS dirs: GrepTool passes `--glob '!.git'` etc. to rg.
 * - `-I`: skip binary files. rg's recursion silently skips binary matches
 *   by default (different from direct-file-arg behavior); ugrep doesn't, so
 *   we inject -I to match. Override with `grep -a`.
 *
 * Not replicated from GrepTool:
 * - `--max-columns 500`: ugrep's `--width` hard-truncates output which could
 *   break pipelines; rg's version replaces the line with a placeholder.
 * - Read deny rules / plugin cache exclusions: require toolPermissionContext
 *   which isn't available at shell-snapshot creation time.
 *
 * Returns null if embedded search tools are not available in this build.
 */
export declare function createFindGrepShellIntegration(): string | null;
/**
 * Creates and saves the shell environment snapshot by loading the user's shell configuration
 *
 * This function is a critical part of Claude CLI's shell integration strategy. It:
 *
 * 1. Identifies the user's shell config file (.zshrc, .bashrc, etc.)
 * 2. Creates a temporary script that sources this configuration file
 * 3. Captures the resulting shell environment state including:
 *    - Functions defined in the user's shell configuration
 *    - Shell options and settings that affect command behavior
 *    - Aliases that the user has defined
 *
 * The snapshot is saved to a temporary file that can be sourced by subsequent shell
 * commands, ensuring they run with the user's expected environment, aliases, and functions.
 *
 * This approach allows Claude CLI to execute commands as if they were run in the user's
 * interactive shell, while avoiding the overhead of creating a new login shell for each command.
 * It handles both Bash and Zsh shells with their different syntax for functions, options, and aliases.
 *
 * If the snapshot creation fails (e.g., timeout, permissions issues), the CLI will still
 * function but without the user's custom shell environment, potentially missing aliases
 * and functions the user relies on.
 *
 * @returns Promise that resolves to the snapshot file path or undefined if creation failed
 */
export declare const createAndSaveSnapshot: (binShell: string) => Promise<string | undefined>;
//# sourceMappingURL=ShellSnapshot.d.ts.map