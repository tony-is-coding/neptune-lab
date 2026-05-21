/**
 * YAML parsing wrapper.
 *
 * Uses Bun.YAML (built-in, zero-cost) when running under Bun, otherwise falls
 * back to the `yaml` npm package. The package is lazy-required inside the
 * non-Bun branch so native Bun builds never load the ~270KB yaml parser.
 */
export declare function parseYaml(input: string): unknown;
//# sourceMappingURL=yaml.d.ts.map