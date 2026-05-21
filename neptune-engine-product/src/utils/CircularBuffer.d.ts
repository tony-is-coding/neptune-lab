/**
 * A fixed-size circular buffer that automatically evicts the oldest items
 * when the buffer is full. Useful for maintaining a rolling window of data.
 */
export declare class CircularBuffer<T> {
    private capacity;
    private buffer;
    private head;
    private size;
    constructor(capacity: number);
    /**
     * Add an item to the buffer. If the buffer is full,
     * the oldest item will be evicted.
     */
    add(item: T): void;
    /**
     * Add multiple items to the buffer at once.
     */
    addAll(items: T[]): void;
    /**
     * Get the most recent N items from the buffer.
     * Returns fewer items if the buffer contains less than N items.
     */
    getRecent(count: number): T[];
    /**
     * Get all items currently in the buffer, in order from oldest to newest.
     */
    toArray(): T[];
    /**
     * Clear all items from the buffer.
     */
    clear(): void;
    /**
     * Get the current number of items in the buffer.
     */
    length(): number;
}
//# sourceMappingURL=CircularBuffer.d.ts.map