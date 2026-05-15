/**
 * 数据迁移脚本：将 system_prompt 迁移到 prompt_config
 *
 * Phase 2: System Prompt 模块化
 *
 * 此脚本将现有的 agent_templates.system_prompt 内容迁移到新增的
 * prompt_config.identity 字段，实现向后兼容。
 *
 * 兼容策略：
 * 1. 保留 system_prompt 字段不删除
 * 2. 如果 prompt_config 存在，使用模块化组装
 * 3. 如果 prompt_config 不存在，回退到 system_prompt
 * 4. 此脚本将现有 system_prompt 转为 prompt_config.identity
 *
 * 使用方式：
 * ```bash
 * bun run src/db/migrations/migrate-system-prompt-to-prompt-config.ts
 * ```
 */

import { db } from '../index.js';
import { agentTemplates } from '../schema.js';
import { sql } from 'drizzle-orm';

/**
 * 执行数据迁移
 */
async function migrateSystemPromptToPromptConfig() {
  console.log('开始迁移 system_prompt 到 prompt_config...');

  try {
    // 查询所有 prompt_config 为空的记录
    const templates = await db
      .select({
        id: agentTemplates.id,
        systemPrompt: agentTemplates.systemPrompt,
        promptConfig: agentTemplates.promptConfig,
      })
      .from(agentTemplates);

    console.log(`找到 ${templates.length} 个 Agent 模板`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const template of templates) {
      // 如果已经有 prompt_config，跳过
      if (template.promptConfig) {
        skippedCount++;
        console.log(`跳过模板 ${template.id}（已有 prompt_config）`);
        continue;
      }

      // 将 system_prompt 作为 prompt_config.identity
      const promptConfig = {
        identity: template.systemPrompt,
      };

      await db
        .update(agentTemplates)
        .set({
          promptConfig: promptConfig as any,
        })
        .where(sql`${agentTemplates.id} = ${template.id}`);

      migratedCount++;
      console.log(`✓ 迁移模板 ${template.id}`);
    }

    console.log('\n迁移完成！');
    console.log(`- 成功迁移: ${migratedCount} 条`);
    console.log(`- 跳过（已有数据）: ${skippedCount} 条`);
  } catch (error) {
    console.error('迁移失败:', error);
    throw error;
  }
}

/**
 * 回滚数据迁移（将 prompt_config.identity 转回 system_prompt）
 *
 * 注意：这仅用于紧急回滚，可能会丢失 prompt_config 中的其他配置
 */
async function rollbackPromptConfigToSystemPrompt() {
  console.log('开始回滚 prompt_config 到 system_prompt...');

  try {
    const templates = await db
      .select({
        id: agentTemplates.id,
        systemPrompt: agentTemplates.systemPrompt,
        promptConfig: agentTemplates.promptConfig,
      })
      .from(agentTemplates);

    console.log(`找到 ${templates.length} 个 Agent 模板`);

    let rolledBackCount = 0;

    for (const template of templates) {
      if (!template.promptConfig) {
        continue;
      }

      const identity = (template.promptConfig as any).identity;
      if (!identity) {
        continue;
      }

      await db
        .update(agentTemplates)
        .set({
          systemPrompt: identity,
        })
        .where(sql`${agentTemplates.id} = ${template.id}`);

      rolledBackCount++;
      console.log(`✓ 回滚模板 ${template.id}`);
    }

    console.log('\n回滚完成！');
    console.log(`- 成功回滚: ${rolledBackCount} 条`);
  } catch (error) {
    console.error('回滚失败:', error);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'rollback') {
    await rollbackPromptConfigToSystemPrompt();
  } else if (command === 'migrate' || !command) {
    await migrateSystemPromptToPromptConfig();
  } else {
    console.log('使用方式:');
    console.log('  bun run migrate-system-prompt-to-prompt-config.ts [migrate|rollback]');
    console.log('');
    console.log('命令:');
    console.log('  migrate  - 将 system_prompt 迁移到 prompt_config（默认）');
    console.log('  rollback - 将 prompt_config 回滚到 system_prompt');
    process.exit(1);
  }

  process.exit(0);
}

// 如果直接运行此脚本，执行 main
if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { migrateSystemPromptToPromptConfig, rollbackPromptConfigToSystemPrompt };
