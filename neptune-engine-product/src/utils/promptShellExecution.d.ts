import type { ToolUseContext } from '../Tool.js';
import type { FrontmatterShell } from './frontmatterParser.js';
/**
 * Parses prompt text and executes any embedded shell commands.
 * Supports two syntaxes:
 * - Code blocks: ```! command ```
 * - Inline: !`command`
 *
 * @param shell - Shell to route commands through. Defaults to bash.
 *   This is *never* read from settings.defaultShell — it comes from .md
 *   frontmatter (author's choice) or is undefined for built-in commands.
 *   See docs/design/ps-shell-selection.md §5.3.
 */
export declare function executeShellCommandsInPrompt(text: string, context: ToolUseContext, slashCommandName: string, shell?: FrontmatterShell): Promise<string>;
//# sourceMappingURL=promptShellExecution.d.ts.map