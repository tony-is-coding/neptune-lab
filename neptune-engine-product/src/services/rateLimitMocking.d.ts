/**
 * Facade for rate limit header processing
 * This isolates mock logic from production code
 */
import { APIError } from '@anthropic-ai/sdk';
import { shouldProcessMockLimits } from './mockRateLimits.js';
/**
 * Process headers, applying mocks if /mock-limits command is active
 */
export declare function processRateLimitHeaders(headers: globalThis.Headers): globalThis.Headers;
/**
 * Check if we should process rate limits (either real subscriber or /mock-limits command)
 */
export declare function shouldProcessRateLimits(isSubscriber: boolean): boolean;
/**
 * Check if mock rate limits should throw a 429 error
 * Returns the error to throw, or null if no error should be thrown
 * @param currentModel The model being used for the current request
 * @param isFastModeActive Whether fast mode is currently active (for fast-mode-only mocks)
 */
export declare function checkMockRateLimitError(currentModel: string, isFastModeActive?: boolean): APIError | null;
/**
 * Check if this is a mock 429 error that shouldn't be retried
 */
export declare function isMockRateLimitError(error: APIError): boolean;
/**
 * Check if /mock-limits command is currently active (for UI purposes)
 */
export { shouldProcessMockLimits };
//# sourceMappingURL=rateLimitMocking.d.ts.map