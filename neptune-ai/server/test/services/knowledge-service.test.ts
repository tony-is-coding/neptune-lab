/**
 * KnowledgeService 单元测试
 *
 * Phase 3: 知识库服务
 *
 * 测试覆盖：
 * 1. 文档读取和内容提取
 * 2. 摘要生成（summary 模式）
 * 3. 关键词提取（keywords 模式）
 * 4. 超长文档截断
 * 5. 文件不存在时的优雅降级
 * 6. 空/空文档处理
 * 7. 不同格式文档处理（text/markdown/pdf）
 */

import {describe, test, expect, beforeEach, afterEach} from 'bun:test';
import {tmpdir} from 'os';
import {join} from 'path';
import {writeFileSync, mkdirSync, rmSync, existsSync} from 'fs';
import {
    KnowledgeService,
    extractKeywords,
    summarizeContent,
    truncateContent,
    formatDocumentForPrompt,
    type KnowledgeConfig,
} from '../../src/services/knowledge-service';

describe('KnowledgeService - 文档读取', () => {
    let tempDir: string;
    let service: KnowledgeService;

    beforeEach(() => {
        tempDir = join(tmpdir(), `knowledge-test-${Date.now()}`);
        mkdirSync(tempDir, {recursive: true});
        service = new KnowledgeService();
    });

    afterEach(() => {
        if (existsSync(tempDir)) {
            rmSync(tempDir, {recursive: true, force: true});
        }
    });

    test('Case 1: 应该成功读取文本文件', () => {
        const filePath = join(tempDir, 'test.txt');
        writeFileSync(filePath, 'Hello, World!');

        const result = service.readDocument(filePath);

        expect(result.success).toBe(true);
        expect(result.content).toBe('Hello, World!');
        expect(result.error).toBeUndefined();
    });

    test('Case 2: 应该成功读取 Markdown 文件', () => {
        const filePath = join(tempDir, 'test.md');
        writeFileSync(filePath, '# Title\n\nContent here.');

        const result = service.readDocument(filePath);

        expect(result.success).toBe(true);
        expect(result.content).toContain('# Title');
        expect(result.content).toContain('Content here.');
    });

    test('Case 3: 文件不存在时应优雅降级', () => {
        const result = service.readDocument(join(tempDir, 'nonexistent.txt'));

        expect(result.success).toBe(false);
        expect(result.content).toBe('');
        expect(result.error).toBeDefined();
        // 不应该抛出错误
    });

    test('Case 4: 应该处理空文件', () => {
        const filePath = join(tempDir, 'empty.txt');
        writeFileSync(filePath, '');

        const result = service.readDocument(filePath);

        expect(result.success).toBe(true);
        expect(result.content).toBe('');
    });
});

describe('KnowledgeService - 内容处理', () => {
    test('Case 5: extractKeywords 应提取关键词', () => {
        const content = 'The API and SDK provide functionality for CRM and GUI systems.';
        const keywords = extractKeywords(content);

        expect(keywords).toContain('API');
        expect(keywords).toContain('SDK');
        expect(keywords).toContain('CRM');
        expect(keywords).toContain('GUI');
    });

    test('Case 6: extractKeywords 应处理无关键词文本', () => {
        const content = 'this is a simple text without keywords';
        const keywords = extractKeywords(content);

        // 至少应该返回 Keywords: 前缀
        expect(keywords).toContain('Keywords:');
    });

    test('Case 7: summarizeContent 应截断超长内容', () => {
        const longContent = 'A'.repeat(1000);
        const summary = summarizeContent(longContent, 200);

        expect(summary.length).toBeLessThanOrEqual(210); // 200 + '... [summary]'
        expect(summary).toContain('... [summary]');
    });

    test('Case 8: summarizeContent 应保留短内容', () => {
        const shortContent = 'Short text';
        const summary = summarizeContent(shortContent, 200);

        expect(summary).toBe('Short text');
    });

    test('Case 9: truncateContent 应按 token 截断', () => {
        const content = 'A'.repeat(1000);
        const truncated = truncateContent(content, 100); // 100 tokens ≈ 400 chars

        expect(truncated.length).toBeLessThanOrEqual(410); // 400 + '... [truncated]'
        expect(truncated).toContain('... [truncated]');
    });
});

