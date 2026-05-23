/**
 * Called from init.ts to wire up the proxy env function after the upstreamproxy
 * module has been lazily loaded. Must be called before any subprocess is spawned.
 */
export declare function registerUpstreamProxyEnvFn(fn: () => Record<string, string>): void;
export declare function subprocessEnv(): NodeJS.ProcessEnv;
//# sourceMappingURL=subprocessEnv.d.ts.map