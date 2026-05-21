export type EnvVarValidationResult = {
    effective: number;
    status: 'valid' | 'capped' | 'invalid';
    message?: string;
};
export declare function validateBoundedIntEnvVar(name: string, value: string | undefined, defaultValue: number, upperLimit: number): EnvVarValidationResult;
//# sourceMappingURL=envValidation.d.ts.map