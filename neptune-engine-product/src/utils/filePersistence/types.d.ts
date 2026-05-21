export declare const FILE_COUNT_LIMIT = 10000;
export declare const OUTPUTS_SUBDIR = ".claude-code/outputs";
export declare const DEFAULT_UPLOAD_CONCURRENCY = 5;
export interface FailedPersistence {
    filename: string;
    error: string;
}
export interface PersistedFile {
    filename: string;
    file_id: string;
}
export interface FilesPersistedEventData {
    files: PersistedFile[];
    failed: FailedPersistence[];
}
export interface TurnStartTime {
    turnStartTime: number;
}
//# sourceMappingURL=types.d.ts.map