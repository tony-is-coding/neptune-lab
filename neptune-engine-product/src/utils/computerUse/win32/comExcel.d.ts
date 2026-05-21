/**
 * Excel COM automation via PowerShell.
 * Completely headless — Visible=false, no window, no user impact.
 * Each operation opens and closes Excel to avoid orphaned processes.
 */
export interface CellInfo {
    row: number;
    col: number;
    value: string | number | null;
    formula?: string;
}
export interface SheetInfo {
    name: string;
    usedRange: {
        rows: number;
        cols: number;
    };
    cells: CellInfo[];
}
export interface ExcelInfo {
    sheets: SheetInfo[];
    sheetNames: string[];
}
/**
 * Open and read an Excel workbook.
 * Limits to first 1000 non-empty cells per sheet.
 */
export declare function openExcel(filePath: string): ExcelInfo;
/**
 * Read a single cell value.
 */
export declare function readCell(filePath: string, sheet: string | number, row: number, col: number): string | number | null;
/**
 * Read a rectangular range of cells as a 2D array.
 */
export declare function readRange(filePath: string, sheet: string | number, startRow: number, startCol: number, endRow: number, endCol: number): (string | number | null)[][];
/**
 * Write a single cell value.
 */
export declare function writeCell(filePath: string, sheet: string | number, row: number, col: number, value: string | number): boolean;
/**
 * Write a 2D array of values starting at (startRow, startCol).
 */
export declare function writeRange(filePath: string, sheet: string | number, startRow: number, startCol: number, data: (string | number | null)[][]): boolean;
/**
 * Set a formula on a cell.
 */
export declare function setFormula(filePath: string, sheet: string | number, row: number, col: number, formula: string): boolean;
/**
 * Save workbook. If savePath is given, SaveAs to that path; otherwise Save in place.
 */
export declare function saveExcel(filePath: string, savePath?: string): boolean;
/**
 * Create a new empty workbook and save it to the given path.
 */
export declare function createExcel(savePath: string): boolean;
/**
 * closeExcel is a no-op since each operation opens and closes its own COM instance.
 */
export declare function closeExcel(_filePath: string): void;
//# sourceMappingURL=comExcel.d.ts.map