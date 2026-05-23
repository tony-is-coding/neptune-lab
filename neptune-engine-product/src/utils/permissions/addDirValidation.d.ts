import type { ToolPermissionContext } from '../../Tool.js';
export type AddDirectoryResult = {
    resultType: 'success';
    absolutePath: string;
} | {
    resultType: 'emptyPath';
} | {
    resultType: 'pathNotFound' | 'notADirectory';
    directoryPath: string;
    absolutePath: string;
} | {
    resultType: 'alreadyInWorkingDirectory';
    directoryPath: string;
    workingDir: string;
};
export declare function validateDirectoryForWorkspace(directoryPath: string, permissionContext: ToolPermissionContext): Promise<AddDirectoryResult>;
export declare function addDirHelpMessage(result: AddDirectoryResult): string;
//# sourceMappingURL=addDirValidation.d.ts.map