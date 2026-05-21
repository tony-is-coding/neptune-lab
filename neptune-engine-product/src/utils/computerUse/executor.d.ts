/**
 * CLI `ComputerExecutor` implementation. Wraps two native modules:
 *   - `@ant/computer-use-input` (Rust/enigo) — mouse, keyboard, frontmost app
 *   - `@ant/computer-use-swift` — SCContentFilter screenshots, NSWorkspace apps, TCC
 *
 * Contract: `packages/desktop/computer-use-mcp/src/executor.ts` in the apps
 * repo. The reference impl is Cowork's `apps/desktop/src/main/nest-only/
 * computer-use/executor.ts` — see notable deviations under "CLI deltas" below.
 *
 * ── CLI deltas from Cowork ─────────────────────────────────────────────────
 *
 * No `withClickThrough`. Cowork wraps every mouse op in
 *   `BrowserWindow.setIgnoreMouseEvents(true)` so clicks fall through the
 *   overlay. We're a terminal — no window — so the click-through bracket is
 *   a no-op. The sentinel `CLI_HOST_BUNDLE_ID` never matches frontmost.
 *
 * Terminal as surrogate host. `getTerminalBundleId()` detects the emulator
 *   we're running inside. It's passed as `hostBundleId` to `prepareDisplay`/
 *   `resolvePrepareCapture` so the Swift side exempts it from hide AND skips
 *   it in the activate z-order walk (so the terminal being frontmost doesn't
 *   eat clicks meant for the target app). Also stripped from `allowedBundleIds`
 *   via `withoutTerminal()` so screenshots don't capture it (Swift 0.2.1's
 *   captureExcluding takes an allow-list despite the name — apps#30355).
 *   `capabilities.hostBundleId` stays as the sentinel — the package's
 *   frontmost gate uses that, and the terminal being frontmost is fine.
 *
 * Clipboard via `pbcopy`/`pbpaste`. No Electron `clipboard` module.
 */
import type { ComputerExecutor } from '@ant/computer-use-mcp';
export declare function createCliExecutor(opts: {
    getMouseAnimationEnabled: () => boolean;
    getHideBeforeActionEnabled: () => boolean;
}): ComputerExecutor;
/**
 * Module-level export (not on the executor object) — called at turn-end from
 * `stopHooks.ts` / `query.ts`, outside the executor lifecycle. Fire-and-forget
 * at the call site; the caller `.catch()`es.
 */
export declare function unhideComputerUseApps(bundleIds: readonly string[]): Promise<void>;
//# sourceMappingURL=executor.d.ts.map