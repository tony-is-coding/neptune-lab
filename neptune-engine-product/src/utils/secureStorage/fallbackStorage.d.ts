import type { SecureStorage } from './types.js';
/**
 * Creates a fallback storage that tries to use the primary storage first,
 * and if that fails, falls back to the secondary storage
 */
export declare function createFallbackStorage(primary: SecureStorage, secondary: SecureStorage): SecureStorage;
//# sourceMappingURL=fallbackStorage.d.ts.map