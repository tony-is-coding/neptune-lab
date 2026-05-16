/**
 * ProviderConfigs — 各 Provider 的配置类型定义
 *
 * 定义每个 Provider 的特定配置选项，支持类型安全的配置传递。
 * 这些配置类型会被 ProviderConfig discriminated union 引用。
 */

import type {BaseProviderConfig} from '../adapters/BaseProvider.js'

// ============================================================
// Anthropic Provider 配置
// ============================================================

/**
 * Anthropic Provider 的配置项
 */
export interface AnthropicProviderConfig extends BaseProviderConfig {
	/** API Key（可选，默认使用 CC 的认证机制） */
	apiKey?: string
	/** Base URL（可选，默认使用 CC 的配置） */
	baseURL?: string
	/** Beta flags（可选） */
	betaFlags?: string[]
}

// ============================================================
// OpenAI Provider 配置
// ============================================================

/**
 * OpenAI Provider 的配置项
 */
export interface OpenAIProviderConfig extends BaseProviderConfig {
	/** API Key（可选，默认使用 CC 的认证机制） */
	apiKey?: string
	/** Base URL（可选，默认使用 CC 的配置） */
	baseURL?: string
	/** Organization（可选） */
	organization?: string
}

// ============================================================
// Gemini Provider 配置
// ============================================================

/**
 * Gemini Provider 的配置项
 */
export interface GeminiProviderConfig extends BaseProviderConfig {
	/** API Key（可选，默认使用 CC 的认证机制） */
	apiKey?: string
}

// ============================================================
// Grok Provider 配置
// ============================================================

/**
 * Grok Provider 的配置项
 */
export interface GrokProviderConfig extends BaseProviderConfig {
	/** API Key（可选，默认使用 CC 的认证机制） */
	apiKey?: string
}

// ============================================================
// Bedrock Provider 配置
// ============================================================

/**
 * Bedrock Provider 的配置项
 */
export interface BedrockProviderConfig extends BaseProviderConfig {
	/** AWS Region（可选，默认使用 CC 的配置） */
	region?: string
	/** AWS Access Key ID（可选） */
	accessKeyId?: string
	/** AWS Secret Access Key（可选） */
	secretAccessKey?: string
	/** AWS Session Token（可选） */
	sessionToken?: string
}

// ============================================================
// Vertex Provider 配置
// ============================================================

/**
 * Vertex Provider 的配置项
 */
export interface VertexProviderConfig extends BaseProviderConfig {
	/** Google Cloud Project ID（可选，默认使用 CC 的配置） */
	projectId?: string
	/** Google Cloud Region（可选，默认使用 CC 的配置） */
	region?: string
}

// ============================================================
// Foundry Provider 配置
// ============================================================

/**
 * Foundry Provider 的配置项
 */
export interface FoundryProviderConfig extends BaseProviderConfig {
	/** Base URL（可选，默认使用 CC 的配置） */
	baseURL?: string
	/** API Key（可选，默认使用 CC 的认证机制） */
	apiKey?: string
}
