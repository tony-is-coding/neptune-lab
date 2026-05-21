import { LangfuseSpanProcessor } from '@langfuse/otel';
export declare function isLangfuseEnabled(): boolean;
export declare function getLangfuseProcessor(): LangfuseSpanProcessor | null;
export declare function initLangfuse(): boolean;
export declare function shutdownLangfuse(): Promise<void>;
//# sourceMappingURL=client.d.ts.map