export type EnvironmentKind = 'anthropic_cloud' | 'byoc' | 'bridge';
export type EnvironmentState = 'active';
export type EnvironmentResource = {
    kind: EnvironmentKind;
    environment_id: string;
    name: string;
    created_at: string;
    state: EnvironmentState;
};
export type EnvironmentListResponse = {
    environments: EnvironmentResource[];
    has_more: boolean;
    first_id: string | null;
    last_id: string | null;
};
/**
 * Fetches the list of available environments from the Environment API
 * @returns Promise<EnvironmentResource[]> Array of available environments
 * @throws Error if the API request fails or no access token is available
 */
export declare function fetchEnvironments(): Promise<EnvironmentResource[]>;
/**
 * Creates a default anthropic_cloud environment for users who have none.
 * Uses the public environment_providers route (same auth as fetchEnvironments).
 */
export declare function createDefaultCloudEnvironment(name: string): Promise<EnvironmentResource>;
//# sourceMappingURL=environments.d.ts.map