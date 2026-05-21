export type FpsMetrics = {
    averageFps: number;
    low1PctFps: number;
};
export declare class FpsTracker {
    private frameDurations;
    private firstRenderTime;
    private lastRenderTime;
    record(durationMs: number): void;
    getMetrics(): FpsMetrics | undefined;
}
//# sourceMappingURL=fpsTracker.d.ts.map