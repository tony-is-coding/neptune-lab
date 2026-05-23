export type Theme = {
    autoAccept: string;
    bashBorder: string;
    claude: string;
    claudeShimmer: string;
    claudeBlue_FOR_SYSTEM_SPINNER: string;
    claudeBlueShimmer_FOR_SYSTEM_SPINNER: string;
    permission: string;
    permissionShimmer: string;
    planMode: string;
    ide: string;
    promptBorder: string;
    promptBorderShimmer: string;
    text: string;
    inverseText: string;
    inactive: string;
    inactiveShimmer: string;
    subtle: string;
    suggestion: string;
    remember: string;
    background: string;
    success: string;
    error: string;
    warning: string;
    merged: string;
    warningShimmer: string;
    diffAdded: string;
    diffRemoved: string;
    diffAddedDimmed: string;
    diffRemovedDimmed: string;
    diffAddedWord: string;
    diffRemovedWord: string;
    red_FOR_SUBAGENTS_ONLY: string;
    blue_FOR_SUBAGENTS_ONLY: string;
    green_FOR_SUBAGENTS_ONLY: string;
    yellow_FOR_SUBAGENTS_ONLY: string;
    purple_FOR_SUBAGENTS_ONLY: string;
    orange_FOR_SUBAGENTS_ONLY: string;
    pink_FOR_SUBAGENTS_ONLY: string;
    cyan_FOR_SUBAGENTS_ONLY: string;
    professionalBlue: string;
    chromeYellow: string;
    clawd_body: string;
    clawd_background: string;
    userMessageBackground: string;
    userMessageBackgroundHover: string;
    /** Message-actions selection. Cool shift toward `suggestion` blue; distinct from default AND userMessageBackground. */
    messageActionsBackground: string;
    /** Text-selection highlight background (alt-screen mouse selection). Solid
     *  bg that REPLACES the cell's bg while preserving its fg — matches native
     *  terminal selection. Previously SGR-7 inverse (swapped fg/bg per cell),
     *  which fragmented badly over syntax highlighting. */
    selectionBg: string;
    bashMessageBackgroundColor: string;
    memoryBackgroundColor: string;
    rate_limit_fill: string;
    rate_limit_empty: string;
    fastMode: string;
    fastModeShimmer: string;
    briefLabelYou: string;
    briefLabelClaude: string;
    rainbow_red: string;
    rainbow_orange: string;
    rainbow_yellow: string;
    rainbow_green: string;
    rainbow_blue: string;
    rainbow_indigo: string;
    rainbow_violet: string;
    rainbow_red_shimmer: string;
    rainbow_orange_shimmer: string;
    rainbow_yellow_shimmer: string;
    rainbow_green_shimmer: string;
    rainbow_blue_shimmer: string;
    rainbow_indigo_shimmer: string;
    rainbow_violet_shimmer: string;
};
export declare const THEME_NAMES: readonly ["dark", "light", "light-daltonized", "dark-daltonized", "light-ansi", "dark-ansi"];
/** A renderable theme. Always resolvable to a concrete color palette. */
export type ThemeName = (typeof THEME_NAMES)[number];
export declare const THEME_SETTINGS: readonly ["auto", "dark", "light", "light-daltonized", "dark-daltonized", "light-ansi", "dark-ansi"];
/**
 * A theme preference as stored in user config. `'auto'` follows the system
 * dark/light mode and is resolved to a ThemeName at runtime.
 */
export type ThemeSetting = (typeof THEME_SETTINGS)[number];
export declare function getTheme(themeName: ThemeName): Theme;
/**
 * Converts a theme color to an ANSI escape sequence for use with asciichart.
 * Uses chalk to generate the escape codes, with 256-color mode for Apple Terminal.
 */
export declare function themeColorToAnsi(themeColor: string): string;
//# sourceMappingURL=theme.d.ts.map