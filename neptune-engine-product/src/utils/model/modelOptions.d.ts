import { type ModelSetting } from './model.js';
export type ModelOption = {
    value: ModelSetting;
    label: string;
    description: string;
    descriptionForModel?: string;
};
export declare function getDefaultOptionForUser(fastMode?: boolean): ModelOption;
export declare function getSonnet46_1MOption(): ModelOption;
export declare function getOpus46_1MOption(fastMode?: boolean): ModelOption;
export declare function getMaxSonnet46_1MOption(): ModelOption;
export declare function getMaxOpus46_1MOption(fastMode?: boolean): ModelOption;
export declare function getModelOptions(fastMode?: boolean): ModelOption[];
//# sourceMappingURL=modelOptions.d.ts.map