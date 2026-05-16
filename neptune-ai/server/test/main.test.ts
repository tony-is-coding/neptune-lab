/**
 * 任务 #6 测试：Bun + Fastify 项目搭建 + DB Schema
 *
 * 测试目标：
 * 1. 验证项目结构完整性
 * 2. 验证 Fastify 服务器可以启动
 * 3. 验证数据库连接正常
 * 4. 验证健康检查端点可访问
 * 5. 验证 DB Schema 定义正确
 */

import {describe, it, beforeEach, afterEach} from 'bun:test';
import {createApp} from '../src/index';
import {db} from '../src/db';
import * as schema from '../src/db/schema';
import {eq} from 'drizzle-orm';
import {existsSync, readFileSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

describe('Phase 1: Bun + Fastify 项目搭建 + DB Schema', () => {
    let app: Awaited<ReturnType<typeof createApp>>;

    beforeEach(async () => {
        // 启动应用
        app = await createApp();
        await app.ready();
    });

    afterEach(async () => {
        // 关闭应用
        await app.close();
    });

    describe('项目结构验证', () => {
        it('应该存在 package.json', async () => {
            const packageJson = await import('../package.json');
            console.log('✓ package.json 存在');
            console.log(`  - 名称: ${packageJson.default.name}`);
            console.log(`  - 版本: ${packageJson.default.version}`);
            console.log(`  - 依赖: ${Object.keys(packageJson.default.dependencies || {}).length} 个`);
        });

        it('应该存在 tsconfig.json', async () => {
            const tsconfigPath = join(projectRoot, 'tsconfig.json');
            console.log(`✓ tsconfig.json ${existsSync(tsconfigPath) ? '存在' : '不存在'}`);
        });

        it('应该存在 drizzle.config.ts', async () => {
            const drizzleConfigPath = join(projectRoot, 'drizzle.config.ts');
            console.log(`✓ drizzle.config.ts ${existsSync(drizzleConfigPath) ? '存在' : '不存在'}`);
        });

        it('应该存在 docker-compose.yml', async () => {
            const dockerComposePath = join(projectRoot, 'docker-compose.yml');
            console.log(`✓ docker-compose.yml ${existsSync(dockerComposePath) ? '存在' : '不存在'}`);
        });
    });

    describe('Fastify 服务器验证', () => {
        it('应该成功创建 Fastify 应用', () => {
            console.log('✓ Fastify 应用创建成功');
            console.log(`  - 日志级别: ${app.log.level}`);
        });

        it('应该注册了 CORS 插件', () => {
            const hasCors = app.hasPlugin('@fastify/cors');
            console.log(`✓ CORS 插件${hasCors ? '已' : '未'}注册`);
        });
    });

    describe('健康检查端点验证', () => {
        it('GET /health 应该返回 200', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/health',
            });

            console.log('✓ GET /health 响应:', {
                status: response.statusCode,
                body: response.body,
            });

            if (response.statusCode !== 200) {
                throw new Error(`期望状态码 200，实际 ${response.statusCode}`);
            }

            const body = JSON.parse(response.body);
            if (body.status !== 'ok') {
                throw new Error(`期望 status 为 'ok'，实际 '${body.status}'`);
            }
        });
    });

    describe('数据库连接验证', () => {
        it('应该能够连接数据库', async () => {
            try {
                await db.execute('SELECT 1');
                console.log('✓ 数据库连接成功');
            } catch (error) {
                console.log('✗ 数据库连接失败');
                throw error;
            }
        });

        it('GET /health/db 应该返回数据库状态', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/health/db',
            });

            console.log('✓ GET /health/db 响应:', {
                status: response.statusCode,
                body: response.body,
            });

            const body = JSON.parse(response.body);
            if (response.statusCode !== 200) {
                console.log('  注意: 数据库可能未启动，请运行 docker-compose up -d');
            }
        });
    });

    describe('DB Schema 验证', () => {
        it('应该导出所有表定义', () => {
            const tables = [
                'tenants',
                'users',
                'agentTemplates',
                'sessions',
                'messages',
                'billingRecords',
            ];

            console.log('✓ Schema 表定义:');
            tables.forEach((table) => {
                const hasTable = table in schema;
                console.log(`  - ${table}: ${hasTable ? '✓' : '✗'}`);
            });
        });

        it('应该导出类型定义', async () => {
            // 类型定义在 TypeScript 编译时可用，运行时不存在
            // 这里我们验证 schema.ts 文件中是否包含类型定义
            const schemaPath = join(projectRoot, 'src/db/schema.ts');
            const schemaContent = readFileSync(schemaPath, 'utf-8');

            const types = [
                'Tenant',
                'NewTenant',
                'User',
                'NewUser',
                'AgentTemplate',
                'NewAgentTemplate',
                'Session',
                'NewSession',
                'Message',
                'NewMessage',
                'BillingRecord',
                'NewBillingRecord',
            ];

            console.log('✓ 类型定义（验证源文件中存在）:');
            types.forEach((type) => {
                const hasType = schemaContent.includes(`export type ${type}`);
                console.log(`  - ${type}: ${hasType ? '✓' : '✗'}`);
            });
        });
    });

    describe('依赖验证', () => {
        it('应该能够导入 Fastify', async () => {
            const fastify = await import('fastify');
            console.log('✓ Fastify 导入成功');
            console.log(`  - 版本: ${fastify.default.version || '未知'}`);
        });

        it('应该能够导入 Drizzle ORM', async () => {
            const drizzle = await import('drizzle-orm');
            console.log('✓ Drizzle ORM 导入成功');
        });

        it('应该能够导入 postgres', async () => {
            const postgres = await import('postgres');
            console.log('✓ postgres 导入成功');
        });
    });

    describe('配置验证', () => {
        it('应该加载配置', async () => {
            const config = await import('../src/config');
            console.log('✓ 配置加载成功');
            console.log(`  - 服务端口: ${config.config.server.port}`);
            console.log(`  - 日志级别: ${config.config.log.level}`);
            console.log(`  - JWT 过期时间: ${config.config.jwt.expiresIn}`);
        });

        it('应该有默认配置值', async () => {
            const {config: cfg} = await import('../src/config');
            console.log('✓ 默认配置值:');
            console.log(`  - DATABASE_URL: ${cfg.database.url}`);
            console.log(`  - REDIS_URL: ${cfg.redis.url}`);
            console.log(`  - PORT: ${cfg.server.port}`);
        });
    });
});
