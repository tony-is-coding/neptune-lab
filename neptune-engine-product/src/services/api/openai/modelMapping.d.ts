/**
 * Resolve the OpenAI model name for a given Anthropic model.
 *
 * Priority:
 * 1. OPENAI_MODEL env var (override all)
 * 2. OPENAI_DEFAULT_{FAMILY}_MODEL env var (e.g. OPENAI_DEFAULT_SONNET_MODEL)
 * 3. ANTHROPIC_DEFAULT_{FAMILY}_MODEL env var (backward compatibility)
 * 4. DEFAULT_MODEL_MAP lookup
 * 5. Pass through original model name
 */
export declare function resolveOpenAIModel(anthropicModel: string): string;
//# sourceMappingURL=modelMapping.d.ts.map