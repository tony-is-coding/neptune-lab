type WriteFn = (content: string) => void;
export type BufferedWriter = {
    write: (content: string) => void;
    flush: () => void;
    dispose: () => void;
};
export declare function createBufferedWriter({ writeFn, flushIntervalMs, maxBufferSize, maxBufferBytes, immediateMode, }: {
    writeFn: WriteFn;
    flushIntervalMs?: number;
    maxBufferSize?: number;
    maxBufferBytes?: number;
    immediateMode?: boolean;
}): BufferedWriter;
export {};
//# sourceMappingURL=bufferedWriter.d.ts.map