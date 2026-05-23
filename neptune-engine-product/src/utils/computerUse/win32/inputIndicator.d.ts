/**
 * Input Indicator — floating label showing what Computer Use is doing
 * on the bound window.
 *
 * Displays a small overlay near the bottom of the bound window:
 *   ⌨ Typing "hello world..."
 *   🖱 Click (120, 50)
 *   ⌨ Ctrl+S
 *   📜 Scroll ↓ 3
 *   ✅ Done
 *
 * Auto-fades after 2 seconds of inactivity.
 * Click-through, TOPMOST, no taskbar icon.
 */
/** Start the input indicator for a bound window */
export declare function showIndicator(hwnd: string): boolean;
/** Update the indicator message */
export declare function updateIndicator(message: string): void;
/** Hide and destroy the indicator */
export declare function hideIndicator(): void;
export declare function indicateTyping(text: string): void;
export declare function indicateKey(combo: string): void;
export declare function indicateClick(x: number, y: number, button?: string): void;
export declare function indicateScroll(direction: string, amount: number): void;
export declare function indicateDone(): void;
//# sourceMappingURL=inputIndicator.d.ts.map