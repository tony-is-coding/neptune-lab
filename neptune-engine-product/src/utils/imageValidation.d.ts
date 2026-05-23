/**
 * Information about an oversized image.
 */
export type OversizedImage = {
    index: number;
    size: number;
};
/**
 * Error thrown when one or more images exceed the API size limit.
 */
export declare class ImageSizeError extends Error {
    constructor(oversizedImages: OversizedImage[], maxSize: number);
}
/**
 * Validates that all images in messages are within the API size limit.
 * This is a safety net at the API boundary to catch any oversized images
 * that may have slipped through upstream processing.
 *
 * Note: The API's 5MB limit applies to the base64-encoded string length,
 * not the decoded raw bytes.
 *
 * Works with both UserMessage/AssistantMessage types (which have { type, message })
 * and raw MessageParam types (which have { role, content }).
 *
 * @param messages - Array of messages to validate
 * @throws ImageSizeError if any image exceeds the API limit
 */
export declare function validateImagesForAPI(messages: unknown[]): void;
//# sourceMappingURL=imageValidation.d.ts.map