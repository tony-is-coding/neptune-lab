type TriggerPosition = {
    word: string;
    start: number;
    end: number;
};
export declare function findUltraplanTriggerPositions(text: string): TriggerPosition[];
export declare function findUltrareviewTriggerPositions(text: string): TriggerPosition[];
export declare function hasUltraplanKeyword(text: string): boolean;
export declare function hasUltrareviewKeyword(text: string): boolean;
/**
 * Replace the first triggerable "ultraplan" with "plan" so the forwarded
 * prompt stays grammatical ("please ultraplan this" → "please plan this").
 * Preserves the user's casing of the "plan" suffix.
 */
export declare function replaceUltraplanKeyword(text: string): string;
export {};
//# sourceMappingURL=keyword.d.ts.map