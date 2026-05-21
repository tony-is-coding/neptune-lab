import type { PastedContent } from './config.js';
/**
 * Cache the image path immediately (fast, no file I/O).
 */
export declare function cacheImagePath(content: PastedContent): string | null;
/**
 * Store an image from pastedContents to disk.
 */
export declare function storeImage(content: PastedContent): Promise<string | null>;
/**
 * Store all images from pastedContents to disk.
 */
export declare function storeImages(pastedContents: Record<number, PastedContent>): Promise<Map<number, string>>;
/**
 * Get the file path for a stored image by ID.
 */
export declare function getStoredImagePath(imageId: number): string | null;
/**
 * Clear the in-memory cache of stored image paths.
 */
export declare function clearStoredImagePaths(): void;
/**
 * Clean up old image cache directories from previous sessions.
 */
export declare function cleanupOldImageCaches(): Promise<void>;
//# sourceMappingURL=imageStore.d.ts.map