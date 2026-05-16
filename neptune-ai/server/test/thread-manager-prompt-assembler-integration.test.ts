/**
 * ThreadManager + PromptAssembler 集成测试
 *
 * Phase 2: 验证 ThreadManager.dispatch 正确调用 PromptAssembler
 *
 * 注意：这是单元测试风格的集成测试，直接测试 PromptAssembler 的调用逻辑
 */

import {describe, test, expect} from 'bun:test';
import {assembleSystemPrompt, type AgentTemplate, type Skill, type Document} from '../src/services/prompt-assembler';

describe('ThreadManager + PromptAssembler 集成逻辑', () => {
    test('应该正确组装 systemPrompt（包含 Guard）', () => {
        const template: AgentTemplate = {
            systemPrompt: 'Old prompt',
            promptConfig: {
                identity: 'You are a test assistant.',
            },
        };

        const result = assembleSystemPrompt({
            template,
            skills: [],
            documents: [],
        });

        // 验证 Guard 存在
        expect(result).toContain('Platform Security Guidelines');
        expect(result).toContain('You are a test assistant.');
    });

    test('应该正确组装 systemPrompt（禁用 Guard）', () => {
        const template: AgentTemplate = {
            systemPrompt: 'Old prompt',
            promptConfig: {
                identity: 'You are a test assistant.',
                disableGuard: true,
            },
        };

        const result = assembleSystemPrompt({
            template,
            skills: [],
            documents: [],
        });

        // 验证 Guard 不存在
        expect(result).not.toContain('Platform Security Guidelines');
        expect(result).toBe('You are a test assistant.');
    });

    test('应该组装 inlineSkills 和 skills', () => {
        const template: AgentTemplate = {
            systemPrompt: 'Old prompt',
            promptConfig: {
                identity: 'You are a test assistant.',
                inlineSkills: [
                    {name: 'Inline Skill', content: 'Inline content.'},
                ],
            },
        };

        const skills: Skill[] = [
            {name: 'Table Skill', content: 'Table content.'},
        ];

        const result = assembleSystemPrompt({
            template,
            skills,
            documents: [],
        });

        // 验证两种技能都被组装
        expect(result).toContain('Inline Skill');
        expect(result).toContain('Inline content.');
        expect(result).toContain('Table Skill');
        expect(result).toContain('Table content.');
    });

    test('prompt_config 不存在时应回退到 system_prompt', () => {
        const template: AgentTemplate = {
            systemPrompt: 'Fallback prompt',
            promptConfig: undefined,
        };

        const result = assembleSystemPrompt({
            template,
            skills: [],
            documents: [],
        });

        // 验证回退到 systemPrompt
        expect(result).toBe('Fallback prompt');
    });

    test('应该组装 documents（知识库）', () => {
        const template: AgentTemplate = {
            systemPrompt: 'Old prompt',
            promptConfig: {
                identity: 'You are a test assistant.',
                knowledgeConfig: {
                    maxDocuments: 10,
                    maxTokensPerDoc: 1000,
                    summaryMode: 'full',
                },
            },
        };

        const documents: Document[] = [
            {
                id: 'doc1',
                name: 'test.md',
                type: 'text/markdown',
                content: 'Test document content.',
            },
        ];

        const result = assembleSystemPrompt({
            template,
            skills: [],
            documents,
        });

        // 验证文档被组装
        expect(result).toContain('Knowledge Base');
        expect(result).toContain('test.md');
        expect(result).toContain('Test document content.');
    });

    test('应该按正确顺序组装所有 Block', () => {
        const template: AgentTemplate = {
            systemPrompt: 'Old prompt',
            promptConfig: {
                identity: 'You are a test assistant.',
                inlineSkills: [{name: 'Test Skill', content: 'Test content.'}],
                toolInstructions: 'Use tools responsibly.',
            },
        };

        const skills: Skill[] = [];
        const documents: Document[] = [
            {
                id: 'doc1',
                name: 'guide.md',
                type: 'text/markdown',
                content: 'Guide content.',
            },
        ];

        const result = assembleSystemPrompt({
            template,
            skills,
            documents,
        });

        // 验证顺序：Guard → identity → skills → knowledge → tools
        const guardIndex = result.indexOf('Platform Security Guidelines');
        const identityIndex = result.indexOf('You are a test assistant');
        const skillsIndex = result.indexOf('Test Skill');
        const knowledgeIndex = result.indexOf('guide.md');
        const toolsIndex = result.indexOf('Use tools responsibly');

        expect(guardIndex).toBeLessThan(identityIndex!);
        expect(identityIndex!).toBeLessThan(skillsIndex!);
        expect(skillsIndex!).toBeLessThan(knowledgeIndex!);
        expect(knowledgeIndex!).toBeLessThan(toolsIndex!);
    });
});
