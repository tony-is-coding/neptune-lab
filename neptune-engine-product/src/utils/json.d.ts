type CachedParse = {
    ok: true;
    value: unknown;
} | {
    ok: false;
};
export declare const safeParseJSON: ((json: string | null | undefined, shouldLogError?: boolean) => unknown) & {
    cache: {
        clear: () => void;
        size: () => number;
        delete: (key: string) => boolean;
        get: (key: string) => CachedParse;
        has: (key: string) => boolean;
    };
};
/**
 * Safely parse JSON with comments (jsonc).
 * This is useful for VS Code configuration files like keybindings.json
 * which support comments and other jsonc features.
 */
export declare function safeParseJSONC(json: string | null | undefined): unknown;
/**
 * Parses JSONL data from a string or Buffer, skipping malformed lines.
 * Uses Bun.JSONL.parseChunk when available for better performance,
 * falls back to indexOf-based scanning otherwise.
 */
export declare function parseJSONL<T>(data: string | Buffer): T[];
/**
 * Reads and parses a JSONL file, reading at most the last 100 MB.
 * For files larger than 100 MB, reads the tail and skips the first partial line.
 *
 * 100 MB is more than sufficient since the longest context window we support
 * is ~2M tokens, which is well under 100 MB of JSONL.
 */
export declare function readJSONLFile<T>(filePath: string): Promise<T[]>;
export declare function addItemToJSONCArray(content: string, newItem: unknown): string;
export {};
//# sourceMappingURL=json.d.ts.map