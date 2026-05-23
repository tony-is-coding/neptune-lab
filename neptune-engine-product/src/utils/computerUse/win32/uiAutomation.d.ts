/**
 * Windows UI Automation module
 *
 * Provides UI element tree inspection, element lookup, programmatic click,
 * value setting, and hit-testing via PowerShell + System.Windows.Automation.
 */
export interface UIElement {
    name: string;
    controlType: string;
    automationId: string;
    boundingRect: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    isEnabled: boolean;
    value?: string;
    children?: UIElement[];
}
/**
 * Get the UI element tree of a window, up to `depth` levels deep (default 3).
 */
export declare function getUITree(windowTitle: string, depth?: number): UIElement[];
/**
 * Find a single element inside a window matching the given query fields.
 */
export declare function findElement(windowTitle: string, query: {
    name?: string;
    controlType?: string;
    automationId?: string;
}): UIElement | null;
/**
 * Click an element by its automationId using InvokePattern.
 */
export declare function clickElement(windowTitle: string, automationId: string): boolean;
/**
 * Set the value of an element by its automationId using ValuePattern.
 */
export declare function setValue(windowTitle: string, automationId: string, value: string): boolean;
/**
 * Get the UI element at a specific screen coordinate.
 */
export declare function elementAtPoint(x: number, y: number): UIElement | null;
//# sourceMappingURL=uiAutomation.d.ts.map