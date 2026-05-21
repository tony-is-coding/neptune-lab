/**
 * Git bundle creation + upload for CCR seed-bundle seeding.
 *
 * Flow:
 *   1. git stash create → update-ref refs/seed/stash (makes it reachable)
 *   2. git bundle create --all (packs refs/seed/stash + its objects)
 *   3. Upload to /v1/files
 *   4. Cleanup refs/seed/stash (don't pollute user's repo)
 *   5. Caller sets seed_bundle_file_id on SessionContext
 */
import { type FilesApiConfig } from '../../services/api/filesApi.js';
type BundleScope = 'all' | 'head' | 'squashed';
export type BundleUploadResult = {
    success: true;
    fileId: string;
    bundleSizeBytes: number;
    scope: BundleScope;
    hasWip: boolean;
} | {
    success: false;
    error: string;
    failReason?: BundleFailReason;
};
type BundleFailReason = 'git_error' | 'too_large' | 'empty_repo';
export declare function createAndUploadGitBundle(config: FilesApiConfig, opts?: {
    cwd?: string;
    signal?: AbortSignal;
}): Promise<BundleUploadResult>;
export {};
//# sourceMappingURL=gitBundle.d.ts.map