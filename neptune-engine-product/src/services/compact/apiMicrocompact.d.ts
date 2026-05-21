export type ContextEditStrategy = {
    type: 'clear_tool_uses_20250919';
    trigger?: {
        type: 'input_tokens';
        value: number;
    };
    keep?: {
        type: 'tool_uses';
        value: number;
    };
    clear_tool_inputs?: boolean | string[];
    exclude_tools?: string[];
    clear_at_least?: {
        type: 'input_tokens';
        value: number;
    };
} | {
    type: 'clear_thinking_20251015';
    keep: {
        type: 'thinking_turns';
        value: number;
    } | 'all';
};
export type ContextManagementConfig = {
    edits: ContextEditStrategy[];
};
export declare function getAPIContextManagement(options?: {
    hasThinking?: boolean;
    isRedactThinkingActive?: boolean;
    clearAllThinking?: boolean;
}): ContextManagementConfig | undefined;
//# sourceMappingURL=apiMicrocompact.d.ts.map