describe('KnowledgeService - 格式化输出', () => {
    test('Case 10: formatDocumentForPrompt 应生成正确格式', () => {
        const doc = {
            id: 'doc1',
            name: 'test.md',
            type: 'text/markdown',
            content: 'Test content here.',
        };

        const formatted = formatDocumentForPrompt(doc);

        expect(formatted).toContain('## test.md');
        expect(formatted).toContain('Test content here.');
    });

    test('Case 11: formatDocumentForPrompt 应处理空内容', () => {
        const doc = {
            id: 'doc1',
            name: 'empty.txt',
            type: 'text/plain',
            content: '',
        };

        const formatted = formatDocumentForPrompt(doc);

        expect(formatted).toContain('## empty.txt');
        // 空内容应该仍然包含标题
    });

    test('Case 12: formatDocumentForPrompt 应处理 keywords 模式', () => {
        const doc = {
            id: 'doc1',
            name: 'api-doc.md',
            type: 'text/markdown',
            content: 'The API provides REST endpoints for CRUD operations.',
        };

        const config: KnowledgeConfig = {
            maxDocuments: 10,
            maxTokensPerDoc: 1000,
            summaryMode: 'keywords',
        };

        const formatted = formatDocumentForPrompt(doc, config);

        expect(formatted).toContain('## api-doc.md');
        expect(formatted).toContain('Keywords:');
    });

    test('Case 13: formatDocumentForPrompt 应处理 summary 模式', () => {
        const doc = {
            id: 'doc1',
            name: 'long-doc.txt',
            type: 'text/plain',
            content: 'A'.repeat(1000),
        };

        const config: KnowledgeConfig = {
            maxDocuments: 10,
            maxTokensPerDoc: 50,
            summaryMode: 'summary',
        };

        const formatted = formatDocumentForPrompt(doc, config);

        expect(formatted).toContain('## long-doc.txt');
        // 应该被截断
        expect(formatted.length).toBeLessThan(1000);
    });
});

describe('KnowledgeService - 批量处理', () => {
    let tempDir: string;
    let service: KnowledgeService;

    beforeEach(() => {
        tempDir = join(tmpdir(), `knowledge-batch-${Date.now()}`);
        mkdirSync(tempDir, {recursive: true});
        service = new KnowledgeService();
    });

    afterEach(() => {
        if (existsSync(tempDir)) {
            rmSync(tempDir, {recursive: true, force: true});
        }
    });

    test('Case 14: processDocuments 应处理多个文档', () => {
        const file1 = join(tempDir, 'doc1.txt');
        const file2 = join(tempDir, 'doc2.txt');
        writeFileSync(file1, 'Content 1');
        writeFileSync(file2, 'Content 2');

        const documents = [
            {id: '1', name: 'doc1.txt', type: 'text/plain', path: file1},
            {id: '2', name: 'doc2.txt', type: 'text/plain', path: file2},
        ];

        const results = service.processDocuments(documents, {
            maxDocuments: 10,
            maxTokensPerDoc: 1000,
            summaryMode: 'full',
        });

        expect(results).toHaveLength(2);
        expect(results[0].content).toContain('Content 1');
        expect(results[1].content).toContain('Content 2');
    });

    test('Case 15: processDocuments 应限制文档数量', () => {
        // 创建真实文件
        const documents = Array.from({length: 5}, (_, i) => {
            const filePath = join(tempDir, `doc${i}.txt`);
            writeFileSync(filePath, `Content ${i}`);
            return {
                id: `doc${i}`,
                name: `doc${i}.txt`,
                type: 'text/plain' as const,
                path: filePath,
            };
        });

        const config: KnowledgeConfig = {
            maxDocuments: 2,
            maxTokensPerDoc: 1000,
            summaryMode: 'full',
        };

        const results = service.processDocuments(documents, config);

        expect(results).toHaveLength(2); // 只处理前 2 个
    });

    test('Case 16: processDocuments 应跳过不存在的文件', () => {
        const existingFile = join(tempDir, 'existing.txt');
        writeFileSync(existingFile, 'Exists');

        const documents = [
            {id: '1', name: 'existing.txt', type: 'text/plain', path: existingFile},
            {id: '2', name: 'nonexistent.txt', type: 'text/plain', path: join(tempDir, 'nonexistent.txt')},
        ];

        const results = service.processDocuments(documents, {
            maxDocuments: 10,
            maxTokensPerDoc: 1000,
            summaryMode: 'full',
        });

        // 应该只返回成功读取的文档
        expect(results).toHaveLength(1);
        expect(results[0].content).toContain('Exists');
    });

    test('Case 17: processDocuments 应处理空文档列表', () => {
        const results = service.processDocuments([], {
            maxDocuments: 10,
            maxTokensPerDoc: 1000,
            summaryMode: 'full',
        });

        expect(results).toEqual([]);
    });
});

describe('KnowledgeService - 错误处理', () => {
    test('Case 18: readDocument 不应该抛出错误', () => {
        const service = new KnowledgeService();

        // 不存在的文件
        const result = service.readDocument('/nonexistent/path/file.txt');

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });

    test('Case 19: processDocuments 应该优雅处理错误', () => {
        const service = new KnowledgeService();

        const documents = [
            {id: '1', name: 'bad.txt', type: 'text/plain', path: '/nonexistent/bad.txt'},
        ];

        const results = service.processDocuments(documents, {
            maxDocuments: 10,
            maxTokensPerDoc: 1000,
            summaryMode: 'full',
        });

        // 应该返回空数组而不是抛出错误
        expect(results).toEqual([]);
    });
});
