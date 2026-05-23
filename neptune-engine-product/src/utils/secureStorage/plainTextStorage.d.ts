import type { SecureStorageData } from './types.js';
export declare const plainTextStorage: {
    name: string;
    read(): SecureStorageData | null;
    readAsync(): Promise<SecureStorageData | null>;
    update(data: SecureStorageData): {
        success: boolean;
        warning?: string;
    };
    delete(): boolean;
};
//# sourceMappingURL=plainTextStorage.d.ts.map