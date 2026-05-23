/**
 * Pattern lists for dangerous shell-tool allow-rule prefixes.
 *
 * An allow rule like `Bash(python:*)` or `PowerShell(node:*)` lets the model
 * run arbitrary code via that interpreter, bypassing the auto-mode classifier.
 * These lists feed the isDangerous{Bash,PowerShell}Permission predicates in
 * permissionSetup.ts, which strip such rules at auto-mode entry.
 *
 * The matcher in each predicate handles the rule-shape variants (exact, `:*`,
 * trailing `*`, ` *`, ` -…*`). PS-specific cmdlet strings live in
 * isDangerousPowerShellPermission (permissionSetup.ts).
 */
/**
 * Cross-platform code-execution entry points present on both Unix and Windows.
 * Shared to prevent the two lists drifting apart on interpreter additions.
 */
export declare const CROSS_PLATFORM_CODE_EXEC: readonly ["python", "python3", "python2", "node", "deno", "tsx", "ruby", "perl", "php", "lua", "npx", "bunx", "npm run", "yarn run", "pnpm run", "bun run", "bash", "sh", "ssh"];
export declare const DANGEROUS_BASH_PATTERNS: readonly string[];
//# sourceMappingURL=dangerousPatterns.d.ts.map