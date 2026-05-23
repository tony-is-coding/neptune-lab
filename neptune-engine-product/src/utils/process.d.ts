export declare function registerProcessOutputErrorHandlers(): void;
export declare function writeToStdout(data: string): void;
export declare function writeToStderr(data: string): void;
export declare function exitWithError(message: string): never;
export declare function peekForStdinData(stream: NodeJS.EventEmitter, ms: number): Promise<boolean>;
//# sourceMappingURL=process.d.ts.map