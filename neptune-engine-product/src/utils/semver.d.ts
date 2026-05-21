/**
 * Semver comparison utilities that use Bun.semver when available
 * and fall back to the npm `semver` package in Node.js environments.
 *
 * Bun.semver.order() is ~20x faster than npm semver comparisons.
 * The npm semver fallback always uses { loose: true }.
 */
export declare function gt(a: string, b: string): boolean;
export declare function gte(a: string, b: string): boolean;
export declare function lt(a: string, b: string): boolean;
export declare function lte(a: string, b: string): boolean;
export declare function satisfies(version: string, range: string): boolean;
export declare function order(a: string, b: string): -1 | 0 | 1;
//# sourceMappingURL=semver.d.ts.map