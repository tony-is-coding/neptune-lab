/**
 * Constants for the official Anthropic plugins marketplace.
 *
 * The official marketplace is hosted on GitHub and provides first-party
 * plugins developed by Anthropic. This file defines the constants needed
 * to install and identify this marketplace.
 */
/**
 * Source configuration for the official Anthropic plugins marketplace.
 * Used when auto-installing the marketplace on startup.
 */
export declare const OFFICIAL_MARKETPLACE_SOURCE: {
    readonly source: "github";
    readonly repo: "anthropics/claude-plugins-official";
};
/**
 * Display name for the official marketplace.
 * This is the name under which the marketplace will be registered
 * in the known_marketplaces.json file.
 */
export declare const OFFICIAL_MARKETPLACE_NAME = "claude-plugins-official";
//# sourceMappingURL=officialMarketplace.d.ts.map