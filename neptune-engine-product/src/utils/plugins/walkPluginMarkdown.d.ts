/**
 * Recursively walk a plugin directory, invoking onFile for each .md file.
 *
 * The namespace array tracks the subdirectory path relative to the root
 * (e.g., ['foo', 'bar'] for root/foo/bar/file.md). Callers that don't need
 * namespacing can ignore the second argument.
 *
 * When stopAtSkillDir is true and a directory contains SKILL.md, onFile is
 * called for all .md files in that directory but subdirectories are not
 * scanned — skill directories are leaf containers.
 *
 * Readdir errors are swallowed with a debug log so one bad directory doesn't
 * abort a plugin load.
 */
export declare function walkPluginMarkdown(rootDir: string, onFile: (fullPath: string, namespace: string[]) => Promise<void>, opts?: {
    stopAtSkillDir?: boolean;
    logLabel?: string;
}): Promise<void>;
//# sourceMappingURL=walkPluginMarkdown.d.ts.map