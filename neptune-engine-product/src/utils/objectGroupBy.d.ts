/**
 * https://tc39.es/ecma262/multipage/fundamental-objects.html#sec-object.groupby
 */
export declare function objectGroupBy<T, K extends PropertyKey>(items: Iterable<T>, keySelector: (item: T, index: number) => K): Partial<Record<K, T[]>>;
//# sourceMappingURL=objectGroupBy.d.ts.map