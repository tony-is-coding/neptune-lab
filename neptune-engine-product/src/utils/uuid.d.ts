import { type UUID } from 'crypto';
import type { AgentId } from 'src/types/ids.js';
/**
 * Validate uuid
 * @param maybeUUID The value to be checked if it is a uuid
 * @returns string as UUID or null if it is not valid
 */
export declare function validateUuid(maybeUuid: unknown): UUID | null;
/**
 * Generate a new agent ID with prefix for consistency with task IDs.
 * Format: a{label-}{16 hex chars}
 * Example: aa3f2c1b4d5e6f7a8, acompact-a3f2c1b4d5e6f7a8
 */
export declare function createAgentId(label?: string): AgentId;
//# sourceMappingURL=uuid.d.ts.map