/**
 * KnowledgeService — 知识库文档读取和处理服务
 *
 * 职责：
 * 1. 读取 knowledge/ 目录下的文档文件
 * 2. 支持配置化的注入模式（full/summary/keywords）
 * 3. 超长截断（按 maxTokensPerDoc 配置）
 * 4. 文件不存在时优雅降级
 *
 * 知识库文档存储路径：{dataRoot}/tenants/{tenantId}/agents/{agentId}/knowledge/
 */

import {readFileSync, existsSync, readdirSync} from 'fs';
import {join} from 'path';

/**
 * 知识库配置
 */
export interface KnowledgeConfig {
    /** 最多注入多少文档 */
    maxDocuments: number;
    /** 每文档最大 token 数（1 token ≈ 4 字符） */
    maxTokensPerDoc: number;
    /** 注入模式 */
    summaryMode: 'full' | 'summary' | 'keywords';
}

/**
 * 文档读取结果
 */
export interface DocumentReadResult {
    success: boolean;
    content: string;
    error?: string;
}

/**
 * 已处理的文档
 */
export interface ProcessedDocument {
    id: string;
    name: string;
    type: string;
    content: string;
}

/**
 * 默认知识库配置
 */
export const DEFAULT_KNOWLEDGE_CONFIG: KnowledgeConfig = {
    maxDocuments: 10,
    maxTokensPerDoc: 2000,
    summaryMode: 'full',
};

/**
 * 按字符数估算 token 数（1 token ≈ 4 字符）
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * 截断内容到指定 token 数
 */
export function truncateContent(content: string, maxTokens: number): string {
    const suffix = '... [truncated]';
    const maxChars = maxTokens * 4;
    if (content.length <= maxChars) return content;
    return content.slice(0, maxChars - suffix.length) + suffix;
}

/**
 * 生成摘要（截断超长内容）
 */
export function summarizeContent(content: string, maxChars: number): string {
    const suffix = '... [summary]';
    if (content.length <= maxChars) return content;
    return content.slice(0, maxChars - suffix.length) + suffix;
}

/**
 * 从内容中提取关键词（大写缩写词 + 专有名词）
 */
export function extractKeywords(content: string): string {
    // 提取全大写单词（2+ 字符）作为关键词
    const acronyms = content.match(/\b[A-Z]{2,}\b/g) || [];
    // 提取首字母大写的词（可能是专有名词）
    const properNouns = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];

    const allKeywords = [...new Set([...acronyms, ...properNouns])];
    return `Keywords: ${allKeywords.join(', ')}`;
}

/**
 * 格式化文档用于 prompt 注入
 */
export function formatDocumentForPrompt(
    doc: { id: string; name: string; type: string; content: string },
    config?: KnowledgeConfig,
): string {
    const mode = config?.summaryMode ?? 'full';
    const maxTokens = config?.maxTokensPerDoc ?? DEFAULT_KNOWLEDGE_CONFIG.maxTokensPerDoc;

    let processedContent: string;

    switch (mode) {
        case 'keywords':
            processedContent = extractKeywords(doc.content);
            break;
        case 'summary':
            processedContent = summarizeContent(doc.content, maxTokens * 4);
            break;
        case 'full':
        default:
            processedContent = truncateContent(doc.content, maxTokens);
            break;
    }

    return `## ${doc.name}\n${processedContent}`;
}

/**
 * KnowledgeService — 知识库服务
 */
export class KnowledgeService {
    /**
     * 读取单个文档文件
     */
    readDocument(filePath: string): DocumentReadResult {
        try {
            if (!existsSync(filePath)) {
                return {
                    success: false,
                    content: '',
                    error: `文件不存在: ${filePath}`,
                };
            }

            const content = readFileSync(filePath, 'utf-8');
            return {
                success: true,
                content,
            };
        } catch (error) {
            return {
                success: false,
                content: '',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * 批量处理文档列表
     */
    processDocuments(
        documents: Array<{ id: string; name: string; type: string; path: string }>,
        config: KnowledgeConfig,
    ): ProcessedDocument[] {
        if (!documents || documents.length === 0) return [];

        const {maxDocuments} = config;
        const limitedDocs = documents.slice(0, maxDocuments);

        const results: ProcessedDocument[] = [];

        for (const doc of limitedDocs) {
            const readResult = this.readDocument(doc.path);
            if (!readResult.success) continue;

            results.push({
                id: doc.id,
                name: doc.name,
                type: doc.type,
                content: readResult.content,
            });
        }

        return results;
    }

    /**
     * 读取 Agent 知识库目录下所有文档，返回格式化的文本块
     */
    loadKnowledgeBlock(
        dataRoot: string,
        tenantId: string,
        agentId: string,
        config?: KnowledgeConfig,
    ): string {
        const effectiveConfig = config ?? DEFAULT_KNOWLEDGE_CONFIG;
        const knowledgeDir = join(dataRoot, 'tenants', tenantId, 'agents', agentId, 'knowledge');

        if (!existsSync(knowledgeDir)) return '';

        try {
            const files = readdirSync(knowledgeDir)
                .filter(f => f.endsWith('.md') || f.endsWith('.txt'));

            if (files.length === 0) return '';

            const documents = files.slice(0, effectiveConfig.maxDocuments).map((file, i) => {
                const filePath = join(knowledgeDir, file);
                const readResult = this.readDocument(filePath);
                return {
                    id: `knowledge-${i}`,
                    name: file,
                    type: file.endsWith('.md') ? 'text/markdown' : 'text/plain',
                    content: readResult.success ? readResult.content : '',
                };
            }).filter(d => d.content.length > 0);

            if (documents.length === 0) return '';

            return documents
                .map(d => formatDocumentForPrompt(d, effectiveConfig))
                .join('\n\n');
        } catch {
            return '';
        }
    }
}
