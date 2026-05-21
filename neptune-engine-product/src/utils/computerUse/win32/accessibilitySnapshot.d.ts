/**
 * Accessibility Snapshot — captures the UI Automation tree of a window
 * and formats it as compact, model-friendly text.
 *
 * Sent alongside screenshots so the model has BOTH visual + structural
 * understanding of the GUI. This enables:
 * - Knowing exact element names, types, and positions
 * - Using click_element/type_into_element by name instead of pixel coords
 * - Understanding disabled/enabled state, current values
 *
 * Only includes interactive elements (buttons, edits, menus, links, etc.)
 * to keep token count low (~200-500 tokens for typical windows).
 */
export interface AccessibilityNode {
    role: string;
    name: string;
    automationId: string;
    bounds: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    enabled: boolean;
    value?: string;
    children?: AccessibilityNode[];
}
export interface AccessibilitySnapshot {
    /** Compact text representation for the model */
    text: string;
    /** Structured tree (for element-targeted actions) */
    nodes: AccessibilityNode[];
    /** Capture timestamp */
    timestamp: number;
}
/**
 * Capture the accessibility tree of a window, returning only interactive
 * and visible elements. Uses Windows UI Automation (crosses process boundaries).
 *
 * @param hwnd - Window handle as string
 * @param maxDepth - Maximum tree depth (default 4)
 * @param interactiveOnly - Only include interactive elements (default true)
 */
export declare function captureAccessibilitySnapshot(hwnd: string, maxDepth?: number, interactiveOnly?: boolean): AccessibilitySnapshot | null;
/**
 * Find an element in the accessibility tree by name, role, or automationId.
 * Returns the first match.
 */
export declare function findNodeInSnapshot(nodes: AccessibilityNode[], query: {
    name?: string;
    role?: string;
    automationId?: string;
}): AccessibilityNode | null;
//# sourceMappingURL=accessibilitySnapshot.d.ts.map