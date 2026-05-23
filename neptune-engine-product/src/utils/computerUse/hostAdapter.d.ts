import type { ComputerUseHostAdapter } from '@ant/computer-use-mcp/types';
/**
 * Process-lifetime singleton. Built once on first CU tool call; native modules
 * (both `@ant/computer-use-input` and `@ant/computer-use-swift`) are loaded
 * here via the executor factory, which throws on load failure — there is no
 * degraded mode.
 */
export declare function getComputerUseHostAdapter(): ComputerUseHostAdapter;
//# sourceMappingURL=hostAdapter.d.ts.map