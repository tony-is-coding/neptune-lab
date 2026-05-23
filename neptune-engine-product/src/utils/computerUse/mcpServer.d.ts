import { createComputerUseMcpServer } from '@ant/computer-use-mcp';
/**
 * Construct the in-process server. Delegates to the package's
 * `createComputerUseMcpServer` for the Server object + stub CallTool handler,
 * then REPLACES the ListTools handler with one that includes installed-app
 * names in the `request_access` description (the package's factory doesn't
 * take `installedAppNames`, and Cowork builds its own tool array in
 * serverDef.ts for the same reason).
 *
 * Async so the 1s app-enumeration timeout doesn't block startup — called from
 * an `await import()` in `client.ts` on first CU connection, not `main.tsx`.
 *
 * Real dispatch still goes through `wrapper.tsx`'s `.call()` override; this
 * server exists only to answer ListTools.
 */
export declare function createComputerUseMcpServerForCli(): Promise<ReturnType<typeof createComputerUseMcpServer>>;
/**
 * Subprocess entrypoint for `--computer-use-mcp`. Mirror of
 * `runClaudeInChromeMcpServer` — stdio transport, exit on stdin close,
 * flush analytics before exit.
 */
export declare function runComputerUseMcpServer(): Promise<void>;
//# sourceMappingURL=mcpServer.d.ts.map