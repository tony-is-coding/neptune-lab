export declare function setEnvHookNotifier(cb: ((text: string, isError: boolean) => void) | null): void;
export declare function initializeFileChangedWatcher(cwd: string): void;
export declare function updateWatchPaths(paths: string[]): void;
export declare function onCwdChangedForHooks(oldCwd: string, newCwd: string): Promise<void>;
export declare function resetFileChangedWatcherForTesting(): void;
//# sourceMappingURL=fileChangedWatcher.d.ts.map