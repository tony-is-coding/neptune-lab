import type { Attachment } from '../../utils/attachments.js';
import type { Message } from '../../types/message.js';
import type { ToolUseContext } from '../../Tool.js';
export declare const startSkillDiscoveryPrefetch: (input: string | null, messages: Message[], toolUseContext: ToolUseContext) => Promise<Attachment[]>;
export declare const collectSkillDiscoveryPrefetch: (pending: Promise<Attachment[]>) => Promise<Attachment[]>;
export declare const getTurnZeroSkillDiscovery: (input: string, messages: Message[], context: ToolUseContext) => Promise<Attachment | null>;
//# sourceMappingURL=prefetch.d.ts.map