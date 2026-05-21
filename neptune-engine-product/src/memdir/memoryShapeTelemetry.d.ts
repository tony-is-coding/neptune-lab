import type { MemoryHeader } from './memoryScan.js';
import type { MemoryScope } from '../utils/memoryFileDetection.js';
export {};
export declare const logMemoryRecallShape: (memories: MemoryHeader[], selected: MemoryHeader[]) => void;
export declare const logMemoryWriteShape: (toolName: string, toolInput: Record<string, unknown>, filePath: string, scope: MemoryScope) => void;
//# sourceMappingURL=memoryShapeTelemetry.d.ts.map