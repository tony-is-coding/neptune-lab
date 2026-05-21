import { type ExportResult } from '@opentelemetry/core';
import type { LogRecordExporter, ReadableLogRecord } from '@opentelemetry/sdk-logs';
/**
 * Exporter for 1st-party event logging to /api/event_logging/batch.
 *
 * Export cycles are controlled by OpenTelemetry's BatchLogRecordProcessor, which
 * triggers export() when either:
 * - Time interval elapses (default: 5 seconds via scheduledDelayMillis)
 * - Batch size is reached (default: 200 events via maxExportBatchSize)
 *
 * This exporter adds resilience on top:
 * - Append-only log for failed events (concurrency-safe)
 * - Quadratic backoff retry for failed events, dropped after maxAttempts
 * - Immediate retry of queued events when any export succeeds (endpoint is healthy)
 * - Chunking large event sets into smaller batches
 * - Auth fallback: retries without auth on 401 errors
 */
export declare class FirstPartyEventLoggingExporter implements LogRecordExporter {
    private readonly endpoint;
    private readonly timeout;
    private readonly maxBatchSize;
    private readonly skipAuth;
    private readonly batchDelayMs;
    private readonly baseBackoffDelayMs;
    private readonly maxBackoffDelayMs;
    private readonly maxAttempts;
    private readonly isKilled;
    private pendingExports;
    private isShutdown;
    private readonly schedule;
    private cancelBackoff;
    private attempts;
    private isRetrying;
    private lastExportErrorContext;
    constructor(options?: {
        timeout?: number;
        maxBatchSize?: number;
        skipAuth?: boolean;
        batchDelayMs?: number;
        baseBackoffDelayMs?: number;
        maxBackoffDelayMs?: number;
        maxAttempts?: number;
        path?: string;
        baseUrl?: string;
        isKilled?: () => boolean;
        schedule?: (fn: () => Promise<void>, delayMs: number) => () => void;
    });
    getQueuedEventCount(): Promise<number>;
    private getCurrentBatchFilePath;
    private loadEventsFromFile;
    private loadEventsFromCurrentBatch;
    private saveEventsToFile;
    private appendEventsToFile;
    private deleteFile;
    private retryPreviousBatches;
    private retryFileInBackground;
    export(logs: ReadableLogRecord[], resultCallback: (result: ExportResult) => void): Promise<void>;
    private doExport;
    private sendEventsInBatches;
    private queueFailedEvents;
    private scheduleBackoffRetry;
    private retryFailedEvents;
    private resetBackoff;
    private sendBatchWithRetry;
    private logSuccess;
    private hrTimeToDate;
    private transformLogsToEvents;
    shutdown(): Promise<void>;
    forceFlush(): Promise<void>;
}
//# sourceMappingURL=firstPartyEventLoggingExporter.d.ts.map