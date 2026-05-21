type CommandLifecycleState = 'started' | 'completed';
type CommandLifecycleListener = (uuid: string, state: CommandLifecycleState) => void;
export declare function setCommandLifecycleListener(cb: CommandLifecycleListener | null): void;
export declare function notifyCommandLifecycle(uuid: string, state: CommandLifecycleState): void;
export {};
//# sourceMappingURL=commandLifecycle.d.ts.map