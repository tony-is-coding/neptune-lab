import type { BetaUsage } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
export type AdvisorServerToolUseBlock = {
    type: 'server_tool_use';
    id: string;
    name: 'advisor';
    input: {
        [key: string]: unknown;
    };
};
export type AdvisorToolResultBlock = {
    type: 'advisor_tool_result';
    tool_use_id: string;
    content: {
        type: 'advisor_result';
        text: string;
    } | {
        type: 'advisor_redacted_result';
        encrypted_content: string;
    } | {
        type: 'advisor_tool_result_error';
        error_code: string;
    };
};
export type AdvisorBlock = AdvisorServerToolUseBlock | AdvisorToolResultBlock;
export declare function isAdvisorBlock(param: {
    type: string;
    name?: string;
}): param is AdvisorBlock;
export declare function isAdvisorEnabled(): boolean;
export declare function canUserConfigureAdvisor(): boolean;
export declare function getExperimentAdvisorModels(): {
    baseModel: string;
    advisorModel: string;
} | undefined;
export declare function modelSupportsAdvisor(model: string): boolean;
export declare function isValidAdvisorModel(model: string): boolean;
export declare function getInitialAdvisorSetting(): string | undefined;
export declare function getAdvisorUsage(usage: BetaUsage): Array<BetaUsage & {
    model: string;
}>;
export declare const ADVISOR_TOOL_INSTRUCTIONS = "# Advisor Tool\n\nYou have access to an `advisor` tool backed by a stronger reviewer model. It takes NO parameters -- when you call it, your entire conversation history is automatically forwarded. The advisor sees the task, every tool call you've made, every result you've seen.\n\nCall advisor BEFORE substantive work -- before writing code, before committing to an interpretation, before building on an assumption. If the task requires orientation first (finding files, reading code, seeing what's there), do that, then call advisor. Orientation is not substantive work. Writing, editing, and declaring an answer are.\n\nAlso call advisor:\n- When you believe the task is complete. BEFORE this call, make your deliverable durable: write the file, stage the change, save the result. The advisor call takes time; if the session ends during it, a durable result persists and an unwritten one doesn't.\n- When stuck -- errors recurring, approach not converging, results that don't fit.\n- When considering a change of approach.\n\nOn tasks longer than a few steps, call advisor at least once before committing to an approach and once before declaring done. On short reactive tasks where the next action is dictated by tool output you just read, you don't need to keep calling -- the advisor adds most of its value on the first call, before the approach crystallizes.\n\nGive the advice serious weight. If you follow a step and it fails empirically, or you have primary-source evidence that contradicts a specific claim (the file says X, the code does Y), adapt. A passing self-test is not evidence the advice is wrong -- it's evidence your test doesn't check what the advice is checking.\n\nIf you've already retrieved data pointing one way and the advisor points another: don't silently switch. Surface the conflict in one more advisor call -- \"I found X, you suggest Y, which constraint breaks the tie?\" The advisor saw your evidence but may have underweighted it; a reconcile call is cheaper than committing to the wrong branch.";
//# sourceMappingURL=advisor.d.ts.map