/**
 * Utility for inserting a block into a content array relative to tool_result
 * blocks. Used by the API layer to position supplementary content (e.g.,
 * cache editing directives) correctly within user messages.
 *
 * Placement rules:
 * - If tool_result blocks exist: insert after the last one
 * - Otherwise: insert before the last block
 * - If the inserted block would be the final element, a text continuation
 *   block is appended (some APIs require the prompt not to end with
 *   non-text content)
 */
/**
 * Inserts a block into the content array after the last tool_result block.
 * Mutates the array in place.
 *
 * @param content - The content array to modify
 * @param block - The block to insert
 */
export declare function insertBlockAfterToolResults(content: unknown[], block: unknown): void;
//# sourceMappingURL=contentArray.d.ts.map