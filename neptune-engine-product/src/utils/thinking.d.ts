import type { Theme } from './theme.js';
export type ThinkingConfig = {
    type: 'adaptive';
} | {
    type: 'enabled';
    budgetTokens: number;
} | {
    type: 'disabled';
};
/**
 * Build-time gate (feature) + runtime gate (GrowthBook). The build flag
 * controls code inclusion in external builds; the GB flag controls rollout.
 */
export declare function isUltrathinkEnabled(): boolean;
/**
 * Check if text contains the "ultrathink" keyword.
 */
export declare function hasUltrathinkKeyword(text: string): boolean;
/**
 * Find positions of "ultrathink" keyword in text (for UI highlighting/notification)
 */
export declare function findThinkingTriggerPositions(text: string): Array<{
    word: string;
    start: number;
    end: number;
}>;
export declare function getRainbowColor(charIndex: number, shimmer?: boolean): keyof Theme;
export declare function modelSupportsThinking(model: string): boolean;
export declare function modelSupportsAdaptiveThinking(model: string): boolean;
export declare function shouldEnableThinkingByDefault(): boolean;
//# sourceMappingURL=thinking.d.ts.map