import type { AddressFamily, LookupAddress as AxiosLookupAddress } from 'axios';
/**
 * SSRF guard for HTTP hooks.
 *
 * Blocks private, link-local, and other non-routable address ranges to prevent
 * project-configured HTTP hooks from reaching cloud metadata endpoints
 * (169.254.169.254) or internal infrastructure.
 *
 * Loopback (127.0.0.0/8, ::1) is intentionally ALLOWED — local dev policy
 * servers are a primary HTTP hook use case.
 *
 * When a global proxy or the sandbox network proxy is in use, the guard is
 * effectively bypassed for the target host because the proxy performs DNS
 * resolution. The sandbox proxy enforces its own domain allowlist.
 */
/**
 * Returns true if the address is in a range that HTTP hooks should not reach.
 *
 * Blocked IPv4:
 *   0.0.0.0/8        "this" network
 *   10.0.0.0/8       private
 *   100.64.0.0/10    shared address space / CGNAT (some cloud metadata, e.g. Alibaba 100.100.100.200)
 *   169.254.0.0/16   link-local (cloud metadata)
 *   172.16.0.0/12    private
 *   192.168.0.0/16   private
 *
 * Blocked IPv6:
 *   ::               unspecified
 *   fc00::/7         unique local
 *   fe80::/10        link-local
 *   ::ffff:<v4>      mapped IPv4 in a blocked range
 *
 * Allowed (returns false):
 *   127.0.0.0/8      loopback (local dev hooks)
 *   ::1              loopback
 *   everything else
 */
export declare function isBlockedAddress(address: string): boolean;
/**
 * A dns.lookup-compatible function that resolves a hostname and rejects
 * addresses in blocked ranges. Used as the `lookup` option in axios request
 * config so that the validated IP is the one the socket connects to — no
 * rebinding window between validation and connection.
 *
 * IP literals in the hostname are validated directly without DNS.
 *
 * Signature matches axios's `lookup` config option (not Node's dns.lookup).
 */
export declare function ssrfGuardedLookup(hostname: string, options: object, callback: (err: Error | null, address: AxiosLookupAddress | AxiosLookupAddress[], family?: AddressFamily) => void): void;
//# sourceMappingURL=ssrfGuard.d.ts.map