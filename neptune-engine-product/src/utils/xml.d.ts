/**
 * Escape XML/HTML special characters for safe interpolation into element
 * text content (between tags). Use when untrusted strings (process stdout,
 * user input, external data) go inside `<tag>${here}</tag>`.
 */
export declare function escapeXml(s: string): string;
/**
 * Escape for interpolation into a double- or single-quoted attribute value:
 * `<tag attr="${here}">`. Escapes quotes in addition to `& < >`.
 */
export declare function escapeXmlAttr(s: string): string;
//# sourceMappingURL=xml.d.ts.map