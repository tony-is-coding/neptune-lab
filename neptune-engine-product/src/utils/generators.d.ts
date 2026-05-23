export declare function lastX<A>(as: AsyncGenerator<A>): Promise<A>;
export declare function returnValue<A>(as: AsyncGenerator<unknown, A>): Promise<A>;
export declare function all<A>(generators: AsyncGenerator<A, void>[], concurrencyCap?: number): AsyncGenerator<A, void>;
export declare function toArray<A>(generator: AsyncGenerator<A, void>): Promise<A[]>;
export declare function fromArray<T>(values: T[]): AsyncGenerator<T, void>;
//# sourceMappingURL=generators.d.ts.map