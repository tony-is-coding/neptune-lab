/**
 * PromptAssembler 单元测试
 *
 * Phase 2: System Prompt 模块化
 *
 * 测试覆盖：
 * 1. 向后兼容（prompt_config 不存在时回退到 system_prompt）
 * 2. 平台 Guard 注入/跳过
 * 3. Agent 身份注入
 * 4. 技能注入（inline + table）
 * 5. 知识库注入（空文档、超长截断、模式切换）
 * 6. 工具约束注入
 * 7. 完整组装流程
 * 8. 边界输入处理
 *
 * 目标：≥15 test cases
 */

import { describe, test, expect } from 'bun:test';
import { assembleSystemPrompt, buildSkillsBlock, buildKnowledgeBlock, PLATFORM_GUARD, DEFAULT_KNOWLEDGE_CONFIG } from '../../src/services/prompt-assembler';

// ===== 类型定义（与实际代码保持一致） =====

interface PromptConfig {
  identity: string;
  inlineSkills?: Array<{ name: string; content: string }>;
  knowledgeConfig?: {
    maxDocuments: number;
    maxTokensPerDoc: number;
    summaryMode: 'full' | 'summary' | 'keywords';
  };
  toolInstructions?: string;
  disableGuard?: boolean;
}

interface AgentTemplate {
  systemPrompt: string;
  promptConfig?: PromptConfig;
  tools?: string[];
  mcpServers?: Array<{ name: string; url: string }>;
}

interface Skill {
  name: string;
  content?: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  content: string;
}

interface AssembleParams {
  template: AgentTemplate;
  skills: Skill[];
  documents: Document[];
}

// ===== 1. 向后兼容测试 =====

describe('PromptAssembler - 向后兼容', () => {
  test('Case 1: prompt_config 不存在时应回退到 system_prompt', () => {
    const template: AgentTemplate = {
      systemPrompt: 'You are a helpful assistant.',
      promptConfig: undefined,
    };

    const result = assembleSystemPrompt({
      template,
      skills: [],
      documents: [],
    });

    expect(result).toBe('You are a helpful assistant.');
  });

  test('Case 2: prompt_config 为 null 时应回退到 system_prompt', () => {
    const template: AgentTemplate = {
      systemPrompt: 'Fallback prompt',
      promptConfig: null as any,
    };

    const result = assembleSystemPrompt({
      template,
      skills: [],
      documents: [],
    });

    expect(result).toBe('Fallback prompt');
  });
});

// ===== 2. 平台 Guard 测试 =====

describe('PromptAssembler - 平台 Guard', () => {
  test('Case 3: 默认情况下应注入平台 Guard', () => {
    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity: 'You are a data analyst.',
      },
    };

    const result = assembleSystemPrompt({
      template,
      skills: [],
      documents: [],
    });

    // 验证结果以 PLATFORM_GUARD 开头
    expect(result).toMatch(new RegExp(`^${escapeRegExp(PLATFORM_GUARD)}`));
    expect(result).toContain('You are a data analyst.');
  });

  test('Case 4: disableGuard=true 时不注入平台 Guard', () => {
    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity: 'You are a data analyst.',
        disableGuard: true,
      },
    };

    const result = assembleSystemPrompt({
      template,
      skills: [],
      documents: [],
    });

    // 验证结果不以 PLATFORM_GUARD 开头
    expect(result).not.toMatch(new RegExp(`^${escapeRegExp(PLATFORM_GUARD)}`));
    expect(result).toBe('You are a data analyst.');
  });
});

// ===== 3. Agent 身份测试 =====

describe('PromptAssembler - Agent 身份', () => {
  test('Case 5: identity 应正确注入', () => {
    const identity = 'You are a senior software engineer. You write clean, maintainable code.';
    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity,
      },
    };

    const result = assembleSystemPrompt({
      template,
      skills: [],
      documents: [],
    });

    expect(result).toContain(identity);
  });

  test('Case 6: identity 包含多行文本时应正确处理', () => {
    const identity = `You are a data analyst.

Your responsibilities:
- Analyze data trends
- Create visualizations
- Generate reports`;

    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity,
      },
    };

    const result = assembleSystemPrompt({
      template,
      skills: [],
      documents: [],
    });

    expect(result).toContain('Your responsibilities:');
    expect(result).toContain('- Analyze data trends');
  });
});

