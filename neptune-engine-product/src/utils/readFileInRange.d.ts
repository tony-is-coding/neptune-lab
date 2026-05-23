export type ReadFileRangeResult = {
    content: string;
    lineCount: number;
    totalLines: number;
    totalBytes: number;
    readBytes: number;
    mtimeMs: number;
    /** true when output was clipped to maxBytes under truncate mode */
    truncatedByBytes?: boolean;
};
export declare class FileTooLargeError extends Error {
    sizeInBytes: number;
    maxSizeBytes: number;
    constructor(sizeInBytes: number, maxSizeBytes: number);
}
export declare function readFileInRange(filePath: string, offset?: number, maxLines?: number, maxBytes?: number, signal?: AbortSignal, options?: {
    truncateOnByteLimit?: boolean;
}): Promise<ReadFileRangeResult>;
//# sourceMappingURL=readFileInRange.d.ts.map