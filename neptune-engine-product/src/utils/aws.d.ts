/** AWS short-term credentials format. */
export type AwsCredentials = {
    AccessKeyId: string;
    SecretAccessKey: string;
    SessionToken: string;
    Expiration?: string;
};
/** Output from `aws sts get-session-token` or `aws sts assume-role`. */
export type AwsStsOutput = {
    Credentials: AwsCredentials;
};
export declare function isAwsCredentialsProviderError(err: unknown): boolean;
/** Typeguard to validate AWS STS assume-role output */
export declare function isValidAwsStsOutput(obj: unknown): obj is AwsStsOutput;
/** Throws if STS caller identity cannot be retrieved. */
export declare function checkStsCallerIdentity(): Promise<void>;
/**
 * Clear AWS credential provider cache by forcing a refresh
 * This ensures that any changes to ~/.aws/credentials are picked up immediately
 */
export declare function clearAwsIniCache(): Promise<void>;
//# sourceMappingURL=aws.d.ts.map