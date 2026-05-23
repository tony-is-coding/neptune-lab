/**
 * Rearranges a command with pipes to place stdin redirect after the first command.
 * This fixes an issue where eval treats the entire piped command as a single unit,
 * causing the stdin redirect to apply to eval itself rather than the first command.
 */
export declare function rearrangePipeCommand(command: string): string;
//# sourceMappingURL=bashPipeCommand.d.ts.map