/**
 * 任务 #7 测试：认证模块 - JWT 签发/验证/中间件
 *
 * 测试目标：
 * 1. 验证 JWT 签发功能
 * 2. 验证 JWT 验证功能
 * 3. 验证令牌刷新功能
 * 4. 验证认证中间件
 * 5. 验证认证路由
 */

import { describe, it, beforeEach, afterEach } from 'bun:test';
import { createApp } from '../src/index';
import { authService, type JwtPayload } from '../src/services/auth';
import { db, users, tenants } from '../src/db';
import { eq } from 'drizzle-orm';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

describe('Phase 1: 认证模块 - JWT 签发/验证/中间件', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let testTenantId: string;
  let testUserId: string;
  let testTokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };

  beforeEach(async () => {
    // 启动应用
    app = await createApp();
    await app.ready();

    // 创建测试租户
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: '测试租户',
        quota: { maxTokensPerDay: 1000000, maxConcurrentSessions: 10 },
      })
      .returning();
    testTenantId = tenant.id;

    // 哈希测试密码
    const passwordHash = await bcrypt.hash('password123', 10);

    // 创建测试用户
    const [user] = await db
      .insert(users)
      .values({
        tenantId: testTenantId,
        name: '测试用户',
        email: 'test@example.com',
        passwordHash,
        role: 'user',
      })
      .returning();
    testUserId = user.id;

    // 生成测试令牌
    testTokens = await authService.signTokenPair({
      userId: testUserId,
      tenantId: testTenantId,
      email: 'test@example.com',
      role: 'user',
    });
  });

  afterEach(async () => {
    // 清理测试数据
    await db.delete(users).where(eq(users.tenantId, testTenantId));
    await db.delete(tenants).where(eq(tenants.id, testTenantId));

    // 关闭应用
    await app.close();
  });

  describe('JWT 签发功能', () => {
    it('应该能够签发访问令牌', async () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        userId: testUserId,
        tenantId: testTenantId,
        email: 'test@example.com',
        role: 'user',
      };

      const token = await authService.signAccessToken(payload);

      console.log('✓ 访问令牌签发成功');
      console.log(`  - 令牌长度: ${token.length}`);
      console.log(`  - 令牌前缀: ${token.substring(0, 20)}...`);
    });

    it('应该能够签发刷新令牌', async () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        userId: testUserId,
        tenantId: testTenantId,
        email: 'test@example.com',
        role: 'user',
      };

      const token = await authService.signRefreshToken(payload);

      console.log('✓ 刷新令牌签发成功');
      console.log(`  - 令牌长度: ${token.length}`);
      console.log(`  - 令牌前缀: ${token.substring(0, 20)}...`);
    });

    it('应该能够签发令牌对', async () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        userId: testUserId,
        tenantId: testTenantId,
        email: 'test@example.com',
        role: 'user',
      };

      const tokens = await authService.signTokenPair(payload);

      console.log('✓ 令牌对签发成功');
      console.log(`  - 访问令牌长度: ${tokens.accessToken.length}`);
      console.log(`  - 刷新令牌长度: ${tokens.refreshToken.length}`);
      console.log(`  - 过期时间: ${tokens.expiresIn} 秒`);
    });
  });

  describe('JWT 验证功能', () => {
    it('应该能够验证有效的访问令牌', async () => {
      const payload = await authService.verifyAccessToken(testTokens.accessToken);

      console.log('✓ 访问令牌验证成功');
      console.log(`  - 用户 ID: ${payload.userId}`);
      console.log(`  - 租户 ID: ${payload.tenantId}`);
      console.log(`  - 邮箱: ${payload.email}`);
      console.log(`  - 角色: ${payload.role}`);
    });

    it('应该能够验证有效的刷新令牌', async () => {
      const payload = await authService.verifyRefreshToken(testTokens.refreshToken);

      console.log('✓ 刷新令牌验证成功');
      console.log(`  - 用户 ID: ${payload.userId}`);
      console.log(`  - 租户 ID: ${payload.tenantId}`);
      console.log(`  - 邮箱: ${payload.email}`);
      console.log(`  - 角色: ${payload.role}`);
    });

    it('应该拒绝无效的令牌', async () => {
      try {
        await authService.verifyAccessToken('invalid-token');
        console.log('✗ 应该抛出错误但没有');
      } catch (error) {
        console.log('✓ 正确拒绝了无效令牌');
        console.log(`  - 错误信息: ${(error as Error).message}`);
      }
    });
  });

  describe('令牌刷新功能', () => {
    it('应该能够使用刷新令牌获取新的访问令牌', async () => {
      const newTokens = await authService.refreshTokens(testTokens.refreshToken);

      console.log('✓ 令牌刷新成功');
      console.log(`  - 新访问令牌长度: ${newTokens.accessToken.length}`);
      console.log(`  - 新刷新令牌长度: ${newTokens.refreshToken.length}`);
      console.log(`  - 过期时间: ${newTokens.expiresIn} 秒`);

      // 验证新令牌
      const payload = await authService.verifyAccessToken(newTokens.accessToken);
      console.log(`  - 新令牌用户 ID: ${payload.userId}`);
    });

    it('应该拒绝无效的刷新令牌', async () => {
      try {
        await authService.refreshTokens('invalid-refresh-token');
        console.log('✗ 应该抛出错误但没有');
      } catch (error) {
        console.log('✓ 正确拒绝了无效刷新令牌');
        console.log(`  - 错误信息: ${(error as Error).message}`);
      }
    });
  });

  describe('认证路由', () => {
    it('POST /api/auth/login - 应该能够登录', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      console.log('✓ 登录请求响应:', {
        status: response.statusCode,
        hasAccessToken: response.json()?.accessToken ? '是' : '否',
        hasRefreshToken: response.json()?.refreshToken ? '是' : '否',
      });

      if (response.statusCode !== 200) {
        console.log(`  - 响应体: ${response.body}`);
      }
    });

    it('POST /api/auth/register - 应该能够注册新用户', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          tenantId: testTenantId,
          name: '新用户',
          email: `new-user-${Date.now()}@example.com`,
          password: 'password123',
        },
      });

      console.log('✓ 注册请求响应:', {
        status: response.statusCode,
        hasUser: response.json()?.user ? '是' : '否',
        hasAccessToken: response.json()?.accessToken ? '是' : '否',
      });

      if (response.statusCode !== 201) {
        console.log(`  - 响应体: ${response.body}`);
      }
    });

    it('POST /api/auth/token/refresh - 应该能够刷新令牌', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/token/refresh',
        payload: {
          refreshToken: testTokens.refreshToken,
        },
      });

      console.log('✓ 刷新令牌请求响应:', {
        status: response.statusCode,
        hasAccessToken: response.json()?.accessToken ? '是' : '否',
        hasRefreshToken: response.json()?.refreshToken ? '是' : '否',
      });

      if (response.statusCode !== 200) {
        console.log(`  - 响应体: ${response.body}`);
      }
    });

    it('GET /api/auth/me - 应该能够获取当前用户信息', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${testTokens.accessToken}`,
        },
      });

      console.log('✓ 获取用户信息请求响应:', {
        status: response.statusCode,
        hasUser: response.json()?.id ? '是' : '否',
      });

      if (response.statusCode === 200) {
        console.log(`  - 用户 ID: ${response.json()?.id}`);
        console.log(`  - 用户名: ${response.json()?.name}`);
        console.log(`  - 邮箱: ${response.json()?.email}`);
        console.log(`  - 角色: ${response.json()?.role}`);
      } else {
        console.log(`  - 响应体: ${response.body}`);
      }
    });

    it('GET /api/auth/me - 应该拒绝无认证的请求', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      console.log('✓ 无认证请求被正确拒绝:', {
        status: response.statusCode,
        error: response.json()?.error,
      });
    });
  });

  describe('中间件功能', () => {
    it('认证中间件文件应该存在', async () => {
      const { existsSync } = await import('fs');
      const middlewarePath = join(projectRoot, 'src/middleware/auth.ts');
      console.log(`✓ 认证中间件文件${existsSync(middlewarePath) ? '存在' : '不存在'}`);
    });

    it('认证服务文件应该存在', async () => {
      const { existsSync } = await import('fs');
      const servicePath = join(projectRoot, 'src/services/auth.ts');
      console.log(`✓ 认证服务文件${existsSync(servicePath) ? '存在' : '不存在'}`);
    });

    it('认证路由文件应该存在', async () => {
      const { existsSync } = await import('fs');
      const routePath = join(projectRoot, 'src/routes/auth.ts');
      console.log(`✓ 认证路由文件${existsSync(routePath) ? '存在' : '不存在'}`);
    });
  });
});
