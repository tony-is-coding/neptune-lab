import type { Theme } from './theme.js';
export type TextHighlight = {
    start: number;
    end: number;
    color: keyof Theme | undefined;
    dimColor?: boolean;
    inverse?: boolean;
    shimmerColor?: keyof Theme;
    priority: number;
};
export type TextSegment = {
    text: string;
    start: number;
    highlight?: TextHighlight;
};
export declare function segmentTextByHighlights(text: string, highlights: TextHighlight[]): TextSegment[];
//# sourceMappingURL=textHighlighting.d.ts.map