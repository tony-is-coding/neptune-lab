import type { SessionId } from '../types/ids.js';
export type QueryConfig = {
    sessionId: SessionId;
    gates: {
        streamingToolExecution: boolean;
        emitToolUseSummaries: boolean;
        isAnt: boolean;
        fastModeEnabled: boolean;
    };
};
export declare function buildQueryConfig(): QueryConfig;
//# sourceMappingURL=config.d.ts.map