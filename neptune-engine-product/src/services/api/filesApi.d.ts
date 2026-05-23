/**
 * Files API client for managing files
 *
 * This module provides functionality to download and upload files to Anthropic Public Files API.
 * Used by the Claude Code agent to download file attachments at session startup.
 *
 * API Reference: https://docs.anthropic.com/en/api/files-content
 */
/**
 * File specification parsed from CLI args
 * Format: --file=<file_id>:<relative_path>
 */
export type File = {
    fileId: string;
    relativePath: string;
};
/**
 * Configuration for the files API client
 */
export type FilesApiConfig = {
    /** OAuth token for authentication (from session JWT) */
    oauthToken: string;
    /** Base URL for the API (default: https://api.anthropic.com) */
    baseUrl?: string;
    /** Session ID for creating session-specific directories */
    sessionId: string;
};
/**
 * Result of a file download operation
 */
export type DownloadResult = {
    fileId: string;
    path: string;
    success: boolean;
    error?: string;
    bytesWritten?: number;
};
/**
 * Downloads a single file from the Anthropic Public Files API
 *
 * @param fileId - The file ID (e.g., "file_011CNha8iCJcU1wXNR6q4V8w")
 * @param config - Files API configuration
 * @returns The file content as a Buffer
 */
export declare function downloadFile(fileId: string, config: FilesApiConfig): Promise<Buffer>;
/**
 * Normalizes a relative path, strips redundant prefixes, and builds the full
 * download path under {basePath}/{session_id}/uploads/.
 * Returns null if the path is invalid (e.g., path traversal).
 */
export declare function buildDownloadPath(basePath: string, sessionId: string, relativePath: string): string | null;
/**
 * Downloads a file and saves it to the session-specific workspace directory
 *
 * @param attachment - The file attachment to download
 * @param config - Files API configuration
 * @returns Download result with success/failure status
 */
export declare function downloadAndSaveFile(attachment: File, config: FilesApiConfig): Promise<DownloadResult>;
/**
 * Downloads all file attachments for a session in parallel
 *
 * @param attachments - List of file attachments to download
 * @param config - Files API configuration
 * @param concurrency - Maximum concurrent downloads (default: 5)
 * @returns Array of download results in the same order as input
 */
export declare function downloadSessionFiles(files: File[], config: FilesApiConfig, concurrency?: number): Promise<DownloadResult[]>;
/**
 * Result of a file upload operation
 */
export type UploadResult = {
    path: string;
    fileId: string;
    size: number;
    success: true;
} | {
    path: string;
    error: string;
    success: false;
};
/**
 * Upload a single file to the Files API (BYOC mode)
 *
 * Size validation is performed after reading the file to avoid TOCTOU race
 * conditions where the file size could change between initial check and upload.
 *
 * @param filePath - Absolute path to the file to upload
 * @param relativePath - Relative path for the file (used as filename in API)
 * @param config - Files API configuration
 * @returns Upload result with success/failure status
 */
export declare function uploadFile(filePath: string, relativePath: string, config: FilesApiConfig, opts?: {
    signal?: AbortSignal;
}): Promise<UploadResult>;
/**
 * Upload multiple files in parallel with concurrency limit (BYOC mode)
 *
 * @param files - Array of files to upload (path and relativePath)
 * @param config - Files API configuration
 * @param concurrency - Maximum concurrent uploads (default: 5)
 * @returns Array of upload results in the same order as input
 */
export declare function uploadSessionFiles(files: Array<{
    path: string;
    relativePath: string;
}>, config: FilesApiConfig, concurrency?: number): Promise<UploadResult[]>;
/**
 * File metadata returned from listFilesCreatedAfter
 */
export type FileMetadata = {
    filename: string;
    fileId: string;
    size: number;
};
/**
 * List files created after a given timestamp (1P/Cloud mode).
 * Uses the public GET /v1/files endpoint with after_created_at query param.
 * Handles pagination via after_id cursor when has_more is true.
 *
 * @param afterCreatedAt - ISO 8601 timestamp to filter files created after
 * @param config - Files API configuration
 * @returns Array of file metadata for files created after the timestamp
 */
export declare function listFilesCreatedAfter(afterCreatedAt: string, config: FilesApiConfig): Promise<FileMetadata[]>;
/**
 * Parse file attachment specs from CLI arguments
 * Format: <file_id>:<relative_path>
 *
 * @param fileSpecs - Array of file spec strings
 * @returns Parsed file attachments
 */
export declare function parseFileSpecs(fileSpecs: string[]): File[];
//# sourceMappingURL=filesApi.d.ts.map