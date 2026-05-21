/**
 * Lightweight helpers shared between keychainPrefetch.ts and
 * macOsKeychainStorage.ts.
 *
 * This module MUST NOT import execa, execFileNoThrow, or
 * execFileNoThrowPortable. keychainPrefetch.ts fires at the very top of
 * main.tsx (before the ~65ms of module evaluation it parallelizes), and Bun's
 * __esm wrapper evaluates the ENTIRE module when any symbol is accessed —
 * so a heavy transitive import here defeats the prefetch. The execa →
 * human-signals → cross-spawn chain alone is ~58ms of synchronous init.
 *
 * The imports below (envUtils, oauth constants, crypto, os) are already
 * evaluated by startupProfiler.ts at main.tsx:5, so they add no module-init
 * cost when keychainPrefetch.ts pulls this file in.
 */
import type { SecureStorageData } from './types.js';
export declare const CREDENTIALS_SERVICE_SUFFIX = "-credentials";
export declare function getMacOsKeychainStorageServiceName(serviceSuffix?: string): string;
export declare function getUsername(): string;
export declare const KEYCHAIN_CACHE_TTL_MS = 30000;
export declare const keychainCacheState: {
    cache: {
        data: SecureStorageData | null;
        cachedAt: number;
    };
    generation: number;
    readInFlight: Promise<SecureStorageData | null> | null;
};
export declare function clearKeychainCache(): void;
/**
 * Prime the keychain cache from a prefetch result (keychainPrefetch.ts).
 * Only writes if the cache hasn't been touched yet — if sync read() or
 * update() already ran, their result is authoritative and we discard this.
 */
export declare function primeKeychainCacheFromPrefetch(stdout: string | null): void;
//# sourceMappingURL=macOsKeychainHelpers.d.ts.map