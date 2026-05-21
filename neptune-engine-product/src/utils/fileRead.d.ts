/**
 * Sync file-read path, extracted from file.ts.
 *
 * file.ts sits in the settings SCC via log.ts → types/logs.ts → types/message.ts →
 * Tool.ts → commands.ts → … Anything that needs readFileSync from file.ts
 * pulls in the whole chain. This leaf imports only fsOperations and debug,
 * both of which terminate in Node builtins.
 *
 * detectFileEncoding/detectLineEndings stay in file.ts — they call logError
 * (log.ts → SCC) on unexpected failures. The -ForResolvedPath/-ForString
 * helpers here are the pure parts; callers who need the logging wrappers
 * import from file.ts.
 */
export type LineEndingType = 'CRLF' | 'LF';
export declare function detectEncodingForResolvedPath(resolvedPath: string): BufferEncoding;
export declare function detectLineEndingsForString(content: string): LineEndingType;
/**
 * Like readFileSync but also returns the detected encoding and original line
 * ending style in one filesystem pass. Callers writing the file back (e.g.
 * FileEditTool) can reuse these instead of calling detectFileEncoding /
 * detectLineEndings separately, which would each redo safeResolvePath +
 * readSync(4KB).
 */
export declare function readFileSyncWithMetadata(filePath: string): {
    content: string;
    encoding: BufferEncoding;
    lineEndings: LineEndingType;
};
export declare function readFileSync(filePath: string): string;
//# sourceMappingURL=fileRead.d.ts.map