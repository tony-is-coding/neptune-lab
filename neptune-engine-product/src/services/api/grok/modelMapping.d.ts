/**
 * Resolve the Grok model name for a given Anthropic model.
 *
 * Priority:
 * 1. GROK_MODEL env var (override all)
 * 2. GROK_MODEL_MAP env var — JSON family map (e.g. {"opus":"grok-4"})
 * 3. GROK_DEFAULT_{FAMILY}_MODEL env var (e.g. GROK_DEFAULT_OPUS_MODEL)
 * 4. ANTHROPIC_DEFAULT_{FAMILY}_MODEL env var (backward compat)
 * 5. DEFAULT_MODEL_MAP lookup
 * 6. Family-level default
 * 7. Pass through original model name
 */
export declare function resolveGrokModel(anthropicModel: string): string;
//# sourceMappingURL=modelMapping.d.ts.map