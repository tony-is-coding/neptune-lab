export declare function getSessionEnvDirPath(): Promise<string>;
export declare function getHookEnvFilePath(hookEvent: 'Setup' | 'SessionStart' | 'CwdChanged' | 'FileChanged', hookIndex: number): Promise<string>;
export declare function clearCwdEnvFiles(): Promise<void>;
export declare function invalidateSessionEnvCache(): void;
export declare function getSessionEnvironmentScript(): Promise<string | null>;
//# sourceMappingURL=sessionEnvironment.d.ts.map