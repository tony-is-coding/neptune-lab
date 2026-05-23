export type CliHighlight = {
    highlight: typeof import('cli-highlight').highlight;
    supportsLanguage: typeof import('cli-highlight').supportsLanguage;
};
export declare function getCliHighlightPromise(): Promise<CliHighlight | null>;
/**
 * eg. "foo/bar.ts" → "TypeScript". Awaits the shared cli-highlight load,
 * then reads highlight.js's language registry. All callers are telemetry
 * (OTel counter attributes, permission-dialog unary events) — none block
 * on this, they fire-and-forget or the consumer already handles Promise<string>.
 */
export declare function getLanguageName(file_path: string): Promise<string>;
//# sourceMappingURL=cliHighlight.d.ts.map