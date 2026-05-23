import type { McpbManifestAny } from '@anthropic-ai/mcpb';
/**
 * Parses and validates a DXT manifest from a JSON object.
 *
 * Lazy-imports @anthropic-ai/mcpb: that package uses zod v3 which eagerly
 * creates 24 .bind(this) closures per schema instance (~300 instances between
 * schemas.js and schemas-loose.js). Deferring the import keeps ~700KB of bound
 * closures out of the startup heap for sessions that never touch .dxt/.mcpb.
 */
export declare function validateManifest(manifestJson: unknown): Promise<McpbManifestAny>;
/**
 * Parses and validates a DXT manifest from raw text data.
 */
export declare function parseAndValidateManifestFromText(manifestText: string): Promise<McpbManifestAny>;
/**
 * Parses and validates a DXT manifest from raw binary data.
 */
export declare function parseAndValidateManifestFromBytes(manifestData: Uint8Array): Promise<McpbManifestAny>;
/**
 * Generates an extension ID from author name and extension name.
 * Uses the same algorithm as the directory backend for consistency.
 */
export declare function generateExtensionId(manifest: McpbManifestAny, prefix?: 'local.unpacked' | 'local.dxt'): string;
//# sourceMappingURL=helpers.d.ts.map