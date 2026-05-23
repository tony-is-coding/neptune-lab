/**
 * Singleton manager for cloud-provider authentication status (AWS Bedrock,
 * GCP Vertex). Communicates auth refresh state between auth utilities and
 * React components / SDK output. The SDK 'auth_status' message shape is
 * provider-agnostic, so a single manager serves all providers.
 *
 * Legacy name: originally AWS-only; now used by all cloud auth refresh flows.
 */
export type AwsAuthStatus = {
    isAuthenticating: boolean;
    output: string[];
    error?: string;
};
export declare class AwsAuthStatusManager {
    private static instance;
    private status;
    private changed;
    static getInstance(): AwsAuthStatusManager;
    getStatus(): AwsAuthStatus;
    startAuthentication(): void;
    addOutput(line: string): void;
    setError(error: string): void;
    endAuthentication(success: boolean): void;
    subscribe: (listener: (status: AwsAuthStatus) => void) => () => void;
    static reset(): void;
}
//# sourceMappingURL=awsAuthStatusManager.d.ts.map