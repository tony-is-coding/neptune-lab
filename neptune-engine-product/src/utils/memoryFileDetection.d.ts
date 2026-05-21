/**
 * Detects if a file path is a session-related file under ~/.claude.
 * Returns the type of session file or null if not a session file.
 */
export declare function detectSessionFileType(filePath: string): 'session_memory' | 'session_transcript' | null;
/**
 * Checks if a glob/pattern string indicates session file access intent.
 * Used for Grep/Glob tools where we check patterns, not actual file paths.
 */
export declare function detectSessionPatternType(pattern: string): 'session_memory' | 'session_transcript' | null;
/**
 * Check if a file path is within the memdir directory.
 */
export declare function isAutoMemFile(filePath: string): boolean;
export type MemoryScope = 'personal' | 'team';
/**
 * Determine which memory store (if any) a path belongs to.
 *
 * Team dir is a subdirectory of memdir (getTeamMemPath = join(getAutoMemPath, 'team')),
 * so a team path matches both isTeamMemFile and isAutoMemFile. Check team first.
 *
 * Use this for scope-keyed telemetry where a single event name distinguishes
 * by scope field — the existing tengu_memdir_* / tengu_team_mem_* event-name
 * hierarchy handles the overlap differently (team writes intentionally fire both).
 */
export declare function memoryScopeForPath(filePath: string): MemoryScope | null;
/**
 * Check if a file is a Claude-managed memory file (NOT user-managed instruction files).
 * Includes: auto-memory (memdir), agent memory, session memory/transcripts.
 * Excludes: CLAUDE.md, CLAUDE.local.md, .claude/rules/*.md (user-managed).
 *
 * Use this for collapse/badge logic where user-managed files should show full diffs.
 */
export declare function isAutoManagedMemoryFile(filePath: string): boolean;
export declare function isMemoryDirectory(dirPath: string): boolean;
/**
 * Check if a shell command string (Bash or PowerShell) targets memory files
 * by extracting absolute path tokens and checking them against memory
 * detection functions. Used for Bash/PowerShell grep/search commands in the
 * collapse logic.
 */
export declare function isShellCommandTargetingMemory(command: string): boolean;
export declare function isAutoManagedMemoryPattern(pattern: string): boolean;
//# sourceMappingURL=memoryFileDetection.d.ts.map