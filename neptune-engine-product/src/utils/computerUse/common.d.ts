export declare const COMPUTER_USE_MCP_SERVER_NAME = "computer-use";
/**
 * Sentinel bundle ID for the frontmost gate. Claude Code is a terminal — it has
 * no window. This never matches a real `NSWorkspace.frontmostApplication`, so
 * the package's "host is frontmost" branch (mouse click-through exemption,
 * keyboard safety-net) is dead code for us. `prepareForAction`'s "exempt our
 * own window" is likewise a no-op — there is no window to exempt.
 */
export declare const CLI_HOST_BUNDLE_ID = "com.anthropic.claude-code.cli-no-window";
/**
 * Bundle ID of the terminal emulator we're running inside, so `prepareDisplay`
 * can exempt it from hiding and `captureExcluding` can keep it out of
 * screenshots. Returns null when undetectable (ssh, cleared env, unknown
 * terminal) — caller must handle the null case.
 *
 * `__CFBundleIdentifier` is set by LaunchServices when a .app bundle spawns a
 * process and is inherited by children. It's the exact bundleId, no lookup
 * needed — handles terminals the fallback table doesn't know about. Under
 * tmux/screen it reflects the terminal that started the SERVER, which may
 * differ from the attached client. That's harmless here: we exempt A
 * terminal window, and the screenshots exclude it regardless.
 */
export declare function getTerminalBundleId(): string | null;
/**
 * Static capabilities for macOS CLI. `hostBundleId` is not here — it's added
 * by `executor.ts` per `ComputerExecutor.capabilities`. `buildComputerUseTools`
 * takes this shape (no `hostBundleId`, no `teachMode`).
 */
export declare const CLI_CU_CAPABILITIES: {
    screenshotFiltering: any;
    platform: any;
};
export declare function isComputerUseMCPServer(name: string): boolean;
//# sourceMappingURL=common.d.ts.map