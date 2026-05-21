export declare class Stream<T> implements AsyncIterator<T> {
    private readonly returned?;
    private readonly queue;
    private readResolve?;
    private readReject?;
    private isDone;
    private hasError;
    private started;
    constructor(returned?: () => void);
    [Symbol.asyncIterator](): AsyncIterableIterator<T>;
    next(): Promise<IteratorResult<T, unknown>>;
    enqueue(value: T): void;
    done(): void;
    error(error: unknown): void;
    return(): Promise<IteratorResult<T, unknown>>;
}
//# sourceMappingURL=stream.d.ts.map