/**
 * Tracks which tool uses were auto-approved by classifiers.
 * Populated from useCanUseTool.ts and permissions.ts, read from UserToolSuccessMessage.tsx.
 */
export declare function setClassifierApproval(toolUseID: string, matchedRule: string): void;
export declare function getClassifierApproval(toolUseID: string): string | undefined;
export declare function setYoloClassifierApproval(toolUseID: string, reason: string): void;
export declare function getYoloClassifierApproval(toolUseID: string): string | undefined;
export declare function setClassifierChecking(toolUseID: string): void;
export declare function clearClassifierChecking(toolUseID: string): void;
export declare const subscribeClassifierChecking: (listener: () => void) => () => void;
export declare function isClassifierChecking(toolUseID: string): boolean;
export declare function deleteClassifierApproval(toolUseID: string): void;
export declare function clearClassifierApprovals(): void;
//# sourceMappingURL=classifierApprovals.d.ts.map