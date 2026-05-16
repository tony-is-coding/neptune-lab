declare module 'bcrypt' {
    export function hash(data: string, saltOrRounds: string | number): Promise<string>;

    export function compare(data: string, encrypted: string): Promise<boolean>;

    export function genRounds(rounds?: number): Promise<string>;
}

declare module 'claude-code-best/engine' {
    export interface QueryEvent {
        type: string;

        [key: string]: unknown;
    }

    export interface EngineCreateOptions {
        systemPrompt?: string;
        memoryRoot?: string;
        extensions?: {
            permissions?: {
                permissionDelegate?: import('../services/permission-delegate').PermissionDelegateLike;
            };
        };
        provider?: Record<string, unknown>;
    }

    export class AgentEngine {
        static create(options: EngineCreateOptions): AgentEngine;

        createSession(options: { workspace: string; systemPrompt?: string }): Promise<string>;

        loadSession(options: { workspace: string }): Promise<string | null>;

        setMemoryPath(sessionId: string, userId: string): void;

        query(sessionId: string, content: string): AsyncIterable<QueryEvent>;

        on(event: string, handler: (payload: unknown) => void): void;

        once(event: string, handler: (payload: unknown) => void): void;

        destroy(): Promise<void>;
    }
}

declare module 'claude-code-best/engine/permissions' {
    export interface PermissionDelegate {
        onToolAccess(
            toolName: string,
            input: Record<string, unknown>,
        ): Promise<'allow' | 'deny'>;
    }
}
