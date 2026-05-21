/**
 * Cross-platform (Windows/Linux) ComputerExecutor implementation.
 *
 * Unlike the macOS executor which uses @ant native modules + drainRunLoop +
 * CGEventTap, this executor delegates everything to src/utils/computerUse/platforms/.
 *
 * All operations go through the platform abstraction:
 * - Input: SendMessage (HWND-bound, no focus steal)
 * - Screenshot: PrintWindow (per-window JPEG)
 * - Display: platform-native enumeration
 * - Apps: platform-native listing/launching
 *
 * No drainRunLoop, no CGEventTap, no pbcopy/pbpaste, no @ant packages.
 *
 * ── Coordinate model (bound-window mode) ─────────────────────────────────
 *
 * When an HWND is bound, screenshots come from PrintWindow (the bound window),
 * NOT from the display. This means:
 *   - Image pixel coords ARE window coords (1:1 after scaleCoord)
 *   - displayWidth/displayHeight are set to the IMAGE dimensions so scaleCoord
 *     returns raw image coords unchanged
 *   - originX/originY are 0 (not the display origin)
 *   - For clicks, we subtract the non-client area offset (title bar + border)
 *     so WM_LBUTTONDOWN receives client-relative coords
 */
import type { ComputerExecutor } from '@ant/computer-use-mcp';
export declare function createCrossPlatformExecutor(opts: {
    getMouseAnimationEnabled: () => boolean;
    getHideBeforeActionEnabled: () => boolean;
}): ComputerExecutor;
/**
 * Module-level unhide — no-op on non-macOS (we don't hide apps).
 */
export declare function unhideComputerUseAppsCrossPlatform(_bundleIds: readonly string[]): Promise<void>;
//# sourceMappingURL=executorCrossPlatform.d.ts.map