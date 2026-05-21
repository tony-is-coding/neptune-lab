export declare function isCoordinatorMode(): boolean;
/**
 * Checks if the current coordinator mode matches the session's stored mode.
 * If mismatched, flips the environment variable so isCoordinatorMode() returns
 * the correct value for the resumed session. Returns a warning message if
 * the mode was switched, or undefined if no switch was needed.
 */
export declare function matchSessionMode(sessionMode: 'coordinator' | 'normal' | undefined): string | undefined;
export declare function getCoordinatorUserContext(mcpClients: ReadonlyArray<{
    name: string;
}>, scratchpadDir?: string): {
    [k: string]: string;
};
export declare function getCoordinatorSystemPrompt(): string;
//# sourceMappingURL=coordinatorMode.d.ts.map