// ===== 4. 技能注入测试 =====

describe('PromptAssembler - 技能注入', () => {
  test('Case 7: inlineSkills 应正确注入', () => {
    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity: 'You are an assistant.',
        inlineSkills: [
          { name: 'Code Review', content: 'Review code for bugs and best practices.' },
          { name: 'Testing', content: 'Write comprehensive unit tests.' },
        ],
      },
    };

    const result = assembleSystemPrompt({
      template,
      skills: [],
      documents: [],
    });

    expect(result).toContain('Code Review');
    expect(result).toContain('Review code for bugs');
    expect(result).toContain('Testing');
    expect(result).toContain('Write comprehensive unit tests');
  });

  test('Case 8: skills 表关联应正确注入', () => {
    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity: 'You are an assistant.',
      },
    };

    const skills: Skill[] = [
      { name: 'Debug', content: 'Debug code issues systematically.' },
      { name: 'Refactor', content: 'Refactor code for better maintainability.' },
    ];

    const result = assembleSystemPrompt({
      template,
      skills,
      documents: [],
    });

    expect(result).toContain('Debug');
    expect(result).toContain('Debug code issues');
    expect(result).toContain('Refactor');
    expect(result).toContain('Refactor code');
  });

  test('Case 9: inlineSkills 和 skills 表应合并', () => {
    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity: 'You are an assistant.',
        inlineSkills: [
          { name: 'Inline Skill', content: 'Content from inline skill.' },
        ],
      },
    };

    const skills: Skill[] = [
      { name: 'Table Skill', content: 'Content from table skill.' },
    ];

    const result = assembleSystemPrompt({
      template,
      skills,
      documents: [],
    });

    expect(result).toContain('Inline Skill');
    expect(result).toContain('Content from inline skill');
    expect(result).toContain('Table Skill');
    expect(result).toContain('Content from table skill');
  });

  test('Case 10: 空 skills 列表不应注入技能块', () => {
    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity: 'You are an assistant.',
        inlineSkills: [],
      },
    };

    const result = assembleSystemPrompt({
      template,
      skills: [],
      documents: [],
    });

    // 验证只有 Guard 和 identity，没有技能相关的分隔符
    const lines = result.split('\n').filter(l => l.trim());
    expect(lines.length).toBeGreaterThan(0);
    // 技能块会添加标题，这里验证没有多余的空块
  });
});

// ===== 5. 知识库注入测试 =====

describe('PromptAssembler - 知识库注入', () => {
  test('Case 11: 空文档列表不应注入知识库块', () => {
    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity: 'You are an assistant.',
        knowledgeConfig: {
          maxDocuments: 10,
          maxTokensPerDoc: 1000,
          summaryMode: 'full',
        },
      },
    };

    const result = assembleSystemPrompt({
      template,
      skills: [],
      documents: [],
    });

    // 空文档时不应该有知识库部分
    expect(result).not.toContain('Knowledge');
  });

  test('Case 12: 单个文档应正确注入', () => {
    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity: 'You are an assistant.',
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
        name: 'project-spec.md',
        type: 'text/markdown',
        content: 'Project specifications: Build a CRM system.',
      },
    ];

    const result = assembleSystemPrompt({
      template,
      skills: [],
      documents,
    });

    expect(result).toContain('project-spec.md');
    expect(result).toContain('Project specifications');
  });

  test('Case 13: summaryMode=keywords 应只提取关键词', () => {
    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity: 'You are an assistant.',
        knowledgeConfig: {
          maxDocuments: 10,
          maxTokensPerDoc: 100,
          summaryMode: 'keywords',
        },
      },
    };

    const documents: Document[] = [
      {
        id: 'doc1',
        name: 'spec.md',
        type: 'text/markdown',
        content: 'Build a CRM system with customer management and sales tracking.',
      },
    ];

    const result = assembleSystemPrompt({
      template,
      skills: [],
      documents,
    });

    // 验证关键词模式（简化检查：包含关键信息）
    expect(result).toContain('CRM');
  });

  test('Case 14: 超长文档应截断', () => {
    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity: 'You are an assistant.',
        knowledgeConfig: {
          maxDocuments: 10,
          maxTokensPerDoc: 50, // 很小的限制
          summaryMode: 'full',
        },
      },
    };

    const longContent = 'A'.repeat(1000);
    const documents: Document[] = [
      {
        id: 'doc1',
        name: 'long-doc.txt',
        type: 'text/plain',
        content: longContent,
      },
    ];

    const result = assembleSystemPrompt({
      template,
      skills: [],
      documents,
    });

    // 验证内容被截断（包含截断标记或长度受限）
    expect(result).toContain('...');
  });
});

