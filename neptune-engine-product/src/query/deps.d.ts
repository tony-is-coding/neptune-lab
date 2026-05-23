import { queryModelWithStreaming } from '../services/api/claude.js';
import { autoCompactIfNeeded } from '../services/compact/autoCompact.js';
import { microcompactMessages } from '../services/compact/microCompact.js';
import { logEvent } from '../services/analytics/index.js';
export type QueryDeps = {
    callModel: typeof queryModelWithStreaming;
    microcompact: typeof microcompactMessages;
    autocompact: typeof autoCompactIfNeeded;
    uuid: () => string;
    logEvent: typeof logEvent;
};
export declare function productionDeps(): QueryDeps;
/**
 * 创建 SDK 模式的 deps，使用 No-Op Analytics
 *
 * 用于 SDK 模式下，消除 analytics 开销。
 */
export declare function sdkDeps(): QueryDeps;
//# sourceMappingURL=deps.d.ts.map