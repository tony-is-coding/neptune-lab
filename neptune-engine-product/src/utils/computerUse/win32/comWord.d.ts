/**
 * Word COM automation module for Windows.
 * Uses PowerShell to drive Word.Application COM object — fully headless (Visible=false).
 * Each function builds a PowerShell script, runs it via Bun.spawnSync, and parses JSON output.
 */
export interface WordParagraph {
    text: string;
    bold?: boolean;
    italic?: boolean;
    fontSize?: number;
}
export interface WordTable {
    rows: number;
    cols: number;
    data: string[][];
}
export interface WordDocInfo {
    text: string;
    paragraphs: WordParagraph[];
    tables: WordTable[];
    wordCount: number;
    pageCount: number;
}
export interface AppendTextOptions {
    bold?: boolean;
    italic?: boolean;
    fontSize?: number;
    fontName?: string;
}
export declare function openWord(filePath: string): Promise<WordDocInfo>;
export declare function readText(filePath: string): Promise<string>;
export declare function appendText(filePath: string, text: string, opts?: AppendTextOptions): Promise<boolean>;
export declare function insertText(filePath: string, paraIndex: number, text: string): Promise<boolean>;
export declare function findReplace(filePath: string, find: string, replace: string, replaceAll?: boolean): Promise<number>;
export declare function insertTable(filePath: string, rows: number, cols: number, data: string[][]): Promise<boolean>;
export declare function saveWord(filePath: string, savePath?: string): Promise<boolean>;
export declare function saveAsPdf(filePath: string, pdfPath: string): Promise<boolean>;
export declare function createWord(savePath: string): Promise<boolean>;
/**
 * closeWord is a no-op since each operation opens and closes its own COM instance.
 */
export declare function closeWord(_filePath: string): void;
//# sourceMappingURL=comWord.d.ts.map