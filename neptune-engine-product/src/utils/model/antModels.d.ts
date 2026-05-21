import type { EffortLevel } from '../effort.js';
export type AntModel = {
    alias: string;
    model: string;
    label: string;
    description?: string;
    defaultEffortValue?: number;
    defaultEffortLevel?: EffortLevel;
    contextWindow?: number;
    defaultMaxTokens?: number;
    upperMaxTokensLimit?: number;
    /** Model defaults to adaptive thinking and rejects `thinking: { type: 'disabled' }`. */
    alwaysOnThinking?: boolean;
};
export type AntModelSwitchCalloutConfig = {
    modelAlias?: string;
    description: string;
    version: string;
};
export type AntModelOverrideConfig = {
    defaultModel?: string;
    defaultModelEffortLevel?: EffortLevel;
    defaultSystemPromptSuffix?: string;
    antModels?: AntModel[];
    switchCallout?: AntModelSwitchCalloutConfig;
};
export declare function getAntModelOverrideConfig(): AntModelOverrideConfig | null;
export declare function getAntModels(): AntModel[];
export declare function resolveAntModel(model: string | undefined): AntModel | undefined;
//# sourceMappingURL=antModels.d.ts.map