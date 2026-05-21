/**
 * Check if a file should be excluded from attribution based on Linguist-style rules.
 *
 * @param filePath - Relative file path from repository root
 * @returns true if the file should be excluded from attribution
 */
export declare function isGeneratedFile(filePath: string): boolean;
/**
 * Filter a list of files to exclude generated files.
 *
 * @param files - Array of file paths
 * @returns Array of files that are not generated
 */
export declare function filterGeneratedFiles(files: string[]): string[];
//# sourceMappingURL=generatedFiles.d.ts.map