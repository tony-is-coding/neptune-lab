/**
 * Safe wrappers for shell-quote library functions that handle errors gracefully
 * These are drop-in replacements for the original functions
 */
import { type ParseEntry } from 'shell-quote';
export type { ParseEntry } from 'shell-quote';
export type ShellParseResult = {
    success: true;
    tokens: ParseEntry[];
} | {
    success: false;
    error: string;
};
export type ShellQuoteResult = {
    success: true;
    quoted: string;
} | {
    success: false;
    error: string;
};
export declare function tryParseShellCommand(cmd: string, env?: Record<string, string | undefined> | ((key: string) => string | undefined)): ShellParseResult;
export declare function tryQuoteShellArgs(args: unknown[]): ShellQuoteResult;
/**
 * Checks if parsed tokens contain malformed entries that suggest shell-quote
 * misinterpreted the command. This happens when input contains ambiguous
 * patterns (like JSON-like strings with semicolons) that shell-quote parses
 * according to shell rules, producing token fragments.
 *
 * For example, `echo {"hi":"hi;evil"}` gets parsed with `;` as an operator,
 * producing tokens like `{hi:"hi` (unbalanced brace). Legitimate commands
 * produce complete, balanced tokens.
 *
 * Also detects unterminated quotes in the original command: shell-quote
 * silently drops an unmatched `"` or `'` and parses the rest as unquoted,
 * leaving no trace in the tokens. `echo "hi;evil | cat` (one unmatched `"`)
 * is a bash syntax error, but shell-quote yields clean tokens with `;` as
 * an operator. The token-level checks below can't catch this, so we walk
 * the original command with bash quote semantics and flag odd parity.
 *
 * Security: This prevents command injection via HackerOne #3482049 where
 * shell-quote's correct parsing of ambiguous input can be exploited.
 */
export declare function hasMalformedTokens(command: string, parsed: ParseEntry[]): boolean;
/**
 * Detects commands containing '\' patterns that exploit the shell-quote library's
 * incorrect handling of backslashes inside single quotes.
 *
 * In bash, single quotes preserve ALL characters literally - backslash has no
 * special meaning. So '\' is just the string \ (the quote opens, contains \,
 * and the next ' closes it). But shell-quote incorrectly treats \ as an escape
 * character inside single quotes, causing '\' to NOT close the quoted string.
 *
 * This means the pattern '\' <payload> '\' hides <payload> from security checks
 * because shell-quote thinks it's all one single-quoted string.
 */
export declare function hasShellQuoteSingleQuoteBug(command: string): boolean;
export declare function quote(args: ReadonlyArray<unknown>): string;
//# sourceMappingURL=shellQuote.d.ts.map