import type { Base64ImageSource, ImageBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs';
type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
/**
 * Error thrown when image resizing fails and the image exceeds the API limit.
 */
export declare class ImageResizeError extends Error {
    constructor(message: string);
}
export type ImageDimensions = {
    originalWidth?: number;
    originalHeight?: number;
    displayWidth?: number;
    displayHeight?: number;
};
export interface ResizeResult {
    buffer: Buffer;
    mediaType: string;
    dimensions?: ImageDimensions;
}
interface CompressedImageResult {
    base64: string;
    mediaType: Base64ImageSource['media_type'];
    originalSize: number;
}
/**
 * Extracted from FileReadTool's readImage function
 * Resizes image buffer to meet size and dimension constraints
 */
export declare function maybeResizeAndDownsampleImageBuffer(imageBuffer: Buffer, originalSize: number, ext: string): Promise<ResizeResult>;
export interface ImageBlockWithDimensions {
    block: ImageBlockParam;
    dimensions?: ImageDimensions;
}
/**
 * Resizes an image content block if needed
 * Takes an image ImageBlockParam and returns a resized version if necessary
 * Also returns dimension information for coordinate mapping
 */
export declare function maybeResizeAndDownsampleImageBlock(imageBlock: ImageBlockParam): Promise<ImageBlockWithDimensions>;
/**
 * Compresses an image buffer to fit within a maximum byte size.
 *
 * Uses a multi-strategy fallback approach because simple compression often fails for
 * large screenshots, high-resolution photos, or images with complex gradients. Each
 * strategy is progressively more aggressive to handle edge cases where earlier
 * strategies produce files still exceeding the size limit.
 *
 * Strategy (from FileReadTool):
 * 1. Try to preserve original format (PNG, JPEG, WebP) with progressive resizing
 * 2. For PNG: Use palette optimization and color reduction if needed
 * 3. Last resort: Convert to JPEG with aggressive compression
 *
 * This ensures images fit within context windows while maintaining format when possible.
 */
export declare function compressImageBuffer(imageBuffer: Buffer, maxBytes?: number, originalMediaType?: string): Promise<CompressedImageResult>;
/**
 * Compresses an image buffer to fit within a token limit.
 * Converts tokens to bytes using the formula: maxBytes = (maxTokens / 0.125) * 0.75
 */
export declare function compressImageBufferWithTokenLimit(imageBuffer: Buffer, maxTokens: number, originalMediaType?: string): Promise<CompressedImageResult>;
/**
 * Compresses an image block to fit within a maximum byte size.
 * Wrapper around compressImageBuffer for ImageBlockParam.
 */
export declare function compressImageBlock(imageBlock: ImageBlockParam, maxBytes?: number): Promise<ImageBlockParam>;
/**
 * Detect image format from a buffer using magic bytes
 * @param buffer Buffer containing image data
 * @returns Media type string (e.g., 'image/png', 'image/jpeg') or 'image/png' as default
 */
export declare function detectImageFormatFromBuffer(buffer: Buffer): ImageMediaType;
/**
 * Detect image format from base64 data using magic bytes
 * @param base64Data Base64 encoded image data
 * @returns Media type string (e.g., 'image/png', 'image/jpeg') or 'image/png' as default
 */
export declare function detectImageFormatFromBase64(base64Data: string): ImageMediaType;
/**
 * Creates a text description of image metadata including dimensions and source path.
 * Returns null if no useful metadata is available.
 */
export declare function createImageMetadataText(dims: ImageDimensions, sourcePath?: string): string | null;
export {};
//# sourceMappingURL=imageResizer.d.ts.map