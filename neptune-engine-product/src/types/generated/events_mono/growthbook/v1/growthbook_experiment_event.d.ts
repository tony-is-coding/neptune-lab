import { PublicApiAuth } from '../../common/v1/auth.js';
/**
 * GrowthBook experiment assignment event
 * This event tracks when a user is exposed to an experiment variant
 * See: https://docs.growthbook.io/guide/bigquery
 */
export interface GrowthbookExperimentEvent {
    /** Unique event identifier (for deduplication) */
    event_id?: string | undefined;
    /** When user was exposed to experiment (maps to GrowthBook's timestamp column) */
    timestamp?: Date | undefined;
    /** Experiment tracking key (maps to GrowthBook's experiment_id column) */
    experiment_id?: string | undefined;
    /** Variation index: 0=control, 1+=variants (maps to GrowthBook's variation_id column) */
    variation_id?: number | undefined;
    /** Environment where assignment occurred */
    environment?: string | undefined;
    /** User attributes at time of assignment */
    user_attributes?: string | undefined;
    /** Experiment metadata */
    experiment_metadata?: string | undefined;
    /** Device identifier for the client */
    device_id?: string | undefined;
    /** Authentication context automatically injected by the API */
    auth?: PublicApiAuth | undefined;
    /** Session identifier for tracking user sessions */
    session_id?: string | undefined;
    /** Anonymous identifier for unauthenticated users */
    anonymous_id?: string | undefined;
    /** Event metadata variables (automatically populated by internal-tools-common event_logging library) */
    event_metadata_vars?: string | undefined;
}
export declare const GrowthbookExperimentEvent: MessageFns<GrowthbookExperimentEvent>;
type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
type DeepPartial<T> = T extends Builtin ? T : T extends globalThis.Array<infer U> ? globalThis.Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
type KeysOfUnion<T> = T extends T ? keyof T : never;
type Exact<P, I extends P> = P extends Builtin ? P : P & {
    [K in keyof P]: Exact<P[K], I[K]>;
} & {
    [K in Exclude<keyof I, KeysOfUnion<P>>]: never;
};
interface MessageFns<T> {
    fromJSON(object: any): T;
    toJSON(message: T): unknown;
    create<I extends Exact<DeepPartial<T>, I>>(base?: I): T;
    fromPartial<I extends Exact<DeepPartial<T>, I>>(object: I): T;
}
export {};
//# sourceMappingURL=growthbook_experiment_event.d.ts.map