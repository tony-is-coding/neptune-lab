export declare const PROMPT_PREFIX = "prompt:";
export type ClassifierResult = {
    matches: boolean;
    matchedDescription?: string;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
};
export type ClassifierBehavior = 'deny' | 'ask' | 'allow';
export declare function extractPromptDescription(_ruleContent: string | undefined): string | null;
export declare function createPromptRuleContent(description: string): string;
export declare function isClassifierPermissionsEnabled(): boolean;
export declare function getBashPromptDenyDescriptions(_context: unknown): string[];
export declare function getBashPromptAskDescriptions(_context: unknown): string[];
export declare function getBashPromptAllowDescriptions(_context: unknown): string[];
export declare function classifyBashCommand(_command: string, _cwd: string, _descriptions: string[], _behavior: ClassifierBehavior, _signal: AbortSignal, _isNonInteractiveSession: boolean): Promise<ClassifierResult>;
export declare function generateGenericDescription(_command: string, specificDescription: string | undefined, _signal: AbortSignal): Promise<string | null>;
//# sourceMappingURL=bashClassifier.d.ts.map