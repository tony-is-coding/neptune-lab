import type { NonNullableUsage } from '../../entrypoints/sdk/sdkUtilityTypes.js';
/**
 * Zero-initialized usage object. Extracted from logging.ts so that
 * bridge/replBridge.ts can import it without transitively pulling in
 * api/errors.ts → utils/messages.ts → BashTool.tsx → the world.
 */
export declare const EMPTY_USAGE: Readonly<NonNullableUsage>;
//# sourceMappingURL=emptyUsage.d.ts.map