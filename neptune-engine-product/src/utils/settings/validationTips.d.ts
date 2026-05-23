import type { ZodIssueCode } from 'zod/v4';
type ZodIssueCodeType = (typeof ZodIssueCode)[keyof typeof ZodIssueCode];
export type ValidationTip = {
    suggestion?: string;
    docLink?: string;
};
export type TipContext = {
    path: string;
    code: ZodIssueCodeType | string;
    expected?: string;
    received?: unknown;
    enumValues?: string[];
    message?: string;
    value?: unknown;
};
export declare function getValidationTip(context: TipContext): ValidationTip | null;
export {};
//# sourceMappingURL=validationTips.d.ts.map