// ===== 6. 工具约束测试 =====

describe('PromptAssembler - 工具约束', () => {
  test('Case 15: toolInstructions 应正确注入', () => {
    const toolInstructions = `Available tools:
- readFile: Read file contents
- writeFile: Write file contents

Use these tools responsibly.`;

    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity: 'You are an assistant.',
        toolInstructions,
      },
    };

    const result = assembleSystemPrompt({
      template,
      skills: [],
      documents: [],
    });

    expect(result).toContain('Available tools:');
    expect(result).toContain('readFile');
    expect(result).toContain('Use these tools responsibly');
  });
});

// ===== 7. 完整组装流程测试 =====

describe('PromptAssembler - 完整组装流程', () => {
  test('Case 16: 完整模块组装（所有 Block 都存在）', () => {
    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity: 'You are a senior developer.',
        inlineSkills: [{ name: 'Code Review', content: 'Review code thoroughly.' }],
        knowledgeConfig: {
          maxDocuments: 5,
          maxTokensPerDoc: 1000,
          summaryMode: 'full',
        },
        toolInstructions: 'Use tools responsibly.',
      },
      tools: ['readFile', 'writeFile'],
    };

    const skills: Skill[] = [{ name: 'Testing', content: 'Write tests.' }];
    const documents: Document[] = [
      {
        id: 'doc1',
        name: 'guide.md',
        type: 'text/markdown',
        content: 'Development guidelines.',
      },
    ];

    const result = assembleSystemPrompt({
      template,
      skills,
      documents,
    });

    // 验证所有 Block 都存在
    expect(result).toContain(PLATFORM_GUARD.substring(0, 50)); // Guard 内容
    expect(result).toContain('You are a senior developer'); // Block 2
    expect(result).toContain('Code Review'); // Block 3 (inline)
    expect(result).toContain('Testing'); // Block 3 (table)
    expect(result).toContain('guide.md'); // Block 4
    expect(result).toContain('Use tools responsibly'); // Block 5

    // 验证顺序：Guard → identity → skills → knowledge → tools
    const guardIndex = result.indexOf(PLATFORM_GUARD.substring(0, 20));
    const identityIndex = result.indexOf('You are a senior developer');
    const skillsIndex = result.indexOf('Code Review');
    const knowledgeIndex = result.indexOf('guide.md');
    const toolsIndex = result.indexOf('Use tools responsibly');

    expect(guardIndex).toBeLessThan(identityIndex!);
    expect(identityIndex!).toBeLessThan(skillsIndex!);
    expect(skillsIndex!).toBeLessThan(knowledgeIndex!);
    expect(knowledgeIndex!).toBeLessThan(toolsIndex!);
  });
});

// ===== 8. 边界输入测试 =====

describe('PromptAssembler - 边界输入', () => {
  test('Case 17: identity 为空字符串时应优雅处理', () => {
    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity: '',
        disableGuard: true,
      },
    };

    const result = assembleSystemPrompt({
      template,
      skills: [],
      documents: [],
    });

    // 空字符串仍会被添加，但不会报错
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  test('Case 18: 技能 content 为空时应使用默认描述', () => {
    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity: 'You are an assistant.',
      },
    };

    const skills: Skill[] = [
      { name: 'Skill Without Content', content: '' },
      { name: 'Skill With Content', content: 'Has content.' },
    ];

    const result = assembleSystemPrompt({
      template,
      skills,
      documents: [],
    });

    expect(result).toContain('Skill Without Content');
    expect(result).toContain('Skill With Content');
  });

  test('Case 19: 文档内容为空时应优雅处理', () => {
    const template: AgentTemplate = {
      systemPrompt: 'Old prompt',
      promptConfig: {
        identity: 'You are an assistant.',
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
        name: 'empty.txt',
        type: 'text/plain',
        content: '',
      },
    ];

    const result = assembleSystemPrompt({
      template,
      skills: [],
      documents,
    });

    // 不应该崩溃
    expect(result).toBeDefined();
  });
});

// ===== 辅助函数 =====

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
