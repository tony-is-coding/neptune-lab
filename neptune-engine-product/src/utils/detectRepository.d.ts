export type ParsedRepository = {
    host: string;
    owner: string;
    name: string;
};
export declare function clearRepositoryCaches(): void;
export declare function detectCurrentRepository(): Promise<string | null>;
/**
 * Like detectCurrentRepository, but also returns the host (e.g. "github.com"
 * or a GHE hostname). Callers that need to construct URLs against a specific
 * GitHub host should use this variant.
 */
export declare function detectCurrentRepositoryWithHost(): Promise<ParsedRepository | null>;
/**
 * Synchronously returns the cached github.com repository for the current cwd
 * as "owner/name", or null if it hasn't been resolved yet or the host is not
 * github.com. Call detectCurrentRepository() first to populate the cache.
 *
 * Callers construct github.com URLs, so GHE hosts are filtered out here.
 */
export declare function getCachedRepository(): string | null;
/**
 * Parses a git remote URL into host, owner, and name components.
 * Accepts any host (github.com, GHE instances, etc.).
 *
 * Supports:
 *   https://host/owner/repo.git
 *   git@host:owner/repo.git
 *   ssh://git@host/owner/repo.git
 *   git://host/owner/repo.git
 *   https://host/owner/repo (no .git)
 *
 * Note: repo names can contain dots (e.g., cc.kurs.web)
 */
export declare function parseGitRemote(input: string): ParsedRepository | null;
/**
 * Parses a git remote URL or "owner/repo" string and returns "owner/repo".
 * Only returns results for github.com hosts — GHE URLs return null.
 * Use parseGitRemote() for GHE support.
 * Also accepts plain "owner/repo" strings for backward compatibility.
 */
export declare function parseGitHubRepository(input: string): string | null;
//# sourceMappingURL=detectRepository.d.ts.map